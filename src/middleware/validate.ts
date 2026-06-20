import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

export function validateReserveRequest(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const { eventId, seatIds } = req.body as {
    eventId?: unknown;
    seatIds?: unknown;
  };

  if (!eventId || typeof eventId !== "string" || eventId.trim() === "") {
    return next(
      new AppError("eventId is required and must be a non-empty string", 400),
    );
  }

  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    return next(new AppError("seatIds must be a non-empty array", 400));
  }

  if (!seatIds.every((id) => typeof id === "string" && id.trim() !== "")) {
    return next(new AppError("All seatIds must be non-empty strings", 400));
  }

  next();
}

export function validateBookingRequest(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const { reservationId, paymentId } = req.body as {
    reservationId?: unknown;
    paymentId?: unknown;
  };

  if (
    !reservationId ||
    typeof reservationId !== "string" ||
    reservationId.trim() === ""
  ) {
    return next(
      new AppError(
        "reservationId is required and must be a non-empty string",
        400,
      ),
    );
  }

  if (!paymentId || typeof paymentId !== "string" || paymentId.trim() === "") {
    return next(
      new AppError("paymentId is required and must be a non-empty string", 400),
    );
  }

  next();
}
