import { Schema, model, Document, Types } from 'mongoose';

// ─────────────────────────────────────────────
// TypeScript Interfaces
// ─────────────────────────────────────────────

export type OrderStatus = 'pending' | 'confirmed' | 'cancelled';

export interface IOrder {
  userId: Types.ObjectId;
  eventId: Types.ObjectId;
  seatIds: Types.ObjectId[];
  totalPrice: number;
  status: OrderStatus;
  paymentId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose document type
export interface IOrderDocument extends IOrder, Document {
  _id: Types.ObjectId;
}

// ─────────────────────────────────────────────
// Mongoose Schema
// ─────────────────────────────────────────────

const orderSchema = new Schema<IOrderDocument>(
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
    totalPrice: {
      type: Number,
      required: [true, 'Total price is required'],
      min: [0, 'Total price must be non-negative'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'confirmed', 'cancelled'],
        message: 'Order status must be one of: pending, confirmed, cancelled',
      },
      default: 'pending',
    },
    paymentId: {
      type: String,
      required: [true, 'Payment ID is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'orders',
    versionKey: false,
  }
);

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────

// Look up orders by user
orderSchema.index({ userId: 1, status: 1 });

// Look up orders for an event (admin / reporting)
orderSchema.index({ eventId: 1 });

// Payment ID lookup (should be unique in a real system)
orderSchema.index({ paymentId: 1 });

// ─────────────────────────────────────────────
// Model
// ─────────────────────────────────────────────
export const Order = model<IOrderDocument>('Order', orderSchema);
