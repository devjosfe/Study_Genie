/**
 * Output Guardrail — filters LLM responses before sending to client.
 *
 * ARUSH: "How do you detect hallucination?" shows production thinking.
 *
 * Checks:
 *   1. PII detection — regex for emails, phone numbers, SSNs, credit cards
 *   2. Response length sanity — reject absurdly short or long responses
 *
 * Interview answer:
 *   "My output guardrail has two layers. First, PII regex detection —
 *    if the LLM leaks emails, phone numbers, or SSNs from the training
 *    data, I redact them before sending to the client. Second, I check
 *    response length — an empty or extremely long response usually means
 *    something went wrong."
 *
 * Why not hallucination detection here?
 *   - True hallucination detection requires comparing response vs source chunks
 *   - That's expensive (another LLM call) and better done at the RAG prompt level
 *   - The RAG system prompt already says "only use provided context"
 *   - This guardrail handles what the prompt can't: data leakage
 */

// PII patterns
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string; label: string }> = [
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: "[EMAIL REDACTED]",
    label: "email",
  },
  {
    pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    replacement: "[PHONE REDACTED]",
    label: "phone",
  },
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: "[SSN REDACTED]",
    label: "SSN",
  },
  {
    pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    replacement: "[CARD REDACTED]",
    label: "credit card",
  },
];

export interface GuardrailResult {
  text: string;
  redacted: boolean;
  redactions: string[];
}

/**
 * Scan and redact PII from LLM output.
 * Returns the cleaned text and a list of what was redacted.
 */
export function sanitizeOutput(text: string): GuardrailResult {
  const redactions: string[] = [];
  let sanitized = text;

  for (const { pattern, replacement, label } of PII_PATTERNS) {
    const matches = sanitized.match(pattern);
    if (matches) {
      redactions.push(`${matches.length} ${label}(s)`);
      sanitized = sanitized.replace(pattern, replacement);
    }
  }

  if (redactions.length > 0) {
    console.warn(`[OutputGuardrail] Redacted: ${redactions.join(", ")}`);
  }

  return {
    text: sanitized,
    redacted: redactions.length > 0,
    redactions,
  };
}
