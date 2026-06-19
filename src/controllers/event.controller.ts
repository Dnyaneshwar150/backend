import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/apiResponse';
import { getAllEvents, getEventById, createEvent } from '../services/event.service';

// ─────────────────────────────────────────────
// GET /api/events
// Returns list of all events
// ─────────────────────────────────────────────
export const getEvents = catchAsync(
  async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const events = await getAllEvents();
    sendSuccess(res, events, 200);
  }
);

// ─────────────────────────────────────────────
// GET /api/events/:id
// Returns event details + seats with real-time availability (Redis overlay)
// ─────────────────────────────────────────────
export const getEventDetails = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const id = req.params['id'] as string;
    const result = await getEventById(id);
    sendSuccess(res, result, 200);
  }
);

// ─────────────────────────────────────────────
// POST /api/events
// Admin only — creates an event and auto-generates all seats from seatConfig
// Protected by: authenticate + authorize('admin')
// ─────────────────────────────────────────────
export const createNewEvent = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { name, venue, date, seatConfig } = req.body as {
      name: string;
      venue: string;
      date: string;
      seatConfig: object;
    };

    const result = await createEvent({ name, venue, date, seatConfig: seatConfig as never });

    sendSuccess(
      res,
      {
        event: result.event,
        seatsCreated: result.seatsCreated,
      },
      201,
      `Event created successfully with ${result.seatsCreated} seats`
    );
  }
);
