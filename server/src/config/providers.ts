import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Groq uses OpenAI-compatible API
const groq = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export type Provider = "groq" | "gemini";

export function getModel(provider: Provider = "groq") {
  switch (provider) {
    case "groq":
      return groq("llama-3.3-70b-versatile");
    case "gemini":
      return google("gemini-2.0-flash");
    default:
      return groq("llama-3.3-70b-versatile");
  }
}

export function getEmbeddingModel() {
  return google.textEmbeddingModel("gemini-embedding-001");
}
