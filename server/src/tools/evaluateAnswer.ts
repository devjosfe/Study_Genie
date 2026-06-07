import { tool } from "ai";
import { z } from "zod";
import { generateObject } from "ai";
import { getModel } from "../config/providers.js";
import { InterviewAnswerEvalSchema } from "../schemas/interview.schema.js";

/**
 * Tool: evaluateAnswer
 *
 * ARUSH: This is interview-critical — LLM-as-judge for interviews.
 *
 * Interview answer:
 *   "evaluateAnswer uses LLM-as-judge. It takes the question, the user's
 *    answer, and the expected key points, then calls generateObject() to
 *    produce a structured evaluation: score 1-5, specific feedback, which
 *    key points were covered or missed, and confidence assessment."
 *
 * Why LLM-as-judge here (not regex)?
 *   - Interview answers are open-ended and can be phrased many ways
 *   - "Virtual DOM" and "in-memory representation of the UI" mean the same thing
 *   - Structured schema forces consistent scoring across answers
 *
 * Break tests:
 *   - Remove expectedKeyPoints → LLM scores more leniently (no reference)
 *   - Change score max from 5 to 3 → compressed range, less nuance
 *   - Remove confidence field → can't adapt difficulty based on confidence
 */

export const evaluateAnswerTool = tool({
  description:
    "Evaluate the candidate's answer against expected key points using LLM-as-judge. Returns score (1-5), feedback, covered/missed points, and confidence level.",
  parameters: z.object({
    question: z.string().describe("The question that was asked"),
    userAnswer: z.string().describe("The candidate's answer"),
    expectedKeyPoints: z.array(z.string()).describe("Key concepts a good answer should cover"),
  }),
  execute: async ({ question, userAnswer, expectedKeyPoints }) => {
    const { object } = await generateObject({
      model: getModel("groq"),
      schema: InterviewAnswerEvalSchema,
      prompt: `You are evaluating an interview answer. Be fair but rigorous.

Question: ${question}

Expected key points:
${expectedKeyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Candidate's answer:
"${userAnswer}"

Scoring guide:
1 = Wrong or completely irrelevant
2 = Shows some awareness but mostly incorrect
3 = Partially correct, misses important points
4 = Good answer, covers most key points
5 = Excellent, comprehensive answer

Be specific in feedback — mention what was good and what was missed.
Assess confidence based on answer clarity and specificity.`,
    });

    return object;
  },
});
