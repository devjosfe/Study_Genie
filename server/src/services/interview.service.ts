import { generateObject, generateText } from "ai";
import { v4 as uuidv4 } from "uuid";
import { getModel } from "../config/providers.js";
import { retrieveChunks } from "../rag/retriever.js";
import { InterviewAnswerEvalSchema, InterviewResultSchema } from "../schemas/interview.schema.js";
import { InterviewSession } from "../models/InterviewSession.js";
import type { StartInterviewRequest } from "../schemas/interview.schema.js";

/**
 * Interview Service — orchestrates the mock interviewer agent.
 *
 * ARUSH: This is the MOST interview-critical file. Study every function.
 *
 * Architecture decision: Turn-by-turn vs Single Agent Run
 *   We use TURN-BY-TURN interaction, not a single generateText({ tools, maxSteps: 8 }).
 *   Why? Because the user needs to type their answer between each question.
 *   The agent can't "wait" for user input mid-execution.
 *
 *   Flow:
 *     startSession() → generates first question, waits
 *     submitAnswer() → evaluates, generates next question, waits
 *     submitAnswer() → evaluates, generates next question, waits
 *     endSession()   → produces final structured report
 *
 *   Each call is a separate LLM invocation. The "agent loop" is spread
 *   across multiple HTTP requests, with state in MongoDB.
 *
 * Interview answer:
 *   "The mock interviewer is a multi-turn agent with 4 tools. But unlike a
 *    typical agent loop that runs to completion, mine is turn-by-turn —
 *    each HTTP request runs one step (generate question or evaluate answer),
 *    saves state to MongoDB, and waits for the user's response. This lets
 *    the user interact naturally while maintaining agent state across requests."
 *
 * Break tests:
 *   - Set maxRounds to 1 → only one question, weak analysis
 *   - Always follow up → never moves to new topics
 *   - Never follow up → misses depth on weak areas
 *   - Remove document context → generic questions, not personalized
 */

// ── Start Interview Session ──────────────────────────────────────────

export async function startSession(
  userId: string,
  input: StartInterviewRequest
): Promise<{ sessionId: string; question: string; topic: string; difficulty: string; hint?: string }> {
  const traceId = uuidv4();
  const sessionId = uuidv4();
  const startTime = Date.now();

  // 1. Retrieve context from documents
  const searchQuery = input.topic
    ? `Key concepts and details about ${input.topic}`
    : "Main topics, key concepts, and important details";

  const chunks = await retrieveChunks(userId, searchQuery, input.documentIds);

  if (chunks.length === 0) {
    throw new Error("No content found in the selected documents. Upload documents with more content.");
  }

  const contextBlock = chunks
    .map((c) => c.text)
    .join("\n\n");

  // 2. Generate first question
  const { object: questionData } = await generateObject({
    model: getModel("groq"),
    schema: questionOutputSchema,
    prompt: `You are a technical interviewer. Generate the FIRST interview question for a session.

Topic focus: ${input.topic || "general — cover the main topics from the context"}
Difficulty: ${input.difficulty}

Context from candidate's documents:
---
${contextBlock}
---

Rules:
1. Start with a foundational question to gauge baseline knowledge
2. Question must be answerable from the context
3. Be specific — reference concepts from the context
4. For "easy": ask a definition or explanation question
5. For "medium": ask about application or comparison
6. For "hard": ask about design, trade-offs, or problem-solving`,
  });

  // 3. Create session in MongoDB
  await InterviewSession.create({
    userId,
    sessionId,
    documentIds: input.documentIds,
    topic: input.topic || "general",
    difficulty: input.difficulty,
    maxRounds: input.numRounds,
    currentRound: 0,
    rounds: [],
    status: "active",
    pendingQuestion: {
      question: questionData.question,
      expectedKeyPoints: questionData.expectedKeyPoints,
      topic: questionData.topic,
      difficulty: questionData.difficulty,
      isFollowUp: false,
    },
  });

  const latency = Date.now() - startTime;
  console.log(`[Interview] traceId=${traceId} sessionId=${sessionId} action=start latency=${latency}ms`);

  return {
    sessionId,
    question: questionData.question,
    topic: questionData.topic,
    difficulty: questionData.difficulty,
  };
}

// ── Submit Answer ────────────────────────────────────────────────────
// This is where the "agent decision" happens each turn:
//   - Evaluate the answer
//   - If score <= 3 AND not already a follow-up → follow up on weak points
//   - If score > 3 OR already followed up → move to next topic
//   - If all rounds done → end session automatically

