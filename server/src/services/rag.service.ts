import { streamText } from "ai";
import { v4 as uuidv4 } from "uuid";
import { getModel } from "../config/providers.js";
import { retrieveChunks } from "../rag/retriever.js";
import { buildRAGSystemPrompt, NO_CONTEXT_RESPONSE } from "../rag/prompts.js";
import { Conversation } from "../models/Conversation.js";

export interface RAGInput {
  userId: string;
  message: string;
  documentIds: string[];
  conversationId?: string;
}

export interface RAGResult {
  stream: ReturnType<typeof streamText>;
  conversationId: string;
  traceId: string;
  sources: Array<{
    documentId: string;
    filename: string;
    chunkIndex: number;
    score: number;
    text: string;
  }>;
}

/**
 * Full RAG pipeline:
 *   1. Retrieve relevant chunks from Qdrant
 *   2. Build system prompt with context
 *   3. Stream response via Groq (primary) with Gemini fallback
 *   4. Save conversation to MongoDB
 */
export async function ragChat(input: RAGInput): Promise<RAGResult> {
  const traceId = uuidv4();
  const startTime = Date.now();

  // 1. Retrieve relevant chunks
  const chunks = await retrieveChunks(input.userId, input.message, input.documentIds);

  // 2. Get or create conversation
  let conversation = input.conversationId
    ? await Conversation.findOne({ _id: input.conversationId, userId: input.userId })
    : null;

  if (!conversation) {
    conversation = await Conversation.create({
      userId: input.userId,
      title: input.message.slice(0, 80),
      documentIds: input.documentIds,
      messages: [],
    });
  }

  // Save user message
  conversation.messages.push({
    role: "user",
    content: input.message,
    createdAt: new Date(),
  });

  // 3. Build prompt and stream
  if (chunks.length === 0) {
    // No relevant chunks found — return fallback
    conversation.messages.push({
      role: "assistant",
      content: NO_CONTEXT_RESPONSE,
      sources: [],
      createdAt: new Date(),
    });
    await conversation.save();

    const fallbackStream = streamText({
      model: getModel("groq"),
      messages: [{ role: "assistant", content: NO_CONTEXT_RESPONSE }],
    });

    return {
      stream: fallbackStream,
      conversationId: conversation._id!.toString(),
      traceId,
      sources: [],
    };
  }

  const systemPrompt = buildRAGSystemPrompt(chunks);

  // Build message history (last 10 messages for context window management)
  const recentMessages = conversation.messages.slice(-10).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // 4. Stream via Groq (primary provider)
  const result = streamText({
    model: getModel("groq"),
    system: systemPrompt,
    messages: recentMessages,
  });

  // Map chunks to sources with documentId
  const sources = chunks.map((chunk) => ({
    documentId: "", // Qdrant payload doesn't include documentId in retriever output — added here for completeness
    filename: chunk.filename,
    chunkIndex: chunk.chunkIndex,
    score: chunk.score,
    text: chunk.text.slice(0, 200), // Truncate for response size
  }));

  // Save assistant message after stream completes (async)
  result.text.then(async (fullText) => {
    conversation!.messages.push({
      role: "assistant",
      content: fullText,
      sources,
      createdAt: new Date(),
    });
    await conversation!.save();

    const latency = Date.now() - startTime;
    console.log(
      `[RAG] traceId=${traceId} conversationId=${conversation!._id} chunks=${chunks.length} latency=${latency}ms`
    );
  }).catch((err) => {
    console.error(`[RAG] traceId=${traceId} stream error:`, err);
  });

  return {
    stream: result,
    conversationId: conversation._id!.toString(),
    traceId,
    sources,
  };
}
