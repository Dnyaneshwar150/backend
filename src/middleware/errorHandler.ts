import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../utils/AppError';
import { sendError } from '../utils/apiResponse';

// ─────────────────────────────────────────────
// Handle Mongoose CastError (invalid ObjectId in URL params)
// ─────────────────────────────────────────────
function handleCastError(err: mongoose.Error.CastError): AppError {
  return new AppError(`Invalid ${err.path}: ${err.value}`, 400);
}

// ─────────────────────────────────────────────
// Handle Mongoose Validation Error
// ─────────────────────────────────────────────
function handleValidationError(err: mongoose.Error.ValidationError): AppError {
  const messages = Object.values(err.errors).map((e) => e.message);
  return new AppError(`Validation failed: ${messages.join('. ')}`, 400);
}

// ─────────────────────────────────────────────
// Handle MongoDB Duplicate Key Error (code 11000)
// ─────────────────────────────────────────────
function handleDuplicateKeyError(err: Record<string, unknown>): AppError {
  const keyValue = err['keyValue'] as Record<string, unknown>;
  const field = Object.keys(keyValue)[0];
  return new AppError(`Duplicate value for field: ${field}`, 409);
}

// ─────────────────────────────────────────────
// Global Error Handler Middleware
// Must have exactly 4 parameters for Express to recognize it as error middleware
// ─────────────────────────────────────────────
export function globalErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  let error = err;

  // Convert known Mongoose errors to AppError
  if (err instanceof mongoose.Error.CastError) {
    error = handleCastError(err);
  } else if (err instanceof mongoose.Error.ValidationError) {
    error = handleValidationError(err);
  } else if (
    typeof err === 'object' &&
    err !== null &&
    (err as Record<string, unknown>)['code'] === 11000
  ) {
    error = handleDuplicateKeyError(err as Record<string, unknown>);
  }

  // Handle operational AppErrors (expected errors — send to client)
  if (error instanceof AppError) {
    sendError(res, error.message, error.statusCode);
    return;
  }

  // Unknown / programmer errors — log and send generic response
  console.error('[ERROR]', err);
  sendError(res, 'Something went wrong. Please try again later.', 500);
}
