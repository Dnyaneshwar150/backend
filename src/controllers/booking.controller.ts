import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/apiResponse';
import { confirmBooking } from '../services/booking.service';

// ─────────────────────────────────────────────
// POST /api/bookings
// Body: { reservationId, paymentId }
// ─────────────────────────────────────────────
export const createBooking = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { reservationId, paymentId } = req.body as {
      reservationId: string;
      paymentId: string;
    };

    const result = await confirmBooking({ reservationId, paymentId });

    sendSuccess(res, result, 201, 'Booking confirmed successfully');
  }
);
