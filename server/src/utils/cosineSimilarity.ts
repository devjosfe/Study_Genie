/**
 * Cosine Similarity — written from scratch, no libraries.
 *
 * ARUSH: This is a GUARANTEED interview question. Know the math.
 *
 * Formula:
 *   similarity = (A · B) / (||A|| × ||B||)
 *
 * Where:
 *   A · B = Σ(aᵢ × bᵢ)          → dot product
 *   ||A|| = √(Σ(aᵢ²))            → magnitude (L2 norm)
 *
 * Range: -1 to 1
 *   1.0  = identical direction (same meaning)
 *   0.0  = orthogonal (unrelated)
 *   -1.0 = opposite direction (opposite meaning, rare with embeddings)
 *
 * Why cosine over Euclidean distance?
 *   - Cosine measures ANGLE between vectors (direction = meaning)
 *   - Euclidean measures DISTANCE (affected by magnitude)
 *   - Two documents about "React hooks" should be similar even if
 *     one is much longer (different magnitude, same direction)
 *
 * Interview answer:
 *   "Cosine similarity measures the angle between two embedding vectors.
 *    I use it for semantic cache lookup — if a new query has cosine
 *    similarity > 0.95 with a cached query, I return the cached response
 *    instead of calling the LLM again. I wrote the function from scratch:
 *    dot product divided by product of magnitudes."
 *
 * Break tests:
 *   - Pass identical vectors → should return exactly 1.0
 *   - Pass zero vector → should handle gracefully (return 0)
 *   - Pass very similar vectors (0.98) → understand this is "almost identical"
 *   - Pass unrelated vectors (0.1) → understand this is "different meaning"
 */

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  // Handle zero vectors (avoid division by zero)
  if (magnitudeA === 0 || magnitudeB === 0) return 0;

  return dotProduct / (magnitudeA * magnitudeB);
}
