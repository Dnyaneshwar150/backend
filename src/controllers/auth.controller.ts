import { Request, Response, NextFunction } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/apiResponse";
import { register, login, getProfile } from "../services/auth.service";

export const registerUser = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { name, email, password, role, adminSecret } = req.body as {
      name: string;
      email: string;
      password: string;
      role?: "admin" | "user";
      adminSecret?: string;
    };

    const result = await register({ name, email, password, role, adminSecret });

    sendSuccess(res, result, 201, "Account created successfully");
  },
);

export const loginUser = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { email, password } = req.body as {
      email: string;
      password: string;
    };

    const result = await login({ email, password });

    sendSuccess(res, result, 200, "Logged in successfully");
  },
);

export const getMe = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.user!.userId;
    const profile = await getProfile(userId);

    sendSuccess(res, profile, 200);
  },
);
