import jwt from 'jsonwebtoken';
import { User, IUserDocument, UserRole } from '../models/User.model';
import { AppError } from '../utils/AppError';
import { config } from '../config/env';
import { AuthUser } from '../types/express.d';

// ─────────────────────────────────────────────
// Input / Output Types
// ─────────────────────────────────────────────

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;           // Only used for admin creation with secret
  adminSecret?: string;      // Required when registering as admin
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

// ─────────────────────────────────────────────
// Generate JWT Token
// ─────────────────────────────────────────────
function generateToken(payload: AuthUser): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

// ─────────────────────────────────────────────
// Format user for response (strips sensitive fields)
// ─────────────────────────────────────────────
function formatUser(user: IUserDocument): AuthResult['user'] {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

// ─────────────────────────────────────────────
// Register
//
// - Normal users: POST /api/auth/register
// - Admins: POST /api/auth/register with role:'admin' + correct adminSecret
// ─────────────────────────────────────────────
export async function register(input: RegisterInput): Promise<AuthResult> {
  const { name, email, password, role = 'user', adminSecret } = input;

  // Basic field validation
  if (!name || !email || !password) {
    throw new AppError('Name, email and password are required', 400);
  }

  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  // Email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AppError('Please provide a valid email address', 400);
  }

  // Admin creation requires a matching secret key
  if (role === 'admin') {
    const expectedSecret = process.env['ADMIN_SECRET'];
    if (!expectedSecret || adminSecret !== expectedSecret) {
      throw new AppError('Invalid admin secret. Admin accounts cannot be created without the correct secret.', 403);
    }
  }

  // Check if email already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new AppError('An account with this email already exists', 409);
  }

  // Create user — password hashed by pre-save hook in User model
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

// ─────────────────────────────────────────────
// Login
// Works for both admin and user — role is embedded in JWT
// ─────────────────────────────────────────────
export async function login(input: LoginInput): Promise<AuthResult> {
  const { email, password } = input;

  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  // Explicitly select password (excluded by default via select:false in schema)
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user) {
    // Generic message — don't reveal whether email exists
    throw new AppError('Invalid email or password', 401);
  }

  if (!user.isActive) {
    throw new AppError('Your account has been deactivated. Contact support.', 403);
  }

  // Compare plain password against stored plain-text password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  const tokenPayload: AuthUser = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  const token = generateToken(tokenPayload);

  return { token, user: formatUser(user) };
}

// ─────────────────────────────────────────────
// Get current logged-in user profile
// ─────────────────────────────────────────────
export async function getProfile(userId: string): Promise<AuthResult['user']> {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return formatUser(user);
}
