import Redis from "ioredis";
import { config } from "../config/env";

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      // Retry strategy: exponential backoff, give up after 10 retries
      retryStrategy: (times: number): number | null => {
        if (times > 10) {
          return null;
        }
        const delay = Math.min(times * 100, 3000);
        return delay;
      },

      // Disable auto-reconnect on certain errors
      reconnectOnError: (err: Error): boolean => {
        const targetErrors = ["READONLY", "ECONNRESET", "ECONNREFUSED"];
        return targetErrors.some((e) => err.message.includes(e));
      },
      lazyConnect: false,
    });

    redisClient.on("connect", () => {
      console.log("[Redis] Connected successfully");
    });

    redisClient.on("ready", () => {
      console.log("[Redis] Client ready to accept commands");
    });

    redisClient.on("error", (err: Error) => {
      console.error("[Redis] Client error:", err.message);
    });

    redisClient.on("close", () => {
      console.warn("[Redis] Connection closed");
    });

    redisClient.on("reconnecting", () => {
      console.log("[Redis] Reconnecting...");
    });

    console.log("REDIS CILENT", redisClient);
  }

  return redisClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log("[Redis] Connection closed gracefully");
  }
}
