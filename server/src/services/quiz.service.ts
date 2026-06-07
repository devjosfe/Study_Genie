import { generateObject } from "ai";
import { v4 as uuidv4 } from "uuid";
import { getModel } from "../config/providers.js";
import { retrieveChunks } from "../rag/retriever.js";
import { QuizSchema, QuizEvaluationSchema } from "../schemas/quiz.schema.js";
import { QuizResult } from "../models/QuizResult.js";
import type { Quiz, QuizEvaluation, GenerateQuizRequest } from "../schemas/quiz.schema.js";

/**
 * Quiz Service — generates quizzes from documents and evaluates answers.
 *
 * ARUSH: This is interview-critical. Study every line.
 *
 * Two core patterns:
 *   1. generateObject({ schema: QuizSchema }) — forces LLM to return structured quiz JSON
 *   2. generateObject({ schema: QuizEvaluationSchema }) — LLM-as-judge for open-ended scoring
 *
 * Interview answer:
 *   "generateObject() calls the LLM and forces it to return JSON matching a Zod schema.
 *    The SDK validates at runtime. If the LLM returns invalid JSON, it retries automatically.
 *    I use it for quiz generation (QuizSchema) and evaluation (QuizEvaluationSchema)."
 *
 * Break tests:
 *   - Set numQuestions to 50 → LLM struggles, output quality drops
 *   - Remove QuizSchema validation → get unpredictable JSON
 *   - Change difficulty to only "hard" → all questions are hard (no variety)
 *   - Set TOP_K to 1 in retriever → quiz covers narrow topic only
 *   - Remove explanation field from schema → LLM skips explanations
 */

// ── Quiz Generation ──────────────────────────────────────────────────

export async function generateQuiz(
  userId: string,
  input: GenerateQuizRequest
): Promise<{ quizId: string; quiz: Quiz }> {
  const traceId = uuidv4();
  const quizId = uuidv4();
  const startTime = Date.now();

  // 1. Retrieve relevant chunks from all selected documents
  //    We use a broad query to get diverse content for quiz material
  const chunks = await retrieveChunks(
    userId,
    "Generate a comprehensive quiz covering the main topics and key concepts",
    input.documentIds
  );

  if (chunks.length === 0) {
    throw new Error("No content found in the selected documents. Upload documents with more content.");
  }

  // 2. Build context from retrieved chunks
  const contextBlock = chunks
    .map((chunk, i) => `[Chunk ${i + 1}] (${chunk.filename})\n${chunk.text}`)
    .join("\n\n");

  // 3. Build the quiz generation prompt
  const difficultyInstruction =
    input.difficulty === "mixed"
      ? "Mix easy, medium, and hard questions"
      : `All questions should be ${input.difficulty} difficulty`;

  const typeInstruction = input.questionTypes.includes("mcq")
    ? "For MCQ questions, provide exactly 4 options."
    : "";

  const systemPrompt = `You are a quiz generator for study materials. Generate a quiz based on the provided context.

Rules:
1. Generate exactly ${input.numQuestions} questions
2. ${difficultyInstruction}
3. Question types to use: ${input.questionTypes.join(", ")}
4. ${typeInstruction}
5. Questions must be directly answerable from the context — do NOT ask about content not in the chunks
6. Each question must have a clear, unambiguous correct answer
7. Explanations should reference the source material
8. Cover different topics from the context (don't repeat the same concept)
9. For true_false questions, set correctAnswer to exactly "true" or "false"
10. Assign unique IDs: q1, q2, q3, etc.

Context:
---
${contextBlock}
---`;

  // 4. generateObject() — forces structured JSON output matching QuizSchema
  //
  // How it works under the hood:
  //   - Converts Zod schema to JSON Schema
  //   - Sends schema as tool definition or response_format to the LLM
  //   - LLM returns JSON, SDK validates against Zod
  //   - If validation fails, SDK retries with error feedback
  const { object: quiz } = await generateObject({
    model: getModel("groq"), // Gemini handles structured output better for quiz generation
    schema: QuizSchema,
    prompt: systemPrompt,
  });

  // 5. Save quiz to MongoDB (status: "generated" — not yet answered)
  await QuizResult.create({
    userId,
    quizId,
    documentIds: input.documentIds,
    questions: quiz.questions,
    totalQuestions: quiz.totalQuestions,
    difficulty: input.difficulty,
    status: "generated",
    topics: quiz.topics,
    estimatedTimeMinutes: quiz.estimatedTimeMinutes,
  });

  const latency = Date.now() - startTime;
  console.log(
    `[Quiz] traceId=${traceId} quizId=${quizId} questions=${quiz.questions.length} latency=${latency}ms`
  );

  return { quizId, quiz };
}

