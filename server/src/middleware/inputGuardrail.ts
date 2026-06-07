/**
 * Input Guardrail — prevents prompt injection and abuse.
 *
 * ARUSH: "How do you prevent prompt injection?" is a production-thinking question.
 *
 * Layers:
 *   1. Length check — reject absurdly long inputs
 *   2. Prompt injection patterns — regex for common attack patterns
 *   3. Spam detection — repeated characters, gibberish
 *
 * Interview answer:
 *   "I have a three-layer input guardrail. First, length validation to
 *    prevent token bombing. Second, regex patterns that detect common
 *    prompt injection phrases like 'ignore your instructions' or 'system
 *    prompt'. Third, spam detection for gibberish inputs. The guardrail
 *    runs as Express middleware before the request reaches the AI service."
 *
 * Why regex (not LLM-based detection)?
 *   - Zero latency (regex is microseconds, LLM call is seconds)
 *   - Catches obvious attacks cheaply
 *   - LLM-based detection can be added as a second layer for edge cases
 *
 * Break tests:
 *   - Send "ignore all previous instructions" → should be rejected
 *   - Send normal question → should pass through
 *   - Send 10,000 character input → should be rejected
 *   - Remove guardrail → injection attacks work
 */

import type { Request, Response, NextFunction } from "express";

// Prompt injection patterns (case-insensitive)
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /pretend\s+(you\s+are|to\s+be)\s+/i,
  /act\s+as\s+(a|an|if)\s+/i,
  /new\s+instructions?\s*:/i,
  /system\s*:\s*/i,
  /\[system\]/i,
  /\<\/?system\>/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /bypass\s+(safety|filter|guardrail)/i,
  /reveal\s+(your|the)\s+(system|initial)\s+(prompt|instructions)/i,
  /what\s+(are|is)\s+your\s+(system|initial)\s+(prompt|instructions)/i,
];

// Spam patterns
const SPAM_PATTERNS = [
  /(.)\1{20,}/,           // Same character repeated 20+ times
  /^[^a-zA-Z0-9]*$/,      // No alphanumeric characters at all
];

const MAX_INPUT_LENGTH = 4000;

export function inputGuardrail(field: string = "message") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const input = req.body?.[field];

    if (typeof input !== "string") {
      next();
      return;
    }

    // 1. Length check
    if (input.length > MAX_INPUT_LENGTH) {
      res.status(400).json({
        error: `Input too long. Maximum ${MAX_INPUT_LENGTH} characters.`,
      });
      return;
    }

    // 2. Prompt injection detection
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        console.warn(
          `[Guardrail] Blocked prompt injection from user ${req.userId}: "${input.slice(0, 100)}..."`
        );
        res.status(400).json({
          error: "Your message was flagged as potentially harmful. Please rephrase your question.",
        });
        return;
      }
    }

    // 3. Spam detection
    for (const pattern of SPAM_PATTERNS) {
      if (pattern.test(input)) {
        res.status(400).json({
          error: "Invalid input. Please enter a meaningful question.",
        });
        return;
      }
    }

    next();
  };
}
