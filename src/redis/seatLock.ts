import { getRedisClient } from "./client";
import { config } from "../config/env";

export function buildSeatLockKey(eventId: string, seatId: string): string {
  return `seat:${eventId}:${seatId}`;
}

export async function acquireSeatLock(
  eventId: string,
  seatId: string,
  userId: string,
): Promise<boolean> {
  const client = getRedisClient();
  const key = buildSeatLockKey(eventId, seatId);
  const ttl = config.reservation.seatLockTTLSeconds;

  const result = await client.set(key, userId, "EX", ttl, "NX");

  return result === "OK";
}

export async function acquireMultipleSeatLocks(
  eventId: string,
  seatIds: string[],
  userId: string,
): Promise<{ success: boolean; failedSeatId?: string }> {
  const acquiredSeats: string[] = [];

  for (const seatId of seatIds) {
    const acquired = await acquireSeatLock(eventId, seatId, userId);

    if (!acquired) {
      await releaseMultipleSeatLocks(eventId, acquiredSeats);
      return { success: false, failedSeatId: seatId };
    }

    acquiredSeats.push(seatId);
  }

  return { success: true };
}

export async function releaseSeatLock(
  eventId: string,
  seatId: string,
): Promise<void> {
  const client = getRedisClient();
  const key = buildSeatLockKey(eventId, seatId);
  await client.del(key);
}

export async function releaseMultipleSeatLocks(
  eventId: string,
  seatIds: string[],
): Promise<void> {
  if (seatIds.length === 0) return;

  const client = getRedisClient();
  const keys = seatIds.map((seatId) => buildSeatLockKey(eventId, seatId));

  await client.del(...keys);
}

export async function getSeatLockOwner(
  eventId: string,
  seatId: string,
): Promise<string | null> {
  const client = getRedisClient();
  const key = buildSeatLockKey(eventId, seatId);
  return client.get(key);
}

export async function checkMultipleSeatLocks(
  eventId: string,
  seatIds: string[],
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
      lockMap.set(seatId, false);
    } else {
      lockMap.set(seatId, value !== null);
    }
  });

  return lockMap;
}
