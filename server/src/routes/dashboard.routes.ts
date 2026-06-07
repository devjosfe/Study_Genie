import { Router, type Request, type Response } from "express";
import { authenticate } from "../middleware/auth.js";
import { DocumentModel } from "../models/Document.js";
import { QuizResult, type IQuizResult } from "../models/QuizResult.js";
import { InterviewSession, type IInterviewSession } from "../models/InterviewSession.js";

const router = Router();

// GET /api/dashboard/stats — User's overview stats
router.get("/stats", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const [documentCount, quizzes, interviews] = await Promise.all([
      DocumentModel.countDocuments({ userId, status: "ready" }),
      QuizResult.find({ userId, status: "completed" })
        .select("overallScore weakTopics strongTopics topics createdAt")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean<Pick<IQuizResult, "overallScore" | "weakTopics" | "strongTopics" | "topics" | "createdAt">[]>(),
      InterviewSession.find({ userId, status: "completed" })
        .select("result.overallScore result.weakAreas result.strongAreas topic createdAt")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean<Pick<IInterviewSession, "result" | "topic" | "createdAt">[]>(),
    ]);

    const quizCount = quizzes.length;
    const interviewCount = interviews.length;

    // Average scores
    const avgQuizScore = quizCount > 0
      ? Math.round(quizzes.reduce((sum: number, q) => sum + q.overallScore, 0) / quizCount)
      : 0;

    const avgInterviewScore = interviewCount > 0
      ? Math.round(
          interviews.reduce((sum: number, i) => sum + (i.result?.overallScore || 0), 0) / interviewCount * 10
        ) / 10
      : 0;

    // Aggregate weak/strong topics across quizzes and interviews
    const weakTopicCounts: Record<string, number> = {};
    const strongTopicCounts: Record<string, number> = {};

    for (const q of quizzes) {
      for (const t of q.weakTopics) { weakTopicCounts[t] = (weakTopicCounts[t] || 0) + 1; }
      for (const t of q.strongTopics) { strongTopicCounts[t] = (strongTopicCounts[t] || 0) + 1; }
    }
    for (const i of interviews) {
      for (const t of i.result?.weakAreas || []) { weakTopicCounts[t] = (weakTopicCounts[t] || 0) + 1; }
      for (const t of i.result?.strongAreas || []) { strongTopicCounts[t] = (strongTopicCounts[t] || 0) + 1; }
    }

    const topWeakTopics = Object.entries(weakTopicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => ({ topic, count }));

    const topStrongTopics = Object.entries(strongTopicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => ({ topic, count }));

    // Recent quiz scores for trend
    const recentQuizScores = quizzes
      .slice(0, 10)
      .reverse()
      .map((q) => ({ score: q.overallScore, date: q.createdAt }));

    res.json({
      documentCount,
      quizCount,
      interviewCount,
      avgQuizScore,
      avgInterviewScore,
      topWeakTopics,
      topStrongTopics,
      recentQuizScores,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: "Failed to get dashboard stats" });
  }
});

export default router;
