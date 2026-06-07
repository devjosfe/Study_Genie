import { tool } from "ai";
import { z } from "zod";
import { retrieveChunks } from "../rag/retriever.js";

/**
 * Tool: searchDocs
 *
 * ARUSH: This reuses the RAG retriever from Phase 2.
 *
 * Interview answer:
 *   "The searchDocs tool reuses the same retriever from the RAG chat feature.
 *    It embeds a query, searches Qdrant for relevant chunks, and returns
 *    context the agent can use to form better questions. This demonstrates
 *    code reuse — the same retrieval pipeline serves chat, quiz, and
 *    mock interviews."
 *
 * Why the agent needs this:
 *   - generateQuestion needs context from the user's documents
 *   - The agent decides WHAT to search for based on conversation history
 *   - Different from RAG chat where the user's message IS the query
 *
 * Break tests:
 *   - Remove this tool → agent generates generic questions (no document context)
 *   - Make it always return empty → agent says "I can't find relevant content"
 */

export const searchDocsTool = tool({
  description:
    "Search the candidate's uploaded documents for relevant context. Use this to find content about a specific topic before generating questions. Returns relevant text chunks.",
  parameters: z.object({
    query: z.string().describe("Search query to find relevant document content"),
    userId: z.string().describe("The user ID to search documents for"),
    documentIds: z.array(z.string()).describe("Document IDs to search within"),
  }),
  execute: async ({ query, userId, documentIds }) => {
    const chunks = await retrieveChunks(userId, query, documentIds);

    if (chunks.length === 0) {
      return { relevantChunks: [], message: "No relevant content found for this query." };
    }

    return {
      relevantChunks: chunks.map((c) => ({
        text: c.text,
        filename: c.filename,
        score: c.score,
      })),
    };
  },
});
