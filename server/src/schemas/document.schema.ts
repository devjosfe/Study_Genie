import { z } from "zod";

export const uploadDocumentSchema = z.object({
  // File validated by multer, not Zod — this validates optional metadata
  tags: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").map((t) => t.trim()) : [])),
});

export const chatMessageSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(4000, "Message too long"),
  documentIds: z.array(z.string()).min(1, "Select at least one document"),
  conversationId: z.string().nullable().optional().transform((val) => val ?? undefined),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
