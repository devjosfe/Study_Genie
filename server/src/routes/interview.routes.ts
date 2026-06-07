import { Router, type Request, type Response } from "express";
import { authenticate } from "../middleware/auth.js";
import {
  startInterviewRequestSchema,
  answerInterviewRequestSchema,
  endInterviewRequestSchema,
} from "../schemas/interview.schema.js";
import {
  startSession,
  submitAnswer,
  endSession,
  getInterviewHistory,
  getSessionById,
} from "../services/interview.service.js";

const router = Router();

// POST /api/interview/start — Start a mock interview session
router.post("/start", authenticate, async (req: Request, res: Response) => {
  try {
    const parsed = startInterviewRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const result = await startSession(req.userId!, parsed.data);
    res.json(result);
  } catch (error) {
    console.error("Interview start error:", error);
    const message = error instanceof Error ? error.message : "Failed to start interview";
    res.status(500).json({ error: message });
  }
});

// POST /api/interview/answer — Submit an answer, get evaluation + next question
router.post("/answer", authenticate, async (req: Request, res: Response) => {
  try {
    const parsed = answerInterviewRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const result = await submitAnswer(req.userId!, parsed.data.sessionId, parsed.data.answer);
    res.json(result);
  } catch (error) {
    console.error("Interview answer error:", error);
    const message = error instanceof Error ? error.message : "Failed to process answer";
    res.status(500).json({ error: message });
  }
});

// POST /api/interview/end — End session early, get final report
router.post("/end", authenticate, async (req: Request, res: Response) => {
  try {
    const parsed = endInterviewRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const result = await endSession(req.userId!, parsed.data.sessionId);
    res.json(result);
  } catch (error) {
    console.error("Interview end error:", error);
    const message = error instanceof Error ? error.message : "Failed to end interview";
    res.status(500).json({ error: message });
  }
});

// GET /api/interview/history — Past interview sessions
router.get("/history", authenticate, async (req: Request, res: Response) => {
  try {
    const history = await getInterviewHistory(req.userId!);
    res.json(history);
  } catch (error) {
    console.error("Interview history error:", error);
    res.status(500).json({ error: "Failed to get interview history" });
  }
});

// GET /api/interview/:sessionId — Get a specific session
router.get("/:sessionId", authenticate, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const session = await getSessionById(req.userId!, sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(session);
  } catch (error) {
    console.error("Get session error:", error);
    res.status(500).json({ error: "Failed to get session" });
  }
});

export default router;
