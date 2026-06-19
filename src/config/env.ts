import dotenv from 'dotenv';

dotenv.config();

// Helper to get a required env variable — throws at startup if missing
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[Config] Missing required environment variable: ${key}`);
  }
  return value;
}

// Helper to get an optional env variable with a fallback
function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

// Helper to parse a numeric env variable
function requireEnvInt(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`[Config] Environment variable ${key} must be a valid integer, got: "${value}"`);
  }
  return parsed;
}

// ─────────────────────────────────────────────
// Exported Config Object (validated at startup)
// ─────────────────────────────────────────────
export const config = {
  server: {
    port: requireEnvInt('PORT', 3000),
    nodeEnv: optionalEnv('NODE_ENV', 'development'),
    isDevelopment: optionalEnv('NODE_ENV', 'development') === 'development',
    isProduction: optionalEnv('NODE_ENV', 'development') === 'production',
  },

  mongodb: {
    uri: requireEnv('MONGODB_URI'),
  },

  redis: {
    host: optionalEnv('REDIS_HOST', 'localhost'),
    port: requireEnvInt('REDIS_PORT', 6379),
    password: optionalEnv('REDIS_PASSWORD', '') || undefined,
  },

  reservation: {
    seatLockTTLSeconds: requireEnvInt('SEAT_LOCK_TTL_SECONDS', 600),
    expiryMinutes: requireEnvInt('RESERVATION_EXPIRY_MINUTES', 10),
  },

  jwt: {
    secret: requireEnv('JWT_SECRET'),
    expiresIn: optionalEnv('JWT_EXPIRES_IN', '7d'),
  },
} as const;
