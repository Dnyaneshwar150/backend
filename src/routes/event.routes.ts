import { Router } from 'express';
import { getEvents, getEventDetails, createNewEvent } from '../controllers/event.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authenticate';

const router = Router();

// GET /api/events — public, no auth required
router.get('/', getEvents);

// GET /api/events/:id — public, no auth required
router.get('/:id', getEventDetails);

// POST /api/events — admin only: create a new event + auto-generate seats
router.post('/', authenticate, authorize('admin'), createNewEvent);

export default router;
