import { Schema, model, Document, Types } from 'mongoose';

// ─────────────────────────────────────────────
// TypeScript Interfaces
// ─────────────────────────────────────────────

export type ReservationStatus = 'pending' | 'confirmed' | 'expired' | 'cancelled';

export interface IReservation {
  userId: Types.ObjectId;
  eventId: Types.ObjectId;
  seatIds: Types.ObjectId[];
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose document type
export interface IReservationDocument extends IReservation, Document {
  _id: Types.ObjectId;
}

// ─────────────────────────────────────────────
// Mongoose Schema
// ─────────────────────────────────────────────

const reservationSchema = new Schema<IReservationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: [true, 'User ID is required'],
      index: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required'],
    },
    seatIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Seat',
      required: [true, 'At least one seat ID is required'],
      validate: {
        validator: (arr: Types.ObjectId[]) => arr.length > 0,
        message: 'seatIds must contain at least one seat',
      },
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'confirmed', 'expired', 'cancelled'],
        message: 'Status must be one of: pending, confirmed, expired, cancelled',
      },
      default: 'pending',
    },
    // This is the expiry time for the reservation (10 minutes from creation)
    // After this time, the Redis lock will also have expired automatically
    expiresAt: {
      type: Date,
      required: [true, 'Expiry date is required'],
    },
  },
  {
    timestamps: true,
    collection: 'reservations',
    versionKey: false,
  }
);

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────

// Look up reservations by user and status
reservationSchema.index({ userId: 1, status: 1 });

// Look up reservations for an event (admin / analytics use)
reservationSchema.index({ eventId: 1, status: 1 });

// ─────────────────────────────────────────────
// Model
// ─────────────────────────────────────────────
export const Reservation = model<IReservationDocument>(
  'Reservation',
  reservationSchema
);
