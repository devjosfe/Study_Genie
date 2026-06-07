import mongoose, { type Document as MongoDocument } from "mongoose";

export interface IDocument extends MongoDocument {
  userId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  originalSize: number;
  textContent: string;
  chunkCount: number;
  status: "processing" | "ready" | "error";
  errorMessage?: string;
  uploadedAt: Date;
}

const documentSchema = new mongoose.Schema<IDocument>({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  filename: {
    type: String,
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  originalSize: {
    type: Number,
    required: true,
  },
  textContent: {
    type: String,
    required: true,
  },
  chunkCount: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["processing", "ready", "error"],
    default: "processing",
  },
  errorMessage: {
    type: String,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

export const DocumentModel = mongoose.model<IDocument>("Document", documentSchema);
