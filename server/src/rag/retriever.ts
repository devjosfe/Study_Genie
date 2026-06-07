import { getQdrant } from "../config/qdrant.js";
import { embedText } from "../services/embedding.service.js";
import type { RetrievedChunk } from "./prompts.js";

/**
 * Retriever — semantic search over user's document chunks.
 *
 * ARUSH: This is interview-critical. Rewrite this yourself.
 *
 * Flow:
 *   1. Embed the user's query (3072-dim vector via Gemini)
 *   2. Search Qdrant for top-K (5) similar chunks
 *   3. Filter: discard chunks with cosine similarity < 0.3
 *
 * Why top-5?
 *   - Top-1: too little context, misses info
 *   - Top-10: too much noise, dilutes relevance
 *   - Top-5: sweet spot for most queries
 *
 * Why 0.3 threshold?
 *   - Below 0.3 = chunk is barely related
 *   - Prevents hallucination by refusing to answer with weak matches
 *
 * Break tests you MUST run:
 *   - Set threshold to 0.9 → everything rejected
 *   - Set threshold to 0.0 → irrelevant results
 *   - Change top-K from 5 to 10 → noise increases
 *   - Change top-K from 5 to 1 → context loss
 */

const TOP_K = 5;
const SIMILARITY_THRESHOLD = 0.3;

export async function retrieveChunks(
  userId: string,
  query: string,
  documentIds: string[]
): Promise<RetrievedChunk[]> {
  const collectionName = `user_${userId}_docs`;

  // 1. Embed the query
  const queryEmbedding = await embedText(query);

  // 2. Search Qdrant
  const qdrant = getQdrant();

  const results = await qdrant.search(collectionName, {
    vector: queryEmbedding,
    limit: TOP_K,
    filter: {
      must: [
        {
          key: "documentId",
          match: {
            any: documentIds,
          },
        },
      ],
    },
  });

  // 3. Filter by similarity threshold
  const filtered = results
    .filter((r) => r.score >= SIMILARITY_THRESHOLD)
    .map((r) => ({
      text: r.payload!.text as string,
      filename: r.payload!.filename as string,
      chunkIndex: r.payload!.chunkIndex as number,
      score: r.score,
    }));

  return filtered;
}
