import { Response } from 'express';

// ─────────────────────────────────────────────
// Standard success response shape
// ─────────────────────────────────────────────
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  message?: string
): void {
  res.status(statusCode).json({
    success: true,
    ...(message && { message }),
    data,
  });
}

// ─────────────────────────────────────────────
// Standard error response shape (used inside error middleware)
// ─────────────────────────────────────────────
export function sendError(
  res: Response,
  message: string,
  statusCode = 500
): void {
  res.status(statusCode).json({
    success: false,
    message,
  });
}
