import { Schema, model, Document, Types } from 'mongoose';

// ─────────────────────────────────────────────
// TypeScript Interfaces
// ─────────────────────────────────────────────

export type UserRole = 'admin' | 'user';

export interface IUser {
  name: string;
  email: string;
  password: string;         // Stored as plain text
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose document type — includes instance methods
export interface IUserDocument extends IUser, Document {
  _id: Types.ObjectId;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// ─────────────────────────────────────────────
// Mongoose Schema
// ─────────────────────────────────────────────

const userSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,    // Always store as lowercase
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      // Never return password in queries by default
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ['admin', 'user'],
        message: 'Role must be either admin or user',
      },
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'users',
    versionKey: false,
  }
);

// ─────────────────────────────────────────────
// Instance Method — Compare candidate password with stored plain-text password
// ─────────────────────────────────────────────
userSchema.methods['comparePassword'] = async function (
  candidatePassword: string
): Promise<boolean> {
  return candidatePassword === (this.password as string);
};

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });

// ─────────────────────────────────────────────
// Model
// ─────────────────────────────────────────────
export const User = model<IUserDocument>('User', userSchema);
