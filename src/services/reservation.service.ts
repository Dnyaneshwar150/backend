import { Types } from 'mongoose';
import { Seat } from '../models/Seat.model';
import { Reservation, IReservationDocument } from '../models/Reservation.model';
import { acquireMultipleSeatLocks, releaseMultipleSeatLocks } from '../redis/seatLock';
import { AppError } from '../utils/AppError';
import { config } from '../config/env';

// ─────────────────────────────────────────────
// Input / Output Types
// ─────────────────────────────────────────────

export interface ReserveSeatsInput {
  userId: string;
  eventId: string;
  seatIds: string[];
}

export interface ReserveSeatsResult {
  reservationId: string;
  expiresAt: Date;
}

// ─────────────────────────────────────────────
// Reserve Seats
//
// Flow:
//  1. Validate all seat IDs are valid ObjectIds
//  2. Verify seats exist in MongoDB and are 'available'
//  3. Acquire Redis locks atomically (all-or-nothing)
//  4. Create a pending Reservation in MongoDB
//  5. Return reservationId + expiresAt
// ─────────────────────────────────────────────
export async function reserveSeats(
  input: ReserveSeatsInput
): Promise<ReserveSeatsResult> {
  const { userId, eventId, seatIds } = input;

  // ── Validate IDs ──────────────────────────
  if (!Types.ObjectId.isValid(eventId)) {
    throw new AppError('Invalid event ID format', 400);
  }

  for (const seatId of seatIds) {
    if (!Types.ObjectId.isValid(seatId)) {
      throw new AppError(`Invalid seat ID format: ${seatId}`, 400);
    }
  }

  // ── Validate seat count ───────────────────
  if (seatIds.length === 0) {
    throw new AppError('At least one seat ID is required', 400);
  }

  if (seatIds.length > 10) {
    throw new AppError('Cannot reserve more than 10 seats at once', 400);
  }

  // ── 1. Verify seats exist in MongoDB and are available ──
  const seats = await Seat.find({
    _id: { $in: seatIds.map((id) => new Types.ObjectId(id)) },
    eventId: new Types.ObjectId(eventId),
  }).lean();

  // All requested seats must exist
  if (seats.length !== seatIds.length) {
    throw new AppError('One or more seat IDs are invalid or do not belong to this event', 404);
  }

  // All seats must be 'available' in MongoDB (not permanently booked)
  const bookedSeat = seats.find((s) => s.status === 'booked');
  if (bookedSeat) {
    throw new AppError(
      `Seat ${bookedSeat.seatNumber} is already booked`,
      409
    );
  }

  // ── 2. Acquire Redis locks (atomic all-or-nothing) ──────
  const lockResult = await acquireMultipleSeatLocks(eventId, seatIds, userId);

  if (!lockResult.success) {
    throw new AppError(
      `Seat is currently reserved by another user`,
      409
    );
  }

  // ── 3. Create Reservation in MongoDB ───────────────────
  // If this fails, we must release Redis locks to avoid stuck locks
  const expiryMinutes = config.reservation.expiryMinutes;
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  let reservation: IReservationDocument;

  try {
    reservation = await Reservation.create({
      userId: new Types.ObjectId(userId),
      eventId: new Types.ObjectId(eventId),
      seatIds: seatIds.map((id) => new Types.ObjectId(id)),
      status: 'pending',
      expiresAt,
    });
  } catch (err) {
    // MongoDB write failed — release Redis locks to avoid orphaned locks
    await releaseMultipleSeatLocks(eventId, seatIds);
    throw new AppError('Failed to create reservation. Please try again.', 500);
  }

  return {
    reservationId: reservation._id.toString(),
    expiresAt: reservation.expiresAt,
  };
}
