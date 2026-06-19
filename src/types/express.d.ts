import { Request } from 'express';

// ─────────────────────────────────────────────
// Extend Express Request to carry authenticated user
// Set by the `authenticate` middleware after JWT verification
// ─────────────────────────────────────────────
export interface AuthUser {
  userId: string;
  email: string;
  role: 'admin' | 'user';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