// ── Quiz Evaluation ──────────────────────────────────────────────────
// Two-strategy evaluation:
//   1. MCQ + True/False → exact match (no LLM call needed, but we still use LLM for feedback)
//   2. Open-ended → LLM-as-judge via generateObject()
//
// We send ALL answers to the LLM for evaluation to get consistent feedback
// and topic analysis, even for MCQ where we could do exact match.
//
// Why send MCQ to LLM too?
//   - Gets meaningful feedback explaining WHY the answer is wrong
//   - Consistent scoring format across all question types
//   - Topic strength/weakness analysis needs holistic view

export async function evaluateQuiz(
  userId: string,
  quizId: string,
  answers: Array<{ questionId: string; answer: string }>
): Promise<QuizEvaluation> {
  const traceId = uuidv4();
  const startTime = Date.now();

  // 1. Find the quiz
  const quizResult = await QuizResult.findOne({ quizId, userId });
  if (!quizResult) {
    throw new Error("Quiz not found");
  }

  if (quizResult.status === "completed") {
    throw new Error("Quiz has already been evaluated");
  }

  // 2. Build evaluation prompt with questions + student answers
  const qaBlock = quizResult.questions
    .map((q) => {
      const studentAnswer = answers.find((a) => a.questionId === q.id);
      return `Question ID: ${q.id}
Question (${q.type}, ${q.difficulty}): ${q.question}
Topic: ${q.topic}
Correct Answer: ${q.correctAnswer}
Student Answer: ${studentAnswer?.answer || "[NO ANSWER]"}
${q.type === "mcq" ? `Options: ${q.options?.join(", ")}` : ""}`;
    })
    .join("\n\n---\n\n");

  const systemPrompt = `You are a quiz evaluator. Score each answer and provide detailed feedback.

Scoring rules:
1. MCQ: score 5 if exact match with correct answer, score 0 if wrong
2. True/False: score 5 if matches correct answer (case-insensitive), score 0 if wrong
3. Open-ended: score 0-5 based on accuracy and completeness:
   - 0: No answer or completely irrelevant
   - 1: Wrong answer
   - 2: Partially wrong, shows some understanding
   - 3: Partially correct, misses key points
   - 4: Mostly correct, minor gaps
   - 5: Perfect or near-perfect answer
4. isCorrect: true if score >= 3, false otherwise
5. Identify specific key points covered and missed
6. Calculate overallScore as percentage: (sum of scores) / (totalQuestions * 5) * 100
7. Identify weak topics (scored < 3) and strong topics (scored >= 4)
8. Provide actionable overall feedback
9. Use the EXACT questionId values provided (e.g., q1, q2, q3) — do NOT invent new IDs

Student's answers:
---
${qaBlock}
---`;

  // 3. LLM-as-judge — second generateObject() call for evaluation
  const { object: evaluation } = await generateObject({
    model: getModel("groq"),
    schema: QuizEvaluationSchema,
    prompt: systemPrompt,
  });

  // 4. Update quiz result in MongoDB
  // Map by index (not questionId) because the LLM may generate different questionId formats
  quizResult.answers = quizResult.questions.map((q, i) => {
    const evalItem = evaluation.evaluations.find((e) => e.questionId === q.id) || evaluation.evaluations[i];
    const studentAnswer = answers.find((a) => a.questionId === q.id)?.answer || "[NO ANSWER]";
    return {
      questionId: q.id,
      userAnswer: studentAnswer,
      isCorrect: evalItem?.isCorrect ?? false,
      score: evalItem?.score ?? 0,
      feedback: evalItem?.feedback ?? "No feedback available",
      keyPointsCovered: evalItem?.keyPointsCovered ?? [],
      keyPointsMissed: evalItem?.keyPointsMissed ?? [],
    };
  });
  quizResult.overallScore = evaluation.overallScore;
  quizResult.totalCorrect = evaluation.totalCorrect;
  quizResult.weakTopics = evaluation.weakTopics;
  quizResult.strongTopics = evaluation.strongTopics;
  quizResult.overallFeedback = evaluation.overallFeedback;
  quizResult.status = "completed";
  quizResult.completedAt = new Date();
  await quizResult.save();

  const latency = Date.now() - startTime;
  console.log(
    `[Quiz Eval] traceId=${traceId} quizId=${quizId} score=${evaluation.overallScore}% latency=${latency}ms`
  );

  return evaluation;
}

// ── Quiz History ─────────────────────────────────────────────────────

export async function getQuizHistory(userId: string) {
  return QuizResult.find({ userId })
    .select("quizId documentIds overallScore totalCorrect totalQuestions difficulty status topics weakTopics strongTopics estimatedTimeMinutes createdAt completedAt")
    .sort({ createdAt: -1 })
    .limit(50);
}

export async function getQuizById(userId: string, quizId: string) {
  return QuizResult.findOne({ quizId, userId });
}
