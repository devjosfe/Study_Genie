import mongoose, { type Document } from "mongoose";

export interface IInterviewRound {
  roundNumber: number;
  question: string;
  expectedKeyPoints: string[];
  userAnswer: string;
  score: number; // 1-5
  feedback: string;
  coveredPoints: string[];
  missedPoints: string[];
  confidence: "low" | "medium" | "high";
  isFollowUp: boolean;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  createdAt: Date;
}

export interface IInterviewSession extends Document {
  userId: string;
  sessionId: string;
  documentIds: string[];
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  maxRounds: number;
  currentRound: number;
  rounds: IInterviewRound[];
  status: "active" | "completed" | "abandoned";
  // Current question the user needs to answer
  pendingQuestion?: {
    question: string;
    expectedKeyPoints: string[];
    topic: string;
    difficulty: "easy" | "medium" | "hard";
    isFollowUp: boolean;
  };
  // Final results (filled when status -> completed)
  result?: {
    overallScore: number;
    summary: string;
    questionsAsked: number;
    topicsAssessed: Array<{ topic: string; score: number; feedback: string }>;
    strongAreas: string[];
    weakAreas: string[];
    suggestedStudyTopics: string[];
    totalRounds: number;
  };
  createdAt: Date;
  completedAt?: Date;
}

const interviewRoundSchema = new mongoose.Schema(
  {
    roundNumber: { type: Number, required: true },
    question: { type: String, required: true },
    expectedKeyPoints: [String],
    userAnswer: { type: String, required: true },
    score: { type: Number, required: true },
    feedback: { type: String, required: true },
    coveredPoints: [String],
    missedPoints: [String],
    confidence: { type: String, enum: ["low", "medium", "high"], required: true },
    isFollowUp: { type: Boolean, default: false },
    topic: { type: String, required: true },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const interviewSessionSchema = new mongoose.Schema<IInterviewSession>({
  userId: { type: String, required: true, index: true },
  sessionId: { type: String, required: true, unique: true },
  documentIds: [{ type: String, required: true }],
  topic: { type: String, default: "general" },
  difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
  maxRounds: { type: Number, default: 4 },
  currentRound: { type: Number, default: 0 },
  rounds: [interviewRoundSchema],
  status: { type: String, enum: ["active", "completed", "abandoned"], default: "active" },
  pendingQuestion: {
    type: new mongoose.Schema(
      {
        question: String,
        expectedKeyPoints: [String],
        topic: String,
        difficulty: { type: String, enum: ["easy", "medium", "hard"] },
        isFollowUp: Boolean,
      },
      { _id: false }
    ),
    default: undefined,
  },
  result: {
    type: new mongoose.Schema(
      {
        overallScore: Number,
        summary: String,
        questionsAsked: Number,
        topicsAssessed: [
          {
            topic: String,
            score: Number,
            feedback: String,
          },
        ],
        strongAreas: [String],
        weakAreas: [String],
        suggestedStudyTopics: [String],
        totalRounds: Number,
      },
      { _id: false }
    ),
    default: undefined,
  },
  createdAt: { type: Date, default: Date.now },
  completedAt: Date,
});

export const InterviewSession = mongoose.model<IInterviewSession>(
  "InterviewSession",
  interviewSessionSchema
);
