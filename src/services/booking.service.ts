import mongoose, { Types } from 'mongoose';
import { Seat } from '../models/Seat.model';
import { Order, IOrderDocument } from '../models/Order.model';
import { Reservation } from '../models/Reservation.model';
import { releaseMultipleSeatLocks } from '../redis/seatLock';
import { AppError } from '../utils/AppError';

// ─────────────────────────────────────────────
// Input / Output Types
// ─────────────────────────────────────────────

export interface ConfirmBookingInput {
  reservationId: string;
  paymentId: string;
}

export interface ConfirmBookingResult {
  orderId: string;
  totalPrice: number;
  status: string;
  paymentId: string;
}

// ─────────────────────────────────────────────
// Confirm Booking
//
// Flow:
//  1. Validate reservation exists
//  2. Check reservation is still 'pending' and not expired
//  3. Start MongoDB session + transaction
//  4. Update each seat: available → booked (with version check)
//  5. Create Order document
//  6. Update Reservation: pending → confirmed
//  7. Commit transaction
//  8. Delete Redis locks
// ─────────────────────────────────────────────
export async function confirmBooking(
  input: ConfirmBookingInput
): Promise<ConfirmBookingResult> {
  const { reservationId, paymentId } = input;

  // ── Validate ID format ─────────────────────
  if (!Types.ObjectId.isValid(reservationId)) {
    throw new AppError('Invalid reservation ID format', 400);
  }

  // ── 1. Fetch Reservation ───────────────────
  const reservation = await Reservation.findById(reservationId);

  if (!reservation) {
    throw new AppError('Reservation not found', 404);
  }

  // ── 2. Verify reservation is still valid ───
  if (reservation.status !== 'pending') {
    if (reservation.status === 'confirmed') {
      throw new AppError('Reservation has already been confirmed', 409);
    }
    if (reservation.status === 'expired') {
      throw new AppError('Reservation has expired. Please start a new reservation.', 410);
    }
    if (reservation.status === 'cancelled') {
      throw new AppError('Reservation has been cancelled', 409);
    }
  }

  // Check if reservation window has passed (belt-and-suspenders check)
  if (new Date() > reservation.expiresAt) {
    // Mark as expired in MongoDB
    await Reservation.updateOne(
      { _id: reservation._id },
      { $set: { status: 'expired' } }
    );
    throw new AppError('Reservation has expired. Please start a new reservation.', 410);
  }

  // ── 3. Fetch the seats to calculate total price ─
  const seats = await Seat.find({
    _id: { $in: reservation.seatIds },
  }).lean();

  if (seats.length !== reservation.seatIds.length) {
    throw new AppError('One or more seats could not be found', 500);
  }

  const totalPrice = seats.reduce((sum, seat) => sum + seat.price, 0);

  // ── 4. Start MongoDB session + transaction ──
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const seatIdStrings = reservation.seatIds.map((id) => id.toString());

    // ── Update each seat with optimistic concurrency check ──
    // Filter uses BOTH _id AND status:'available' AND version:N
    // If modifiedCount = 0, another operation changed the seat → abort
    for (const seat of seats) {
      const result = await Seat.updateOne(
        {
          _id: seat._id,
          status: 'available',     // Must still be available
          version: seat.version,   // Version must not have changed
        },
        {
          $set: {
            status: 'booked',
            orderId: null,         // Will be linked after order creation
          },
          $inc: { version: 1 },   // Increment version on each write
        },
        { session }
      );

      // modifiedCount = 0 means another process already modified this seat
      if (result.modifiedCount === 0) {
        throw new AppError(
          `Seat ${seat.seatNumber} is no longer available`,
          409
        );
      }
    }

    // ── Create Order ─────────────────────────
    const [order] = await Order.create(
      [
        {
          userId: reservation.userId,
          eventId: reservation.eventId,
          seatIds: reservation.seatIds,
          totalPrice,
          status: 'confirmed',
          paymentId,
        },
      ],
      { session }
    ) as IOrderDocument[];

    // ── Link orderId back to each seat ───────
    await Seat.updateMany(
      { _id: { $in: reservation.seatIds } },
      { $set: { orderId: order._id } },
      { session }
    );

    // ── Update Reservation to confirmed ──────
    await Reservation.updateOne(
      { _id: reservation._id },
      { $set: { status: 'confirmed' } },
      { session }
    );

    // ── Commit the transaction ────────────────
    await session.commitTransaction();

    // ── 5. Release Redis locks (after commit) ─
    // Done outside the transaction — Redis and MongoDB are separate systems
    await releaseMultipleSeatLocks(
      reservation.eventId.toString(),
      seatIdStrings
    );

    return {
      orderId: order._id.toString(),
      totalPrice: order.totalPrice,
      status: order.status,
      paymentId: order.paymentId,
    };
  } catch (err) {
    // Rollback transaction on any error
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}
