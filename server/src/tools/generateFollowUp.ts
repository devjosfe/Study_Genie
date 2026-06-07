import { tool } from "ai";
import { z } from "zod";
import { generateObject } from "ai";
import { getModel } from "../config/providers.js";

/**
 * Tool: generateFollowUp
 *
 * ARUSH: This is what makes the interviewer "adaptive".
 *
 * Interview answer:
 *   "If the candidate scores low on a question, the agent calls
 *    generateFollowUp instead of moving to a new topic. It takes
 *    the missed key points and generates a targeted follow-up that
 *    probes deeper on the specific gap. This mimics how real
 *    interviewers drill down on weak areas."
 *
 * Why this matters:
 *   - Quiz = static questions (all generated upfront)
 *   - Mock interview = adaptive (next question depends on previous answer)
 *   - This tool is the key differentiator
 *
 * Break tests:
 *   - Never call this tool → interview becomes just a quiz
 *   - Always call this tool → never moves to new topics
 *   - Remove hint field → no scaffolding for struggling candidates
 */

const FollowUpOutputSchema = z.object({
  followUpQuestion: z.string().describe("A follow-up question probing the missed points"),
  expectedKeyPoints: z.array(z.string()).describe("Key points the follow-up answer should cover"),
  hint: z.string().describe("A subtle hint to guide the candidate without giving away the answer"),
  topic: z.string().describe("The topic this follow-up covers"),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export const generateFollowUpTool = tool({
  description:
    "Generate a follow-up question that probes deeper on weak points from the candidate's previous answer. Use this when the candidate scored poorly (1-3) to drill into their knowledge gap.",
  parameters: z.object({
    previousQuestion: z.string().describe("The question the candidate struggled with"),
    missedPoints: z.array(z.string()).describe("Key concepts the candidate missed"),
    difficulty: z.enum(["easy", "medium", "hard"]).describe("Difficulty for the follow-up"),
  }),
  execute: async ({ previousQuestion, missedPoints, difficulty }) => {
    const { object } = await generateObject({
      model: getModel("groq"),
      schema: FollowUpOutputSchema,
      prompt: `You are a technical interviewer following up on a weak answer.

Previous question: ${previousQuestion}

The candidate missed these key points:
${missedPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Generate a follow-up question that:
1. Targets the specific knowledge gap
2. Is at ${difficulty} difficulty
3. Gives the candidate another chance to demonstrate understanding
4. Is more specific/focused than the original question
5. Include a subtle hint that guides without giving the answer away

Example: If they missed "virtual DOM diffing", ask specifically about
"How does React decide which parts of the UI to re-render?"`,
    });

    return object;
  },
});
