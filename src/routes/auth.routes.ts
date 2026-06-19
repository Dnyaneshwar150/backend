import { Router } from 'express';
import { registerUser, loginUser, getMe } from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

// POST /api/auth/register — sign up (user or admin with secret)
router.post('/register', registerUser);

// POST /api/auth/login — login for both user and admin
router.post('/login', loginUser);

// GET /api/auth/me — get current user profile (protected)
router.get('/me', authenticate, getMe);

export default router;
