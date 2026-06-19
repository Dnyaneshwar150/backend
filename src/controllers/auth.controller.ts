import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/apiResponse';
import { register, login, getProfile } from '../services/auth.service';

// ─────────────────────────────────────────────
// POST /api/auth/register
// Body: { name, email, password, role?, adminSecret? }
//
// role defaults to 'user'
// To create admin: pass role:'admin' + adminSecret matching ADMIN_SECRET env var
// ─────────────────────────────────────────────
export const registerUser = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { name, email, password, role, adminSecret } = req.body as {
      name: string;
      email: string;
      password: string;
      role?: 'admin' | 'user';
      adminSecret?: string;
    };

    const result = await register({ name, email, password, role, adminSecret });

    sendSuccess(res, result, 201, 'Account created successfully');
  }
);

// ─────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }
// Works for both admin and user — role is in the JWT
// ─────────────────────────────────────────────
export const loginUser = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { email, password } = req.body as {
      email: string;
      password: string;
    };

    const result = await login({ email, password });

    sendSuccess(res, result, 200, 'Logged in successfully');
  }
);

// ─────────────────────────────────────────────
// GET /api/auth/me
// Protected — requires valid JWT (authenticate middleware applied in route)
// Returns the currently logged-in user's profile
// ─────────────────────────────────────────────
export const getMe = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    // req.user is set by authenticate middleware
    const userId = req.user!.userId;
    const profile = await getProfile(userId);

    sendSuccess(res, profile, 200);
  }
);
