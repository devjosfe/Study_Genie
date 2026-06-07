/**
 * Rate Limiting — Redis-based per-user rate limits.
 *
 * ARUSH: Understand sliding window vs fixed window for interviews.
 *
 * This uses FIXED WINDOW with Redis INCR + TTL:
 *   - Key: `ratelimit:{userId}:{window}` (e.g., ratelimit:abc123:chat:1710000)
 *   - INCR the key on each request
 *   - If count > limit → reject with 429
 *   - Key auto-expires after window duration (TTL)
 *
 * Fixed window vs Sliding window:
 *   - Fixed: simpler, but allows burst at window boundary
 *     (e.g., 10 req at 11:59, 10 more at 12:00 = 20 in 1 minute)
 *   - Sliding: smoother, but more complex (sorted sets or token bucket)
 *   - We use fixed window — good enough for a study platform
 *
 * Interview answer:
 *   "I use Redis-based rate limiting with fixed windows. Each user gets
 *    a counter per time window (e.g., 20 chat calls per hour). Redis INCR
 *    increments the counter atomically, and TTL auto-expires the key.
 *    If the counter exceeds the limit, I return 429 with a Retry-After header."
 */

import type { Request, Response, NextFunction } from "express";
import { getRedis } from "../config/redis.js";

interface RateLimitConfig {
  windowMs: number;     // Window duration in milliseconds
  maxRequests: number;  // Max requests per window
  keyPrefix: string;    // Redis key prefix (e.g., "chat", "quiz", "upload")
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  chat: { windowMs: 60 * 60 * 1000, maxRequests: 30, keyPrefix: "chat" },       // 30/hour
  quiz: { windowMs: 60 * 60 * 1000, maxRequests: 10, keyPrefix: "quiz" },       // 10/hour
  interview: { windowMs: 60 * 60 * 1000, maxRequests: 10, keyPrefix: "interview" }, // 10/hour
  upload: { windowMs: 24 * 60 * 60 * 1000, maxRequests: 20, keyPrefix: "upload" }, // 20/day
};

export function rateLimit(type: keyof typeof RATE_LIMITS) {
  const config = RATE_LIMITS[type];

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.userId) {
      next();
      return;
    }

    try {
      const redis = getRedis();
      if (!redis) { next(); return; }
      const windowId = Math.floor(Date.now() / config.windowMs);
      const key = `ratelimit:${req.userId}:${config.keyPrefix}:${windowId}`;

      const count = await redis.incr(key);

      // Set TTL on first request in this window
      if (count === 1) {
        await redis.pexpire(key, config.windowMs);
      }

      // Set rate limit headers
      res.setHeader("X-RateLimit-Limit", config.maxRequests);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, config.maxRequests - count));

      if (count > config.maxRequests) {
        const retryAfterMs = config.windowMs - (Date.now() % config.windowMs);
        res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
        res.status(429).json({
          error: `Rate limit exceeded. Max ${config.maxRequests} ${type} requests per ${formatWindow(config.windowMs)}.`,
          retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
        });
        return;
      }

      next();
    } catch (error) {
      // If Redis fails, allow the request (fail open)
      console.error("[RateLimit] Redis error:", error);
      next();
    }
  };
}

function formatWindow(ms: number): string {
  if (ms >= 24 * 60 * 60 * 1000) return "day";
  if (ms >= 60 * 60 * 1000) return "hour";
  if (ms >= 60 * 1000) return "minute";
  return `${ms / 1000}s`;
}
