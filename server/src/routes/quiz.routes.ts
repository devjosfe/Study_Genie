import { Router, type Request, type Response } from "express";
import { authenticate } from "../middleware/auth.js";
import { generateQuizRequestSchema, evaluateQuizRequestSchema } from "../schemas/quiz.schema.js";
import { generateQuiz, evaluateQuiz, getQuizHistory, getQuizById } from "../services/quiz.service.js";

const router = Router();

// POST /api/quiz/generate — Generate quiz from documents
router.post("/generate", authenticate, async (req: Request, res: Response) => {
  try {
    const parsed = generateQuizRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { quizId, quiz } = await generateQuiz(req.userId!, parsed.data);

    res.json({
      quizId,
      questions: quiz.questions.map((q) => ({
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options,
        topic: q.topic,
        difficulty: q.difficulty,
        // NOTE: correctAnswer and explanation are NOT sent to the client
        // They're revealed after evaluation
      })),
      totalQuestions: quiz.totalQuestions,
      estimatedTimeMinutes: quiz.estimatedTimeMinutes,
      topics: quiz.topics,
    });
  } catch (error) {
    console.error("Quiz generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate quiz";
    res.status(500).json({ error: message });
  }
});

// POST /api/quiz/evaluate — Score quiz answers
router.post("/evaluate", authenticate, async (req: Request, res: Response) => {
  try {
    const parsed = evaluateQuizRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const evaluation = await evaluateQuiz(req.userId!, parsed.data.quizId, parsed.data.answers);

    res.json(evaluation);
  } catch (error) {
    console.error("Quiz evaluation error:", error);
    const message = error instanceof Error ? error.message : "Failed to evaluate quiz";
    res.status(500).json({ error: message });
  }
});

// GET /api/quiz/history — List past quiz attempts
router.get("/history", authenticate, async (req: Request, res: Response) => {
  try {
    const history = await getQuizHistory(req.userId!);
    res.json(history);
  } catch (error) {
    console.error("Quiz history error:", error);
    res.status(500).json({ error: "Failed to get quiz history" });
  }
});

// GET /api/quiz/:quizId — Get a specific quiz (with answers if completed)
router.get("/:quizId", authenticate, async (req: Request, res: Response) => {
  try {
    const quizId = req.params.quizId as string;
    const quiz = await getQuizById(req.userId!, quizId);
    if (!quiz) {
      res.status(404).json({ error: "Quiz not found" });
      return;
    }

    // If quiz is still "generated" (not yet answered), hide correct answers
    if (quiz.status === "generated") {
      res.json({
        quizId: quiz.quizId,
        status: quiz.status,
        difficulty: quiz.difficulty,
        topics: quiz.topics,
        estimatedTimeMinutes: quiz.estimatedTimeMinutes,
        totalQuestions: quiz.totalQuestions,
        questions: quiz.questions.map((q) => ({
          id: q.id,
          type: q.type,
          question: q.question,
          options: q.options,
          topic: q.topic,
          difficulty: q.difficulty,
        })),
      });
      return;
    }

    // Completed quiz — include everything
    res.json(quiz);
  } catch (error) {
    console.error("Get quiz error:", error);
    res.status(500).json({ error: "Failed to get quiz" });
  }
});

export default router;
