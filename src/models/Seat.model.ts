import { Schema, model, Document, Types } from 'mongoose';

// ─────────────────────────────────────────────
// TypeScript Interfaces
// ─────────────────────────────────────────────

export type SeatType = 'regular' | 'premium' | 'vip';
export type SeatStatus = 'available' | 'booked';

export interface ISeat {
  eventId: Types.ObjectId;
  seatNumber: string;       // e.g., "A1", "B5"
  row: number;              // 0-indexed row number
  column: number;           // 0-indexed column number
  type: SeatType;
  price: number;
  status: SeatStatus;
  orderId: Types.ObjectId | null;
  version: number;          // Optimistic concurrency control
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose document type
export interface ISeatDocument extends ISeat, Document {
  _id: Types.ObjectId;
}

// ─────────────────────────────────────────────
// Mongoose Schema
// ─────────────────────────────────────────────

const seatSchema = new Schema<ISeatDocument>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required'],
      index: true,
    },
    seatNumber: {
      type: String,
      required: [true, 'Seat number is required'],
      trim: true,
    },
    row: {
      type: Number,
      required: [true, 'Row is required'],
      min: [0, 'Row must be 0 or greater'],
    },
    column: {
      type: Number,
      required: [true, 'Column is required'],
      min: [0, 'Column must be 0 or greater'],
    },
    type: {
      type: String,
      enum: {
        values: ['regular', 'premium', 'vip'],
        message: 'Seat type must be one of: regular, premium, vip',
      },
      required: [true, 'Seat type is required'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be a positive number'],
    },
    // ─── IMPORTANT ───────────────────────────────
    // Seat status is ONLY 'available' or 'booked'
    // Temporary reservations are handled exclusively by Redis
    // This keeps MongoDB as the clean source of truth
    // ─────────────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: ['available', 'booked'],
        message: 'Seat status must be one of: available, booked',
      },
      default: 'available',
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    // ─── Optimistic Concurrency Version ──────────
    // Used in updateOne filter to prevent concurrent double-booking
    // If version doesn't match, modifiedCount = 0 → booking failed
    // ─────────────────────────────────────────────
    version: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'seats',
    versionKey: false, // We manage our own `version` field explicitly
  }
);

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────

// Unique constraint: one seat number per event
seatSchema.index({ eventId: 1, seatNumber: 1 }, { unique: true });

// Query available seats for an event quickly
seatSchema.index({ eventId: 1, status: 1 });

// Query seats by type for an event
seatSchema.index({ eventId: 1, type: 1, status: 1 });

// ─────────────────────────────────────────────
// Model
// ─────────────────────────────────────────────
export const Seat = model<ISeatDocument>('Seat', seatSchema);
