import { Types } from "mongoose";
import {
  Event,
  IEventDocument,
  ISeatConfig,
  ISeatTypes,
} from "../models/Event.model";
import { Seat, ISeatDocument, SeatType } from "../models/Seat.model";
import { checkMultipleSeatLocks } from "../redis/seatLock";
import { AppError } from "../utils/AppError";

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
  status: "available" | "reserved" | "booked";
}

export interface EventDetailResponse {
  event: IEventDocument;
  seats: SeatWithLockStatus[];
}

export async function getAllEvents(): Promise<IEventDocument[]> {
  const events = await Event.find().sort({ date: 1 }).lean();

  return events as IEventDocument[];
}

export async function getEventById(
  eventId: string,
): Promise<EventDetailResponse> {
  if (!Types.ObjectId.isValid(eventId)) {
    throw new AppError("Invalid event ID format", 400);
  }

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  const seats: ISeatDocument[] = (await Seat.find({ eventId: event._id })
    .sort({ row: 1, column: 1 })
    .lean()) as unknown as ISeatDocument[];

  const seatIds = seats.map((s) => (s._id as Types.ObjectId).toString());
  const lockMap = await checkMultipleSeatLocks(eventId, seatIds);
  const seatsWithStatus: SeatWithLockStatus[] = seats.map((seat) => {
    const seatId = (seat._id as Types.ObjectId).toString();
    const isLockedInRedis = lockMap.get(seatId) ?? false;

    let status: "available" | "reserved" | "booked";

    if (seat.status === "booked") {
      status = "booked";
    } else if (isLockedInRedis) {
      status = "reserved"; // Temporarily held by another user in Redis
    } else {
      status = "available";
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

export interface CreateEventInput {
  name: string;
  venue: string;
  date: string | Date;
  seatConfig: ISeatConfig;
}

function resolveSeatType(
  row: number,
  seatTypes: ISeatTypes,
): { type: SeatType; price: number } {
  if (seatTypes.vip.rows.includes(row)) {
    return { type: "vip", price: seatTypes.vip.price };
  }
  if (seatTypes.premium.rows.includes(row)) {
    return { type: "premium", price: seatTypes.premium.price };
  }
  // Default to regular for any unspecified row
  return { type: "regular", price: seatTypes.regular.price };
}

export async function createEvent(
  input: CreateEventInput,
): Promise<{ event: IEventDocument; seatsCreated: number }> {
  const { name, venue, date, seatConfig } = input;

  if (!name || !venue || !date) {
    throw new AppError("name, venue, and date are required", 400);
  }

  const { rows, seatsPerRow, seatTypes } = seatConfig;

  if (!rows || rows < 1 || !seatsPerRow || seatsPerRow < 1) {
    throw new AppError(
      "seatConfig.rows and seatConfig.seatsPerRow must be at least 1",
      400,
    );
  }

  const coveredRows = new Set([
    ...seatTypes.regular.rows,
    ...seatTypes.premium.rows,
    ...seatTypes.vip.rows,
  ]);

  for (let r = 0; r < rows; r++) {
    if (!coveredRows.has(r)) {
      throw new AppError(
        `Row ${r} is not assigned to any seat type (regular/premium/vip)`,
        400,
      );
    }
  }

  // 1. Create the Event
  const event = await Event.create({ name, venue, date, seatConfig });

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
        status: "available",
        orderId: null,
        version: 0,
      });
    }
  }
  // Bulk insert all seats in one DB round-trip
  await Seat.insertMany(seatDocs);

  return { event, seatsCreated: seatDocs.length };
}
