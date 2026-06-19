// ─────────────────────────────────────────────
// Custom Application Error Class
// isOperational = true means it is a known, expected error (4xx)
// isOperational = false means it is a programming bug (5xx)
// ─────────────────────────────────────────────
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);

    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace in V8
    Error.captureStackTrace(this, this.constructor);

    // Explicitly set the prototype so instanceof works correctly after transpilation
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
