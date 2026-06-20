import { Request, Response, NextFunction } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/apiResponse";
import { reserveSeats } from "../services/reservation.service";
import { AppError } from "../utils/AppError";

export const createReservation = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    const { eventId, seatIds } = req.body as {
      eventId: string;
      seatIds: string[];
    };

    const result = await reserveSeats({ userId, eventId, seatIds });

    sendSuccess(res, result, 201, "Seats reserved successfully");
  },
);
