import { Redis } from "ioredis";

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn("REDIS_URL not set — rate limiting disabled");
    return null;
  }

  redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > 3) return null;
      return Math.min(times * 200, 2000);
    },
  });

  redis.on("connect", () => console.log("Redis connected successfully"));
  redis.on("error", (err: Error) => console.error("Redis connection error:", err));

  return redis;
}
