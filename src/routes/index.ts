import { Router } from 'express';
import authRoutes from './auth.routes';
import eventRoutes from './event.routes';
import reservationRoutes from './reservation.routes';
import bookingRoutes from './booking.routes';

const router = Router();

// Mount all route groups under /api
router.use('/auth', authRoutes);
router.use('/events', eventRoutes);
router.use('/reserve', reservationRoutes);
router.use('/bookings', bookingRoutes);

export default router;
