/**
 * Circuit Breaker — state machine for LLM provider failover.
 *
 * ARUSH: This is a system design interview classic. Draw the state diagram.
 *
 * State machine:
 *   CLOSED ──(3 failures)──> OPEN ──(60s cooldown)──> HALF_OPEN
 *     ▲                                                  │
 *     │                                                  │
 *     └──────────(test succeeds)─────────────────────────┘
 *     ┌──────────(test fails)────────────────────────────┘
 *     ▼
 *   OPEN (back to open, restart cooldown)
 *
 * States:
 *   CLOSED    → Normal. Requests go through. Count failures.
 *   OPEN      → Circuit tripped. All requests fail fast (no LLM call).
 *   HALF_OPEN → Cooldown expired. Allow ONE test request through.
 *               If it succeeds → CLOSED. If it fails → OPEN again.
 *
 * Why circuit breaker?
 *   - If Groq is down, don't keep sending requests (wastes time + money)
 *   - Fail fast → user gets error immediately, not after 30s timeout
 *   - HALF_OPEN allows automatic recovery when the service comes back
 *
 * Interview answer:
 *   "I implement a circuit breaker for LLM provider failover. If Groq
 *    fails 3 times, the circuit opens and requests fail fast. After 60s,
 *    it enters half-open state and sends one test request. If that succeeds,
 *    the circuit closes and normal operation resumes. This prevents
 *    cascading failures and allows automatic recovery."
 *
 * Break tests:
 *   - Set FAILURE_THRESHOLD to 1 → opens on first failure (too aggressive)
 *   - Set COOLDOWN_MS to 5000 → recovers too fast, might hammer a down service
 *   - Set FAILURE_THRESHOLD to 100 → never opens (useless)
 *   - Manually call trip() → verify it fails fast
 */

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerOptions {
  failureThreshold: number;  // failures before opening
  cooldownMs: number;        // time before half-open
  name: string;              // for logging
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 3,
  cooldownMs: 60_000, // 60 seconds
  name: "default",
};

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Execute a function with circuit breaker protection.
   * If circuit is OPEN, throws immediately without calling fn.
   * If HALF_OPEN, allows one test call.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      // Check if cooldown has expired
      if (Date.now() - this.lastFailureTime >= this.options.cooldownMs) {
        this.state = "HALF_OPEN";
        console.log(`[CircuitBreaker:${this.options.name}] OPEN → HALF_OPEN (cooldown expired)`);
      } else {
        throw new Error(
          `Circuit breaker is OPEN for ${this.options.name}. ` +
          `Retry after ${Math.ceil((this.options.cooldownMs - (Date.now() - this.lastFailureTime)) / 1000)}s`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      console.log(`[CircuitBreaker:${this.options.name}] HALF_OPEN → CLOSED (test succeeded)`);
    }
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      // Test request failed — go back to OPEN
      this.state = "OPEN";
      console.log(`[CircuitBreaker:${this.options.name}] HALF_OPEN → OPEN (test failed)`);
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.state = "OPEN";
      console.log(
        `[CircuitBreaker:${this.options.name}] CLOSED → OPEN ` +
        `(${this.failureCount} failures, threshold: ${this.options.failureThreshold})`
      );
    }
  }

  /** Get current state (for observability/debugging) */
  getState(): { state: CircuitState; failureCount: number } {
    return { state: this.state, failureCount: this.failureCount };
  }

  /** Manually reset to CLOSED (for admin use) */
  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    console.log(`[CircuitBreaker:${this.options.name}] Manually reset to CLOSED`);
  }
}

// Pre-configured instances for LLM providers
export const groqCircuitBreaker = new CircuitBreaker({ name: "groq", failureThreshold: 3, cooldownMs: 60_000 });
export const geminiCircuitBreaker = new CircuitBreaker({ name: "gemini", failureThreshold: 3, cooldownMs: 60_000 });
