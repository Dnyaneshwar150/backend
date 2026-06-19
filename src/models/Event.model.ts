import { Schema, model, Document, Types } from 'mongoose';

// ─────────────────────────────────────────────
// TypeScript Interfaces
// ─────────────────────────────────────────────

export type EventStatus = 'on_sale' | 'sold_out' | 'cancelled';

export interface ISeatTypeConfig {
  name: string;
  price: number;
  rows: number[];
}

export interface ISeatTypes {
  regular: ISeatTypeConfig;
  premium: ISeatTypeConfig;
  vip: ISeatTypeConfig;
}

export interface ISeatConfig {
  rows: number;
  seatsPerRow: number;
  seatTypes: ISeatTypes;
}

// Interface for type safety on the raw document
export interface IEvent {
  name: string;
  venue: string;
  date: Date;
  status: EventStatus;
  posterUrl: string;         // Event poster/banner image URL
  category: string;          // e.g. 'Concerts', 'Comedy', 'Sports', 'Theatre'
  seatConfig: ISeatConfig;
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose document type
export interface IEventDocument extends IEvent, Document {
  _id: Types.ObjectId;
}

// ─────────────────────────────────────────────
// Mongoose Schema
// ─────────────────────────────────────────────

const seatTypeConfigSchema = new Schema<ISeatTypeConfig>(
  {
    name: {
      type: String,
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Seat type price is required'],
      min: [0, 'Price must be a positive number'],
    },
    rows: {
      type: [Number],
      required: [true, 'Seat type rows are required'],
    },
  },
  { _id: false } // Embedded subdoc — no separate _id
);

const seatTypesSchema = new Schema<ISeatTypes>(
  {
    regular: { type: seatTypeConfigSchema, required: true },
    premium: { type: seatTypeConfigSchema, required: true },
    vip: { type: seatTypeConfigSchema, required: true },
  },
  { _id: false }
);

const seatConfigSchema = new Schema<ISeatConfig>(
  {
    rows: {
      type: Number,
      required: [true, 'Number of rows is required'],
      min: [1, 'Must have at least 1 row'],
    },
    seatsPerRow: {
      type: Number,
      required: [true, 'Seats per row is required'],
      min: [1, 'Must have at least 1 seat per row'],
    },
    seatTypes: {
      type: seatTypesSchema,
      required: true,
    },
  },
  { _id: false }
);

const eventSchema = new Schema<IEventDocument>(
  {
    name: {
      type: String,
      required: [true, 'Event name is required'],
      trim: true,
      maxlength: [200, 'Event name cannot exceed 200 characters'],
    },
    venue: {
      type: String,
      required: [true, 'Venue is required'],
      trim: true,
      maxlength: [300, 'Venue cannot exceed 300 characters'],
    },
    date: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['on_sale', 'sold_out', 'cancelled'],
        message: 'Status must be one of: on_sale, sold_out, cancelled',
      },
      default: 'on_sale',
    },
    seatConfig: {
      type: seatConfigSchema,
      required: [true, 'Seat configuration is required'],
    },
    posterUrl: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
      maxlength: [100, 'Category cannot exceed 100 characters'],
    },
  },
  {
    timestamps: true,        // Adds createdAt and updatedAt automatically
    collection: 'events',
    versionKey: false,       // Disable default __v field (we use our own version in Seat)
  }
);

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────
eventSchema.index({ status: 1 });           // Filter by status
eventSchema.index({ date: 1 });             // Sort/filter by date
eventSchema.index({ status: 1, date: 1 }); // Combined: active upcoming events

// ─────────────────────────────────────────────
// Model
// ─────────────────────────────────────────────
export const Event = model<IEventDocument>('Event', eventSchema);
