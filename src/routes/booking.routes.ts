import { Router } from 'express';
import { createBooking } from '../controllers/booking.controller';
import { validateBookingRequest } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authenticate';

const router = Router();

// POST /api/bookings — authenticated users only
router.post('/', authenticate, authorize('user', 'admin'), validateBookingRequest, createBooking);

export default router;
