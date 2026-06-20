import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { AppError } from "../utils/AppError";
import { AuthUser } from "../types/express.d";

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("Access denied. No token provided.", 401));
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return next(
      new AppError("Access denied. Malformed authorization header.", 401),
    );
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as AuthUser;

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AppError("Session expired. Please log in again.", 401));
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return next(new AppError("Invalid token. Please log in again.", 401));
    }
    next(err);
  }
}

export function authorize(...allowedRoles: Array<"admin" | "user">) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError("Access denied. Not authenticated.", 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied. This action requires one of the following roles: ${allowedRoles.join(
            ", ",
          )}`,
          403,
        ),
      );
    }

    next();
  };
}
