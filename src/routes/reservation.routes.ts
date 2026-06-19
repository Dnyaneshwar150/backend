import { Router } from 'express';
import { createReservation } from '../controllers/reservation.controller';
import { validateReserveRequest } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authenticate';

const router = Router();

// POST /api/reserve — authenticated users only (not admins)
router.post('/', authenticate, authorize('user', 'admin'), validateReserveRequest, createReservation);

export default router;
