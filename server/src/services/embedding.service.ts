import { embed, embedMany as aiEmbedMany } from "ai";
import { getEmbeddingModel } from "../config/providers.js";

/**
 * Embed a single text string into a 3072-dim vector.
 * Uses Gemini embedding-001 via Vercel AI SDK.
 */
export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: getEmbeddingModel(),
    value: text,
  });
  return embedding;
}

/**
 * Embed multiple text strings in batch.
 * Returns an array of 3072-dim vectors, one per input.
 */
export async function embedMany(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const { embeddings } = await aiEmbedMany({
    model: getEmbeddingModel(),
    values: texts,
  });
  return embeddings;
}
