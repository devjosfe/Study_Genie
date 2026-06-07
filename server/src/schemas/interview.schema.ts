import { z } from "zod";

// ── Interview Session Schemas ────────────────────────────────────────
// These define the structured outputs for the mock interviewer agent.
//
// ARUSH: This is interview-critical. Understand every field.
//
// Interview answer:
//   "The mock interviewer uses 3 schemas: one for individual answer evaluation
//    (LLM-as-judge, score 1-5), one for the final session report
//    (InterviewResultSchema with topic scores and study recommendations),
//    and request validation schemas for the API."
//
// The agent uses generateText() with tools for the interactive loop,
// then generateObject() with InterviewResultSchema for the final summary.

/** Evaluation of a single interview answer (used by evaluateAnswer tool) */
export const InterviewAnswerEvalSchema = z.object({
  score: z.number().min(1).max(5).describe("1=wrong, 2=poor, 3=partial, 4=good, 5=excellent"),
  feedback: z.string().describe("Specific feedback on the answer"),
  coveredPoints: z.array(z.string()).describe("Key concepts correctly addressed"),
  missedPoints: z.array(z.string()).describe("Key concepts missed or incorrect"),
  confidence: z.enum(["low", "medium", "high"]).describe("How confident the student seemed"),
});

export type InterviewAnswerEval = z.infer<typeof InterviewAnswerEvalSchema>;

/** Final session report produced after all rounds */
export const InterviewResultSchema = z.object({
  overallScore: z.number().min(1).max(10).describe("Overall interview performance 1-10"),
  summary: z.string().describe("2-3 sentence summary of the interview performance"),
  questionsAsked: z.number().describe("Total questions asked during the session"),
  topicsAssessed: z.array(
    z.object({
      topic: z.string(),
      score: z.number().min(1).max(5),
      feedback: z.string(),
    })
  ).describe("Per-topic assessment"),
  strongAreas: z.array(z.string()).describe("Topics where the candidate did well"),
  weakAreas: z.array(z.string()).describe("Topics where the candidate struggled"),
  suggestedStudyTopics: z.array(z.string()).describe("Recommended topics to study next"),
  totalRounds: z.number().describe("Number of question-answer rounds completed"),
});

export type InterviewResult = z.infer<typeof InterviewResultSchema>;

// ── Request Validation Schemas ───────────────────────────────────────

export const startInterviewRequestSchema = z.object({
  documentIds: z.array(z.string()).min(1, "Select at least one document"),
  topic: z.string().optional().describe("Specific topic to focus on, or general if omitted"),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  numRounds: z.number().min(2).max(8).default(4),
});

export const answerInterviewRequestSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  answer: z.string().min(1, "Answer cannot be empty").max(4000),
});

export const endInterviewRequestSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
});

export type StartInterviewRequest = z.infer<typeof startInterviewRequestSchema>;
export type AnswerInterviewRequest = z.infer<typeof answerInterviewRequestSchema>;
