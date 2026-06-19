import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/apiResponse';
import { reserveSeats } from '../services/reservation.service';
import { AppError } from '../utils/AppError';

// ─────────────────────────────────────────────
// POST /api/reserve
// Body: { eventId, seatIds[] }
// userId is taken from the verified JWT (req.user) — NOT from the request body
// ─────────────────────────────────────────────
export const createReservation = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    // userId comes from the authenticated JWT payload set by authenticate middleware
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const { eventId, seatIds } = req.body as {
      eventId: string;
      seatIds: string[];
    };

    const result = await reserveSeats({ userId, eventId, seatIds });

    sendSuccess(res, result, 201, 'Seats reserved successfully');
  }
);
