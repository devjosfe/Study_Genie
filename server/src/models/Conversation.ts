import mongoose, { type Document } from "mongoose";

export interface IMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    documentId: string;
    filename: string;
    chunkIndex: number;
    score: number;
    text: string;
  }>;
  createdAt: Date;
}

export interface IConversation extends Document {
  userId: string;
  title: string;
  documentIds: string[];
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new mongoose.Schema<IMessage>(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    sources: [
      {
        documentId: { type: String },
        filename: { type: String },
        chunkIndex: { type: Number },
        score: { type: Number },
        text: { type: String },
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema<IConversation>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New Conversation",
    },
    documentIds: [{ type: String }],
    messages: [messageSchema],
  },
  { timestamps: true }
);

export const Conversation = mongoose.model<IConversation>("Conversation", conversationSchema);
