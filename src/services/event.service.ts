import { Types } from 'mongoose';
import { Event, IEventDocument, ISeatConfig, ISeatTypes } from '../models/Event.model';
import { Seat, ISeatDocument, SeatType } from '../models/Seat.model';
import { checkMultipleSeatLocks } from '../redis/seatLock';
import { AppError } from '../utils/AppError';

// ─────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────

export interface EventListItem {
  id: string;
  name: string;
  venue: string;
  date: Date;
  status: string;
}

export interface SeatWithLockStatus {
  id: string;
  seatNumber: string;
  row: number;
  column: number;
  type: string;
  price: number;
  // 'available' | 'reserved' (Redis lock) | 'booked' (MongoDB permanent)
  status: 'available' | 'reserved' | 'booked';
}

export interface EventDetailResponse {
  event: IEventDocument;
  seats: SeatWithLockStatus[];
}

// ─────────────────────────────────────────────
// Get all events — sorted by date ascending
// Returns full event documents so the frontend
// can display posters, prices, categories, etc.
// ─────────────────────────────────────────────
export async function getAllEvents(): Promise<IEventDocument[]> {
  const events = await Event.find()
    .sort({ date: 1 })
    .lean();

  return events as IEventDocument[];
}

// ─────────────────────────────────────────────
// Get event by ID with real-time seat availability
// Merges MongoDB seat status with Redis lock status
// ─────────────────────────────────────────────
export async function getEventById(eventId: string): Promise<EventDetailResponse> {
  // Validate ObjectId format
  if (!Types.ObjectId.isValid(eventId)) {
    throw new AppError('Invalid event ID format', 400);
  }

  // 1. Fetch event from MongoDB
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  // 2. Fetch all seats for this event from MongoDB
  const seats: ISeatDocument[] = await Seat.find({ eventId: event._id })
    .sort({ row: 1, column: 1 })
    .lean() as unknown as ISeatDocument[];

  // 3. Check Redis for temporarily locked seats (pipeline GET for efficiency)
  const seatIds = seats.map((s) => (s._id as Types.ObjectId).toString());
  const lockMap = await checkMultipleSeatLocks(eventId, seatIds);

  // 4. Merge: if Redis lock exists AND MongoDB says 'available', mark as 'reserved'
  const seatsWithStatus: SeatWithLockStatus[] = seats.map((seat) => {
    const seatId = (seat._id as Types.ObjectId).toString();
    const isLockedInRedis = lockMap.get(seatId) ?? false;

    let status: 'available' | 'reserved' | 'booked';

    if (seat.status === 'booked') {
      status = 'booked';
    } else if (isLockedInRedis) {
      status = 'reserved'; // Temporarily held by another user in Redis
    } else {
      status = 'available';
    }

    return {
      id: seatId,
      seatNumber: seat.seatNumber,
      row: seat.row,
      column: seat.column,
      type: seat.type,
      price: seat.price,
      status,
    };
  });

  return { event, seats: seatsWithStatus };
}

// ─────────────────────────────────────────────
// Create Event Input Type
// ─────────────────────────────────────────────
export interface CreateEventInput {
  name: string;
  venue: string;
  date: string | Date;
  seatConfig: ISeatConfig;
}

// ─────────────────────────────────────────────
// Resolve seat type from row number using seatConfig
// ─────────────────────────────────────────────
function resolveSeatType(
  row: number,
  seatTypes: ISeatTypes
): { type: SeatType; price: number } {
  if (seatTypes.vip.rows.includes(row)) {
    return { type: 'vip', price: seatTypes.vip.price };
  }
  if (seatTypes.premium.rows.includes(row)) {
    return { type: 'premium', price: seatTypes.premium.price };
  }
  // Default to regular for any unspecified row
  return { type: 'regular', price: seatTypes.regular.price };
}

// ─────────────────────────────────────────────
// Create Event (Admin only)
//
// 1. Validates seat config
// 2. Creates the Event document
// 3. Auto-generates all seat documents from seatConfig
//    Seat labels: A1, A2 ... A12, B1, B2 ... etc.
// ─────────────────────────────────────────────
export async function createEvent(
  input: CreateEventInput
): Promise<{ event: IEventDocument; seatsCreated: number }> {
  const { name, venue, date, seatConfig } = input;

  // Basic validations
  if (!name || !venue || !date) {
    throw new AppError('name, venue, and date are required', 400);
  }

  const { rows, seatsPerRow, seatTypes } = seatConfig;

  if (!rows || rows < 1 || !seatsPerRow || seatsPerRow < 1) {
    throw new AppError('seatConfig.rows and seatConfig.seatsPerRow must be at least 1', 400);
  }

  // Validate that all rows are covered by a seat type
  const coveredRows = new Set([
    ...seatTypes.regular.rows,
    ...seatTypes.premium.rows,
    ...seatTypes.vip.rows,
  ]);

  for (let r = 0; r < rows; r++) {
    if (!coveredRows.has(r)) {
      throw new AppError(
        `Row ${r} is not assigned to any seat type (regular/premium/vip)`,
        400
      );
    }
  }

  // 1. Create the Event
  const event = await Event.create({ name, venue, date, seatConfig });

  // 2. Generate seat documents — one per cell in the grid
  // Row labels: A=0, B=1, C=2 ... Z=25
  // Seat number format: A1, A2, B5, etc.
  const seatDocs = [];

  for (let row = 0; row < rows; row++) {
    const rowLabel = String.fromCharCode(65 + row); // 65 = 'A'
    const { type, price } = resolveSeatType(row, seatTypes);

    for (let col = 0; col < seatsPerRow; col++) {
      const column = col;
      const seatNumber = `${rowLabel}${col + 1}`; // e.g. A1, B3

      seatDocs.push({
        eventId: event._id,
        seatNumber,
        row,
        column,
        type,
        price,
        status: 'available',
        orderId: null,
        version: 0,
      });
    }
  }

  // Bulk insert all seats in one DB round-trip
  await Seat.insertMany(seatDocs);

  return { event, seatsCreated: seatDocs.length };
}
