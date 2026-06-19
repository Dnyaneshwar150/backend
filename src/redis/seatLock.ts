import { getRedisClient } from './client';
import { config } from '../config/env';

// ─────────────────────────────────────────────
// Redis Key Builder
// ─────────────────────────────────────────────
export function buildSeatLockKey(eventId: string, seatId: string): string {
  return `seat:${eventId}:${seatId}`;
}

// ─────────────────────────────────────────────
// Acquire a single seat lock
// Returns true if lock was acquired, false if seat is already locked
// Uses SET NX EX — atomic operation
// ─────────────────────────────────────────────
export async function acquireSeatLock(
  eventId: string,
  seatId: string,
  userId: string
): Promise<boolean> {
  const client = getRedisClient();
  const key = buildSeatLockKey(eventId, seatId);
  const ttl = config.reservation.seatLockTTLSeconds;

  // SET key value EX ttl NX — only sets if key does not exist
  // ioredis v5: use the options object form for NX + EX
  const result = await client.set(key, userId, 'EX', ttl, 'NX');

  // 'OK' if set successfully, null if key already exists
  return result === 'OK';
}

// ─────────────────────────────────────────────
// Acquire locks for multiple seats atomically
// If any seat is already locked, releases all acquired locks and returns failure
// ─────────────────────────────────────────────
export async function acquireMultipleSeatLocks(
  eventId: string,
  seatIds: string[],
  userId: string
): Promise<{ success: boolean; failedSeatId?: string }> {
  const acquiredSeats: string[] = [];

  for (const seatId of seatIds) {
    const acquired = await acquireSeatLock(eventId, seatId, userId);

    if (!acquired) {
      // This seat is already locked — release all previously acquired locks
      await releaseMultipleSeatLocks(eventId, acquiredSeats);
      return { success: false, failedSeatId: seatId };
    }

    acquiredSeats.push(seatId);
  }

  return { success: true };
}

// ─────────────────────────────────────────────
// Release a single seat lock
// ─────────────────────────────────────────────
export async function releaseSeatLock(
  eventId: string,
  seatId: string
): Promise<void> {
  const client = getRedisClient();
  const key = buildSeatLockKey(eventId, seatId);
  await client.del(key);
}

// ─────────────────────────────────────────────
// Release locks for multiple seats
// ─────────────────────────────────────────────
export async function releaseMultipleSeatLocks(
  eventId: string,
  seatIds: string[]
): Promise<void> {
  if (seatIds.length === 0) return;

  const client = getRedisClient();
  const keys = seatIds.map((seatId) => buildSeatLockKey(eventId, seatId));

  // DEL accepts multiple keys — atomic batch delete
  await client.del(...keys);
}

// ─────────────────────────────────────────────
// Get the userId who holds a seat lock (null if not locked)
// ─────────────────────────────────────────────
export async function getSeatLockOwner(
  eventId: string,
  seatId: string
): Promise<string | null> {
  const client = getRedisClient();
  const key = buildSeatLockKey(eventId, seatId);
  return client.get(key);
}

// ─────────────────────────────────────────────
// Batch check which seats are locked using pipeline
// Returns a map of seatId -> locked (boolean)
// ─────────────────────────────────────────────
export async function checkMultipleSeatLocks(
  eventId: string,
  seatIds: string[]
): Promise<Map<string, boolean>> {
  const client = getRedisClient();
  const lockMap = new Map<string, boolean>();

  if (seatIds.length === 0) return lockMap;

  // Use pipeline for efficient batch GET
  const pipeline = client.pipeline();
  for (const seatId of seatIds) {
    pipeline.get(buildSeatLockKey(eventId, seatId));
  }

  const results = await pipeline.exec();

  if (!results) return lockMap;

  results.forEach(([err, value], index) => {
    const seatId = seatIds[index];
    if (err) {
      // On pipeline error treat seat as unlocked (fail open for reads)
      lockMap.set(seatId, false);
    } else {
      lockMap.set(seatId, value !== null);
    }
  });

  return lockMap;
}
