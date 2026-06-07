/**
 * Semantic Cache — caches LLM responses using Qdrant vector similarity.
 *
 * ARUSH: This is interview-critical. Understand the full flow.
 *
 * How it works:
 *   1. New query comes in → embed it (3072-dim vector)
 *   2. Search Qdrant `semantic_cache` collection for similar cached queries
 *   3. If top result score > 0.95 → cache HIT → return cached response
 *   4. If score < 0.95 → cache MISS → call LLM → upsert query + response to Qdrant
 *
 * Why Qdrant for cache (not Redis)?
 *   - Qdrant already handles cosine similarity internally with ANN indexing
 *   - No need to manually iterate + compute similarity (O(n) → O(log n))
 *   - Same infrastructure as document storage — no extra service to learn
 *   - Payload stores the cached response, sources, and metadata
 *
 * Why 0.95 threshold?
 *   - 0.99: too strict, only exact rephrases hit
 *   - 0.95: sweet spot, catches "What is React?" ≈ "Explain React to me"
 *   - 0.90: too loose, "What is React?" might match "What is Vue?"
 *   - 0.80: dangerously loose, returns wrong answers
 *
 * Interview answer:
 *   "I built a semantic cache using Qdrant. When a query comes in, I embed
 *    it and search a dedicated cache collection. If the top match has cosine
 *    similarity above 0.95, I return the cached response. On a miss, I call
 *    the LLM, then upsert the query embedding + response into Qdrant.
 *    I also wrote a cosine similarity function from scratch in a utility
 *    file to demonstrate understanding of the math."
 *
 * Break tests:
 *   - Set threshold to 0.5 → too many false cache hits (wrong answers)
 *   - Set threshold to 0.999 → almost never hits cache
 *   - Delete the cache collection → every query calls LLM (baseline)
 *   - Upsert with wrong dimension → Qdrant throws error
 */

import { v4 as uuidv4 } from "uuid";
import { getQdrant } from "../config/qdrant.js";
import { embedText } from "./embedding.service.js";

const CACHE_COLLECTION = "semantic_cache";
const SIMILARITY_THRESHOLD = 0.95;
const VECTOR_SIZE = 3072; // Gemini embedding-001

/**
 * Ensure the cache collection exists in Qdrant.
 */
async function ensureCacheCollection(): Promise<void> {
  const qdrant = getQdrant();
  try {
    await qdrant.getCollection(CACHE_COLLECTION);
  } catch {
    await qdrant.createCollection(CACHE_COLLECTION, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
    console.log(`[SemanticCache] Created Qdrant collection: ${CACHE_COLLECTION}`);
  }
}

/**
 * Look up semantic cache for a similar query.
 * Returns cached response if found, null otherwise.
 */
export async function getCachedResponse(
  userId: string,
  query: string,
  documentIds: string[]
): Promise<{ response: string; sources: string; cached: true } | null> {
  try {
    await ensureCacheCollection();
    const qdrant = getQdrant();
    const queryEmbedding = await embedText(query);

    // Search for similar cached queries, scoped to this user + document set
    const docKey = documentIds.sort().join(",");

    const results = await qdrant.search(CACHE_COLLECTION, {
      vector: queryEmbedding,
      limit: 1,
      score_threshold: SIMILARITY_THRESHOLD,
      filter: {
        must: [
          { key: "userId", match: { value: userId } },
          { key: "docKey", match: { value: docKey } },
        ],
      },
    });

    if (results.length === 0) return null;

    const hit = results[0];
    console.log(
      `[SemanticCache] HIT for "${query.slice(0, 50)}..." ` +
      `(similarity: ${hit.score.toFixed(4)}, matched: "${(hit.payload!.query as string).slice(0, 50)}...")`
    );

    return {
      response: hit.payload!.response as string,
      sources: hit.payload!.sources as string,
      cached: true,
    };
  } catch (error) {
    // Cache errors should never break the main flow
    console.error("[SemanticCache] Lookup error:", error);
    return null;
  }
}

/**
 * Store a query + response in the semantic cache.
 */
export async function setCachedResponse(
  userId: string,
  query: string,
  documentIds: string[],
  response: string,
  sources: string
): Promise<void> {
  try {
    await ensureCacheCollection();
    const qdrant = getQdrant();
    const queryEmbedding = await embedText(query);
    const docKey = documentIds.sort().join(",");

    await qdrant.upsert(CACHE_COLLECTION, {
      points: [
        {
          id: uuidv4(),
          vector: queryEmbedding,
          payload: {
            userId,
            docKey,
            query,
            response,
            sources,
            createdAt: new Date().toISOString(),
          },
        },
      ],
    });

    console.log(`[SemanticCache] STORED "${query.slice(0, 50)}..."`);
  } catch (error) {
    console.error("[SemanticCache] Store error:", error);
  }
}
