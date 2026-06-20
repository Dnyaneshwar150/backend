import jwt from "jsonwebtoken";
import { User, IUserDocument, UserRole } from "../models/User.model";
import { AppError } from "../utils/AppError";
import { config } from "../config/env";
import { AuthUser } from "../types/express.d";

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  adminSecret?: string; // Required when registering as admin
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
}

function generateToken(payload: AuthUser): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions["expiresIn"],
  });
}

function formatUser(user: IUserDocument): AuthResult["user"] {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const { name, email, password, role = "user", adminSecret } = input;

  // Basic field validation
  if (!name || !email || !password) {
    throw new AppError("Name, email and password are required", 400);
  }

  if (password.length < 6) {
    throw new AppError("Password must be at least 8 characters", 400);
  }

  // Email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AppError("Please provide a valid email address", 400);
  }

  // Admin creation requires a matching secret key
  if (role === "admin") {
    const expectedSecret = process.env["ADMIN_SECRET"];
    if (!expectedSecret || adminSecret !== expectedSecret) {
      throw new AppError(
        "Invalid admin secret. Admin accounts cannot be created without the correct secret.",
        403,
      );
    }
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new AppError("An account with this email already exists", 409);
  }

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    role,
  });

  const tokenPayload: AuthUser = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  const token = generateToken(tokenPayload);

  return { token, user: formatUser(user) };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const { email, password } = input;

  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+password",
  );

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.isActive) {
    throw new AppError(
      "Your account has been deactivated. Contact support.",
      403,
    );
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new AppError("Invalid email or password", 401);
  }

  const tokenPayload: AuthUser = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  const token = generateToken(tokenPayload);

  return { token, user: formatUser(user) };
}

export async function getProfile(userId: string): Promise<AuthResult["user"]> {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return formatUser(user);
}