export async function submitAnswer(
  userId: string,
  sessionId: string,
  answer: string
): Promise<{
  evaluation: { score: number; feedback: string; coveredPoints: string[]; missedPoints: string[] };
  nextQuestion?: { question: string; topic: string; difficulty: string; isFollowUp: boolean; hint?: string };
  sessionComplete: boolean;
  result?: import("../schemas/interview.schema.js").InterviewResult;
}> {
  const traceId = uuidv4();
  const startTime = Date.now();

  // 1. Find active session
  const session = await InterviewSession.findOne({ sessionId, userId, status: "active" });
  if (!session) {
    throw new Error("Interview session not found or already completed");
  }

  if (!session.pendingQuestion) {
    throw new Error("No pending question to answer");
  }

  const pending = session.pendingQuestion;

  // 2. Evaluate the answer (LLM-as-judge)
  const { object: evaluation } = await generateObject({
    model: getModel("groq"),
    schema: InterviewAnswerEvalSchema,
    prompt: `You are evaluating an interview answer. Be fair but rigorous.

Question: ${pending.question}

Expected key points:
${pending.expectedKeyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Candidate's answer:
"${answer}"

Scoring guide:
1 = Wrong or completely irrelevant
2 = Shows some awareness but mostly incorrect
3 = Partially correct, misses important points
4 = Good answer, covers most key points
5 = Excellent, comprehensive answer

Be specific in feedback.`,
  });

  // 3. Save this round
  session.rounds.push({
    roundNumber: session.currentRound + 1,
    question: pending.question,
    expectedKeyPoints: pending.expectedKeyPoints,
    userAnswer: answer,
    score: evaluation.score,
    feedback: evaluation.feedback,
    coveredPoints: evaluation.coveredPoints,
    missedPoints: evaluation.missedPoints,
    confidence: evaluation.confidence,
    isFollowUp: pending.isFollowUp,
    topic: pending.topic,
    difficulty: pending.difficulty,
    createdAt: new Date(),
  });
  session.currentRound += 1;

  // 4. Agent decision: follow up, next topic, or end?
  const shouldEnd = session.currentRound >= session.maxRounds;
  const shouldFollowUp = evaluation.score <= 3 && !pending.isFollowUp && !shouldEnd;

  if (shouldEnd) {
    // Generate final report and end session
    const result = await generateSessionReport(session);
    session.status = "completed";
    session.result = result;
    session.pendingQuestion = undefined;
    session.completedAt = new Date();
    await session.save();

    const latency = Date.now() - startTime;
    console.log(`[Interview] traceId=${traceId} sessionId=${sessionId} action=complete rounds=${session.currentRound} score=${result.overallScore} latency=${latency}ms`);

    return {
      evaluation: {
        score: evaluation.score,
        feedback: evaluation.feedback,
        coveredPoints: evaluation.coveredPoints,
        missedPoints: evaluation.missedPoints,
      },
      sessionComplete: true,
      result,
    };
  }

  // 5. Generate next question
  let nextQuestion;

  if (shouldFollowUp) {
    // Follow up on weak points
    nextQuestion = await generateFollowUpQuestion(
      pending.question,
      evaluation.missedPoints,
      pending.difficulty
    );
  } else {
    // Move to next topic — search docs for new context
    const previousQuestions = session.rounds.map((r) => r.question);
    const previousTopics = [...new Set(session.rounds.map((r) => r.topic))];

    nextQuestion = await generateNextQuestion(
      userId,
      session.documentIds,
      session.topic,
      session.difficulty,
      previousQuestions,
      previousTopics
    );
  }

  // 6. Save pending question
  session.pendingQuestion = {
    question: nextQuestion.question,
    expectedKeyPoints: nextQuestion.expectedKeyPoints,
    topic: nextQuestion.topic,
    difficulty: nextQuestion.difficulty,
    isFollowUp: shouldFollowUp,
  };
  await session.save();

  const latency = Date.now() - startTime;
  console.log(`[Interview] traceId=${traceId} sessionId=${sessionId} action=answer round=${session.currentRound} score=${evaluation.score} followUp=${shouldFollowUp} latency=${latency}ms`);

  return {
    evaluation: {
      score: evaluation.score,
      feedback: evaluation.feedback,
      coveredPoints: evaluation.coveredPoints,
      missedPoints: evaluation.missedPoints,
    },
    nextQuestion: {
      question: nextQuestion.question,
      topic: nextQuestion.topic,
      difficulty: nextQuestion.difficulty,
      isFollowUp: shouldFollowUp,
      hint: nextQuestion.hint,
    },
    sessionComplete: false,
  };
}

// ── End Session Early ────────────────────────────────────────────────

