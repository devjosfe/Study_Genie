import { Router, type Request, type Response } from "express";
import { createDataStreamResponse } from "ai";
import { authenticate } from "../middleware/auth.js";
import { ragChat } from "../services/rag.service.js";
import { Conversation } from "../models/Conversation.js";

const router = Router();

// POST /api/chat — Streaming RAG chat
router.post("/", authenticate, async (req: Request, res: Response) => {
  console.log("[Chat] Request received:", { userId: req.userId, body: req.body });
  try {
    // Accept BOTH client shapes:
    //   pre-useChat:  { message: string,        documentIds, conversationId }
    //   useChat v4:   { messages: UIMessage[],  documentIds, conversationId }
    const { messages: chatMessages, message: singleMessage, documentIds, conversationId } = req.body;

    const lastUserMessage = chatMessages?.filter((m: { role: string }) => m.role === "user").pop();
    const messageFromParts = lastUserMessage?.parts
      ?.filter((p: { type: string }) => p.type === "text")
      .map((p: { text: string }) => p.text)
      .join("\n");
    const message: string | undefined =
      typeof singleMessage === "string" && singleMessage.length > 0
        ? singleMessage
        : typeof lastUserMessage?.content === "string" && lastUserMessage.content.length > 0
          ? lastUserMessage.content
          : messageFromParts;

    if (!message || typeof message !== "string" || message.length === 0) {
      res.status(400).json({ error: "Message cannot be empty" });
      return;
    }
    if (message.length > 4000) {
      res.status(400).json({ error: "Message too long" });
      return;
    }
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      res.status(400).json({ error: "Select at least one document" });
      return;
    }

    const result = await ragChat({
      userId: req.userId!,
      message,
      documentIds,
      conversationId,
    });

    // Use createDataStreamResponse to send stream + metadata annotations
    const response = createDataStreamResponse({
      execute: async (dataStream) => {
        // Send metadata as data stream annotations
        dataStream.writeMessageAnnotation({
          conversationId: result.conversationId,
          traceId: result.traceId,
          sources: result.sources,
        });

        // Merge the LLM stream into the data stream
        result.stream.mergeIntoDataStream(dataStream);
      },
    });

    // Pipe the Web Response to Express
    const webResponse = response as unknown as globalThis.Response;
    res.status(webResponse.status);
    webResponse.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    const body = webResponse.body;
    if (body) {
      const reader = body.getReader();
      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(value);
        return pump();
      };
      await pump();
    } else {
      res.end();
    }
  } catch (error) {
    console.error("Chat error:", error instanceof Error ? error.stack : error);
    if (!res.headersSent) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to process chat message" });
    }
  }
});

// GET /api/chat/conversations — List user's conversations
router.get("/conversations", authenticate, async (req: Request, res: Response) => {
  try {
    const conversations = await Conversation.find({ userId: req.userId })
      .select("title documentIds createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .limit(50);

    res.json(conversations);
  } catch (error) {
    console.error("List conversations error:", error);
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

// GET /api/chat/:conversationId/history — Get conversation messages
router.get("/:conversationId/history", authenticate, async (req: Request, res: Response) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      userId: req.userId,
    });

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    res.json({
      id: conversation._id,
      title: conversation.title,
      documentIds: conversation.documentIds,
      messages: conversation.messages,
    });
  } catch (error) {
    console.error("Get history error:", error);
    res.status(500).json({ error: "Failed to get conversation history" });
  }
});

// DELETE /api/chat/:conversationId — Delete a conversation
router.delete("/:conversationId", authenticate, async (req: Request, res: Response) => {
  try {
    const result = await Conversation.findOneAndDelete({
      _id: req.params.conversationId,
      userId: req.userId,
    });

    if (!result) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    res.json({ message: "Conversation deleted" });
  } catch (error) {
    console.error("Delete conversation error:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

export default router;
