# StudyGenie

**AI-powered study platform with streaming RAG chat, adaptive mock interviews, and structured quiz evaluation.**

Upload your documents, and StudyGenie helps you learn from them — ask questions with cited answers, take AI-generated quizzes with LLM-as-judge scoring, or practice with an adaptive mock interviewer that follows up on your weak points.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, Tailwind CSS 4, shadcn/ui, Motion |
| Backend | Express 5, TypeScript |
| AI | Vercel AI SDK v6, Groq (Llama 3.3 70B), Gemini (embeddings) |
| Auth | Better Auth (cookie-based sessions) |
| Payments | Polar (hosted checkout, subscriptions) |
| Database | MongoDB Atlas |
| Vector DB | Qdrant Cloud (3072-dim, cosine distance) |
| Cache | Upstash Redis |

---

## Features

- **RAG Chat with Citations** — Upload PDFs/markdown/text, ask questions, get streaming answers grounded in your documents with source citations
- **AI Quiz Generator** — MCQ, true/false, and open-ended quizzes from your material. Open-ended answers scored using LLM-as-judge (1-5 scale)
- **Adaptive Mock Interviewer** — Turn-by-turn agent that evaluates answers, follows up on weak points (score <= 3), and generates structured session reports
- **Dashboard** — Quiz scores, interview performance, weak/strong topics, score trends
- **Semantic Caching** — Qdrant-based similarity lookup to skip redundant LLM calls
- **Circuit Breaker** — Auto-failover from Groq to Gemini after consecutive failures
- **Rate Limiting** — Redis fixed-window counters per user per feature
- **Input/Output Guardrails** — Prompt injection detection + PII redaction
- **Observability** — traceId on every LLM call with token counts, latency, cost estimates

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CLIENT (React 19 + Vite 6)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ RAG Chat │  │ AI Quiz  │  │  Mock    │  │    Dashboard      │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│  ┌────┴──────────────┴─────────────┴──────────────────┴──────────┐  │
│  │              Vercel AI SDK / fetch + SSE streaming             │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────────┘
                              │ HTTP / SSE
┌─────────────────────────────┼───────────────────────────────────────┐
│                         SERVER (Express 5)                          │
│  ┌───────────────────────────┴────────────────────────────────────┐  │
│  │  cookieParser → auth → rateLimit → inputGuardrail → routes    │  │
│  └───────────────────────────┬────────────────────────────────────┘  │
│  ┌───────────┐  ┌────────────┴───────────┐  ┌───────────────────┐  │
│  │  RAG      │  │   AI Services          │  │  Interview Agent  │  │
│  │  Pipeline │  │  streamText()          │  │  (4 tools,        │  │
│  │  embed →  │  │  generateObject()      │  │   turn-by-turn)   │  │
│  │  retrieve │  │  embed() / embedMany() │  │                   │  │
│  │  → prompt │  │                        │  │                   │  │
│  └─────┬─────┘  └────────────┬───────────┘  └────────┬──────────┘  │
│  ┌─────┴─────────────────────┴────────────────────────┴──────────┐  │
│  │  Semantic Cache │ Circuit Breaker │ Output Guardrail │ Logger │  │
│  └───────────────────────────┬────────────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────────┘
          ┌────────────────────┼────────────────────┐
   ┌──────┴──────┐   ┌────────┴───────┐   ┌───────┴───────┐
   │  MongoDB    │   │  Qdrant Cloud  │   │ Upstash Redis │
   │  Atlas      │   │  (Vectors +    │   │  (Rate Limit  │
   │             │   │   Sem. Cache)  │   │   Counters)   │
   └─────────────┘   └────────────────┘   └───────────────┘
```

---

## Local Setup

```bash
# Server
cd server
npm install
npm run dev

# Client (separate terminal)
cd client
npm install
npm run dev
```

Requires `.env` files in both `server/` and `client/` with API keys for Groq, Gemini, MongoDB Atlas, Qdrant Cloud, Upstash Redis, Better Auth, and Polar.
