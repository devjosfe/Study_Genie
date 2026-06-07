/**
 * RAG Prompt Templates
 *
 * ARUSH: This is interview-critical. Rewrite this yourself.
 *
 * Key decisions to explain in interviews:
 *   1. "Only use provided context" → prevents hallucination
 *   2. Citation format [Source: filename, Chunk #N] → traceability
 *   3. "I don't have enough information" fallback → honesty over guessing
 *   4. Redirect to upload → guides user to fix the problem
 *
 * Interview answer:
 *   "My system prompt emphasizes citation rules and fallback behavior.
 *    It requires citing sources with document name and chunk index,
 *    prevents hallucination by refusing to answer without context,
 *    and redirects users to upload materials if their question is
 *    outside the knowledge base."
 */

export interface RetrievedChunk {
  text: string;
  filename: string;
  chunkIndex: number;
  score: number;
}

export function buildRAGSystemPrompt(chunks: RetrievedChunk[]): string {
  const contextBlock = chunks
    .map(
      (chunk, i) =>
        `[Chunk ${i + 1}] (filename: ${chunk.filename}, chunk #${chunk.chunkIndex}, relevance: ${chunk.score.toFixed(2)})\n${chunk.text}`
    )
    .join("\n\n");

  return `You are a helpful study assistant. Answer the user's question using ONLY the provided context.

Rules:
1. Only use information from the context below
2. If the context doesn't contain the answer, say "I don't have enough information in the uploaded documents to answer this question."
3. Cite your sources using [Source: filename] at the end of your answer — NOT inline
4. Be concise but thorough
5. If the user asks about something not in the documents, redirect them to upload relevant materials
6. Use markdown formatting for readability (headings, lists, bold for key terms)
7. NEVER include raw chunk text, chunk numbers, relevance scores, or metadata in your response — synthesize the information naturally
8. Do NOT quote the context verbatim — rephrase and explain in your own words

Context:
---
${contextBlock}
---`;
}

export const NO_CONTEXT_RESPONSE =
  "I don't have enough information in the uploaded documents to answer this question. Try uploading more relevant materials or rephrasing your question.";