export async function endSession(
  userId: string,
  sessionId: string
): Promise<import("../schemas/interview.schema.js").InterviewResult> {
  const session = await InterviewSession.findOne({ sessionId, userId, status: "active" });
  if (!session) {
    throw new Error("Interview session not found or already completed");
  }

  if (session.rounds.length === 0) {
    throw new Error("Cannot end session with no answered questions");
  }

  const result = await generateSessionReport(session);
  session.status = "completed";
  session.result = result;
  session.pendingQuestion = undefined;
  session.completedAt = new Date();
  await session.save();

  return result;
}

// ── Session History ──────────────────────────────────────────────────

export async function getInterviewHistory(userId: string) {
  return InterviewSession.find({ userId, status: "completed" })
    .select("sessionId topic difficulty currentRound result.overallScore result.strongAreas result.weakAreas createdAt completedAt")
    .sort({ createdAt: -1 })
    .limit(50);
}

export async function getSessionById(userId: string, sessionId: string) {
  return InterviewSession.findOne({ sessionId, userId });
}

// ── Helper: Generate Follow-Up Question ──────────────────────────────

async function generateFollowUpQuestion(
  previousQuestion: string,
  missedPoints: string[],
  difficulty: "easy" | "medium" | "hard"
) {
  const { object } = await generateObject({
    model: getModel("groq"),
    schema: questionWithHintSchema,
    prompt: `You are a technical interviewer following up on a weak answer.

Previous question: ${previousQuestion}

The candidate missed these key points:
${missedPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Generate a follow-up question that:
1. Targets the specific knowledge gap
2. Is at ${difficulty} difficulty
3. Gives the candidate another chance to demonstrate understanding
4. Is more specific/focused than the original question
5. Include a hint that guides without giving the answer`,
  });

  return object;
}

// ── Helper: Generate Next Question (new topic) ───────────────────────

async function generateNextQuestion(
  userId: string,
  documentIds: string[],
  topic: string,
  difficulty: "easy" | "medium" | "hard",
  previousQuestions: string[],
  previousTopics: string[]
) {
  // Search docs for new context
  const searchQuery = topic === "general"
    ? `Important concepts not about ${previousTopics.join(", ")}`
    : `Key concepts about ${topic}`;

  const chunks = await retrieveChunks(userId, searchQuery, documentIds);
  const contextBlock = chunks.map((c) => c.text).join("\n\n");

  const previousList = previousQuestions.length > 0
    ? `\nAlready asked (DO NOT repeat):\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
    : "";

  const { object } = await generateObject({
    model: getModel("groq"),
    schema: questionOutputSchema,
    prompt: `You are a technical interviewer. Generate the NEXT interview question.

Topic focus: ${topic}
Difficulty: ${difficulty}
${previousList}

Context from candidate's documents:
---
${contextBlock}
---

Rules:
1. Ask about a DIFFERENT concept than previous questions
2. Question must be answerable from the context
3. Be specific — reference concepts from the context
4. Vary question types (definition, comparison, application, design)`,
  });

  return { ...object, hint: undefined };
}

// ── Helper: Generate Session Report ──────────────────────────────────
// This is the final generateObject() call that produces the structured summary.

async function generateSessionReport(
  session: InstanceType<typeof InterviewSession>
): Promise<import("../schemas/interview.schema.js").InterviewResult> {
  const roundsSummary = session.rounds
    .map(
      (r, i) =>
        `Round ${i + 1} [${r.topic}, ${r.difficulty}${r.isFollowUp ? ", follow-up" : ""}]:
  Q: ${r.question}
  A: ${r.userAnswer}
  Score: ${r.score}/5 — ${r.feedback}`
    )
    .join("\n\n");

  const { object } = await generateObject({
    model: getModel("groq"),
    schema: InterviewResultSchema,
    prompt: `You are an interview evaluator. Produce a comprehensive session report.

Interview session (${session.rounds.length} rounds, ${session.difficulty} difficulty):
---
${roundsSummary}
---

Rules:
1. overallScore (1-10): weight harder questions and follow-ups more
2. Identify topics where the candidate consistently scored well (strong) or poorly (weak)
3. suggestedStudyTopics should be specific and actionable
4. summary should be 2-3 sentences capturing overall performance
5. Be encouraging but honest about gaps`,
  });

  return object;
}

// ── Shared Schemas (internal) ────────────────────────────────────────

import { z } from "zod";

const questionOutputSchema = z.object({
  question: z.string().describe("The interview question to ask"),
  expectedKeyPoints: z.array(z.string()).describe("Key points a good answer should cover"),
  topic: z.string().describe("The topic this question covers"),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

const questionWithHintSchema = z.object({
  question: z.string().describe("The follow-up question"),
  expectedKeyPoints: z.array(z.string()).describe("Key points the answer should cover"),
  hint: z.string().describe("A subtle hint to guide the candidate"),
  topic: z.string().describe("The topic this covers"),
  difficulty: z.enum(["easy", "medium", "hard"]),
});
