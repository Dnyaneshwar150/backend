import { Response } from "express";

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  message?: string,
): void {
  res.status(statusCode).json({
    success: true,
    ...(message && { message }),
    data,
  });
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
): void {
  res.status(statusCode).json({
    success: false,
    message,
  });
}
