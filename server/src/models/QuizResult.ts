import mongoose, { type Document } from "mongoose";

export interface IQuizQuestion {
  id: string;
  type: "mcq" | "true_false" | "open_ended";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface IQuizAnswer {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  score: number; // 0-5 for open-ended, 0 or 5 for MCQ/T-F
  feedback: string;
  keyPointsCovered: string[];
  keyPointsMissed: string[];
}

export interface IQuizResult extends Document {
  userId: string;
  quizId: string;
  documentIds: string[];
  questions: IQuizQuestion[];
  answers: IQuizAnswer[];
  overallScore: number; // percentage 0-100
  totalCorrect: number;
  totalQuestions: number;
  weakTopics: string[];
  strongTopics: string[];
  overallFeedback: string;
  difficulty: "easy" | "medium" | "hard" | "mixed";
  status: "generated" | "completed";
  topics: string[];
  estimatedTimeMinutes: number;
  completedAt?: Date;
  createdAt: Date;
}

const quizQuestionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ["mcq", "true_false", "open_ended"], required: true },
    question: { type: String, required: true },
    options: [String],
    correctAnswer: { type: String, required: true },
    explanation: { type: String, required: true },
    topic: { type: String, required: true },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
  },
  { _id: false }
);

const quizAnswerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    userAnswer: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
    score: { type: Number, required: true },
    feedback: { type: String, required: true },
    keyPointsCovered: [String],
    keyPointsMissed: [String],
  },
  { _id: false }
);

const quizResultSchema = new mongoose.Schema<IQuizResult>({
  userId: { type: String, required: true, index: true },
  quizId: { type: String, required: true, unique: true },
  documentIds: [{ type: String, required: true }],
  questions: [quizQuestionSchema],
  answers: [quizAnswerSchema],
  overallScore: { type: Number, default: 0 },
  totalCorrect: { type: Number, default: 0 },
  totalQuestions: { type: Number, required: true },
  weakTopics: [String],
  strongTopics: [String],
  overallFeedback: { type: String, default: "" },
  difficulty: { type: String, enum: ["easy", "medium", "hard", "mixed"], required: true },
  status: { type: String, enum: ["generated", "completed"], default: "generated" },
  topics: [String],
  estimatedTimeMinutes: { type: Number, default: 5 },
  completedAt: Date,
  createdAt: { type: Date, default: Date.now },
});

export const QuizResult = mongoose.model<IQuizResult>("QuizResult", quizResultSchema);
