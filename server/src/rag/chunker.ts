import { v4 as uuidv4 } from "uuid";

/**
 * Chunk — a piece of a document.
 */
export interface Chunk {
  id: string;
  text: string;
  index: number;
  tokenCount: number;
}

/**
 * Recursive character text splitter.
 *
 * ARUSH: This is interview-critical. Rewrite this yourself.
 *
 * Strategy: Try separators in order of preference:
 *   1. "\n\n" (paragraph breaks) — best, keeps paragraphs intact
 *   2. "\n"   (line breaks)      — good, preserves lines
 *   3. ". "   (sentences)        — okay, keeps sentences
 *   4. " "    (words)            — last resort
 *
 * Parameters:
 *   - chunkSize:  500 tokens (~2000 chars). Sweet spot for RAG retrieval.
 *   - overlap:    50 tokens (~200 chars, 10%). Prevents context loss at boundaries.
 *
 * Why these numbers?
 *   - 50 tokens  → too small, fragments context
 *   - 2000 tokens → too large, dilutes relevance
 *   - 500 tokens  → sweet spot
 *   - 50 overlap   → if a concept spans two chunks, both contain it
 *
 * Break tests you MUST run:
 *   - Change chunkSize to 50   → retrieval degrades
 *   - Change chunkSize to 2000 → relevance dilutes
 *   - Set overlap to 0         → context loss at boundaries
 *   - Only split on " "        → fragmented sentences
 */

const CHUNK_SIZE = 2000; // ~500 tokens (rough 4:1 char-to-token ratio)
const CHUNK_OVERLAP = 200; // ~50 tokens
const SEPARATORS = ["\n\n", "\n", ". ", " "];

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitBySeparator(text: string, separator: string): string[] {
  const parts = text.split(separator);
  // Re-attach the separator to each part (except the last)
  return parts.map((part, i) => (i < parts.length - 1 ? part + separator : part)).filter((p) => p.length > 0);
}

function recursiveSplit(text: string, separatorIndex: number = 0): string[] {
  // Base case: text is small enough
  if (text.length <= CHUNK_SIZE) {
    return [text];
  }

  // If we've exhausted all separators, force-split by character count
  if (separatorIndex >= SEPARATORS.length) {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
      chunks.push(text.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
  }

  const separator = SEPARATORS[separatorIndex];
  const parts = splitBySeparator(text, separator);

  // If separator didn't split anything, try next separator
  if (parts.length <= 1) {
    return recursiveSplit(text, separatorIndex + 1);
  }

  // Merge small parts into chunks of target size
  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    if (current.length + part.length > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim());
      // Keep overlap from end of current chunk
      const overlapText = current.slice(-CHUNK_OVERLAP);
      current = overlapText + part;
    } else {
      current += part;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  // Recursively split any chunks that are still too large
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length > CHUNK_SIZE) {
      result.push(...recursiveSplit(chunk, separatorIndex + 1));
    } else {
      result.push(chunk);
    }
  }

  return result;
}

export function chunkText(text: string): Chunk[] {
  const rawChunks = recursiveSplit(text);

  return rawChunks
    .filter((text) => text.trim().length > 0)
    .map((text, index) => ({
      id: uuidv4(),
      text: text.trim(),
      index,
      tokenCount: estimateTokens(text),
    }));
}
