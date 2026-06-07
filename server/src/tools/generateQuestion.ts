import { tool } from "ai";
import { z } from "zod";
import { generateObject } from "ai";
import { getModel } from "../config/providers.js";

/**
 * Tool: generateQuestion
 *
 * ARUSH: This is interview-critical. Study how tool() works.
 *
 * Interview answer:
 *   "Each tool has a description (tells the LLM when to call it),
 *    parameters (Zod schema the LLM fills), and an execute function
 *    (runs when the LLM calls the tool). The LLM reads all tool
 *    descriptions and decides which one to call based on the
 *    current conversation state."
 *
 * How it works:
 *   1. LLM sees this tool's description + parameter schema
 *   2. LLM decides to call it with { context, topic, difficulty, previousQuestions }
 *   3. execute() runs: builds a prompt, calls generateObject() to get a structured question
 *   4. Result is returned to the LLM, which sees it and decides next action
 *
 * Break tests:
 *   - Change description → LLM calls it at different times
 *   - Remove previousQuestions param → LLM repeats questions
 *   - Set difficulty to always "hard" → intimidating interview
 */

const QuestionOutputSchema = z.object({
  question: z.string().describe("The interview question to ask"),
  expectedKeyPoints: z.array(z.string()).describe("Key points a good answer should cover"),
  topic: z.string().describe("The topic this question covers"),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export const generateQuestionTool = tool({
  description:
    "Generate an interview question based on the candidate's resume/document content, topic, and difficulty level. Avoids repeating previous questions.",
  parameters: z.object({
    context: z.string().describe("Relevant text from resume or documents to base the question on"),
    topic: z.string().describe("Topic area to ask about"),
    difficulty: z.enum(["easy", "medium", "hard"]).describe("Question difficulty"),
    previousQuestions: z.array(z.string()).describe("Questions already asked, to avoid repetition"),
  }),
  execute: async ({ context, topic, difficulty, previousQuestions }) => {
    const previousList =
      previousQuestions.length > 0
        ? `\nAlready asked (DO NOT repeat):\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
        : "";

    const { object } = await generateObject({
      model: getModel("groq"),
      schema: QuestionOutputSchema,
      prompt: `You are a technical interviewer. Generate ONE interview question.

Topic: ${topic}
Difficulty: ${difficulty}
${previousList}

Context from candidate's documents:
---
${context}
---

Rules:
1. Question must be answerable from the context
2. For "easy": definition or explanation questions
3. For "medium": application or comparison questions
4. For "hard": design, trade-off, or debugging questions
5. Do NOT repeat any previously asked question
6. Be specific — reference concepts from the context`,
    });

    return object;
  },
});
