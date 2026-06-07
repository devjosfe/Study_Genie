import { Link } from "react-router";
import { motion, useInView } from "motion/react";
import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  HelpCircle,
  Mic,
  Sun,
  Moon,
  Upload,
  Zap,
  Shield,
  ArrowRight,
  Sparkles,
  BarChart3,
  Brain,
  FileText,
  GitBranch,
  Scissors,
  Binary,
  Search,
  Radio,
  ChevronRight,
  Quote,
  Target,
  TrendingUp,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTheme } from "../hooks/useTheme.js";
import FeatureDemo, { type DemoMessage } from "@/components/landing/FeatureDemo";

/* ───────────── data ───────────── */

const features = [
  {
    icon: MessageSquare,
    title: "RAG Chat",
    description:
      "Upload documents and chat with your study materials. AI-powered answers grounded in your content with source citations.",
    gradient: "from-blue-500 to-cyan-500",
    glow: "group-hover/card:shadow-blue-500/10",
  },
  {
    icon: HelpCircle,
    title: "AI Quiz Generator",
    description:
      "Auto-generate MCQ, true/false, and open-ended quizzes. LLM-as-judge evaluates nuanced answers beyond right/wrong.",
    gradient: "from-purple-500 to-pink-500",
    glow: "group-hover/card:shadow-purple-500/10",
  },
  {
    icon: Mic,
    title: "Mock Interviewer",
    description:
      "Upload your resume and get grilled by AI. Adaptive follow-ups probe weak answers. Full session analysis with study recommendations.",
    gradient: "from-orange-500 to-red-500",
    glow: "group-hover/card:shadow-orange-500/10",
  },
];

const featureDemos: Record<string, { title: string; placeholder: string; messages: DemoMessage[] }> = {
  chat: {
    title: "StudyGenie — RAG Chat",
    placeholder: "Ask about your documents...",
    messages: [
      { role: "system", text: "lecture-notes.pdf uploaded — 12 chunks indexed", delay: 600 },
      { role: "user", text: "What is the difference between supervised and unsupervised learning?", delay: 1200 },
      {
        role: "assistant",
        text: "Supervised learning uses labeled training data where each example has an input-output pair. The model learns to map inputs to known outputs. Unsupervised learning works with unlabeled data, finding hidden patterns like clusters or associations on its own.",
        citation: "Source: lecture-notes.pdf, Chunk #4",
        delay: 800,
      },
    ],
  },
  quiz: {
    title: "StudyGenie — AI Quiz",
    placeholder: "Select documents to generate quiz...",
    messages: [
      { role: "system", text: "Generating 5 questions from ml-fundamentals.pdf...", delay: 600 },
      {
        role: "assistant",
        text: "Q1 (MCQ): Which algorithm is best suited for classification tasks with linearly separable data?\n\nA) K-Means\nB) Linear Regression\nC) Support Vector Machine\nD) PCA",
        delay: 1000,
      },
      { role: "user", text: "C) Support Vector Machine", delay: 1500 },
      {
        role: "score",
        text: "Correct! SVMs find the optimal hyperplane that maximizes the margin between classes. They work especially well when data is linearly separable.",
        scoreValue: "1/1 — Topic: Classification",
        delay: 600,
      },
    ],
  },
  interview: {
    title: "StudyGenie — Mock Interview",
    placeholder: "Answer the interviewer...",
    messages: [
      { role: "system", text: "resume.pdf uploaded — starting interview session", delay: 600 },
      {
        role: "assistant",
        text: "I see you've worked with React and Express. Can you explain how you handle state management in a large React application?",
        delay: 1000,
      },
      { role: "user", text: "I use React Context for global state like auth and theme, and local useState for component-specific data. For server state I'd use React Query.", delay: 1800 },
      {
        role: "score",
        text: "Good answer — you covered local vs global state and mentioned server state. Follow-up: You didn't mention when Context becomes insufficient. What would you do if Context causes unnecessary re-renders across 50+ components?",
        scoreValue: "3/5 — Probe deeper on performance",
        delay: 600,
      },
    ],
  },
};

const highlights = [
  { icon: Upload, label: "PDF, TXT, Markdown" },
  { icon: Zap, label: "Streaming SSE" },
  { icon: Shield, label: "Guardrails" },
  { icon: Sparkles, label: "Semantic Cache" },
  { icon: BarChart3, label: "Progress Tracking" },
];

const pipelineSteps = [
  { icon: Upload, label: "Upload", detail: "PDF / TXT / MD", color: "text-blue-500" },
  { icon: Scissors, label: "Chunk", detail: "500 tokens, overlap", color: "text-cyan-500" },
  { icon: Binary, label: "Embed", detail: "3072-dim vectors", color: "text-violet-500" },
  { icon: Search, label: "Retrieve", detail: "Top-5 cosine sim", color: "text-purple-500" },
  { icon: Radio, label: "Stream", detail: "SSE to client", color: "text-pink-500" },
];

const stats = [
  { value: 3, suffix: "", label: "AI-powered tools" },
  { value: 3072, suffix: "", label: "Dimension embeddings" },
  { value: 500, suffix: "", label: "Token smart chunks" },
  { value: 5, suffix: "+", label: "File formats supported" },
];

const demoTabs = [
  { key: "chat", label: "RAG Chat", icon: MessageSquare },
  { key: "quiz", label: "Quiz", icon: HelpCircle },
  { key: "interview", label: "Interview", icon: Mic },
] as const;

/* ───────────── animated counter ───────────── */

function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1800;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(eased * value));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, value]);

  return (
    <span ref={ref}>
      {display.toLocaleString()}{suffix}
    </span>
  );
}

/* ───────────── page ───────────── */

export default function HomePage() {
  const { theme, toggleTheme } = useTheme();
  const [activeDemo, setActiveDemo] = useState<string>("chat");

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* ── Mesh Gradient Background ── */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-[40%] -left-[20%] w-[70vw] h-[70vh] rounded-full blur-[160px] opacity-[0.06] dark:opacity-[0.08]"
          style={{
            background: "oklch(0.55 0.25 263)",
            animation: "mesh-drift-1 25s ease-in-out infinite",
          }}
        />
        <div
          className="absolute -bottom-[30%] -right-[15%] w-[60vw] h-[60vh] rounded-full blur-[140px] opacity-[0.04] dark:opacity-[0.06]"
          style={{
            background: "oklch(0.65 0.18 300)",
            animation: "mesh-drift-2 30s ease-in-out infinite",
          }}
        />
        <div
          className="absolute top-[30%] right-[5%] w-[45vw] h-[45vh] rounded-full blur-[130px] opacity-[0.03] dark:opacity-[0.05]"
          style={{
            background: "oklch(0.60 0.20 200)",
            animation: "mesh-drift-3 22s ease-in-out infinite",
          }}
        />
      </div>

      {/* ── Navigation ── */}
      <nav className="relative z-20 flex items-center justify-between px-6 sm:px-12 py-5">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2"
        >
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-chart-3 to-chart-1 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-bold">StudyGenie</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2"
        >
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/login">Sign In</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/register">Get Started</Link>
          </Button>
        </motion.div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 flex flex-col items-center px-6 pt-16 sm:pt-24 pb-8">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="mb-6"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 backdrop-blur-sm px-4 py-1.5 text-sm text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chart-3 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-chart-3" />
            </span>
            Powered by RAG + Agentic AI
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-center text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-5 max-w-4xl"
        >
          Upload your notes.
          <br />
          <span className="bg-gradient-to-r from-chart-3 via-chart-2 to-chart-1 bg-clip-text text-transparent">
            Ask anything.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center text-lg sm:text-xl text-muted-foreground max-w-xl mb-10 leading-relaxed"
        >
          Chat with your documents, generate quizzes, and get grilled by an AI
          interviewer that reads your resume — all with streaming responses and
          citations.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="flex flex-col sm:flex-row gap-3 mb-16"
        >
          <Button asChild size="lg" className="text-base px-8 h-12 group">
            <Link to="/register">
              Start Studying
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="text-base px-8 h-12">
            <Link to="/login">Sign In</Link>
          </Button>
        </motion.div>
      </section>

      {/* ── Tabbed Feature Demos ── */}
      <section className="relative z-10 max-w-2xl mx-auto px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Tab buttons */}
          <div className="flex justify-center gap-1 mb-4 p-1 rounded-lg bg-muted/50 backdrop-blur-sm w-fit mx-auto">
            {demoTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveDemo(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeDemo === tab.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active demo */}
          <FeatureDemo
            title={featureDemos[activeDemo].title}
            messages={featureDemos[activeDemo].messages}
            placeholder={featureDemos[activeDemo].placeholder}
          />
        </motion.div>
      </section>

      {/* ── Stats Strip ── */}
      <section className="relative z-10 py-16 border-y border-border/20">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div className="text-3xl sm:text-4xl font-bold text-foreground mb-1 tabular-nums">
                <AnimatedCounter value={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">
            Three tools, one platform
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            RAG chat for understanding, quizzes for testing, mock interviews for
            proving you know it. All grounded in your documents.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.5,
                delay: index * 0.12,
                ease: [0.16, 1, 0.3, 1],
              }}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className="group/card"
            >
              <Card className={`relative h-full border-border/50 bg-card/80 backdrop-blur-sm hover:border-chart-3/30 transition-all duration-300 hover:shadow-xl ${feature.glow}`}>
                <div
                  className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${feature.gradient} opacity-0 group-hover/card:opacity-60 transition-opacity duration-300`}
                />
                <CardHeader className="space-y-3 p-6">
                  <div
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${feature.gradient} text-white shadow-lg`}
                  >
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── RAG Pipeline ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">
            From document to answer
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Every response traces back to your source material through a 5-step RAG pipeline.
          </p>
        </motion.div>

        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0">
          {/* Connecting line (desktop) */}
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="hidden sm:block absolute top-1/2 left-[10%] right-[10%] h-px bg-gradient-to-r from-blue-500/30 via-violet-500/30 to-pink-500/30 origin-left"
          />

          {pipelineSteps.map((step, i) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.5,
                delay: 0.15 + i * 0.12,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="relative z-10 flex flex-col items-center text-center"
            >
              <div className="h-14 w-14 rounded-xl border border-border/50 bg-card/90 backdrop-blur-sm flex items-center justify-center mb-3 shadow-lg">
                <step.icon className={`h-6 w-6 ${step.color}`} />
              </div>
              <span className="text-sm font-semibold mb-0.5">{step.label}</span>
              <span className="text-xs text-muted-foreground">{step.detail}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How it Works ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-8 sm:p-12"
        >
          <h3 className="text-2xl sm:text-3xl font-bold mb-10 text-center">
            How it works
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {[
              {
                step: "01",
                title: "Upload",
                desc: "Drop a PDF, resume, or markdown file. It gets split into 500-token chunks with overlap and embedded into vectors.",
                icon: Upload,
              },
              {
                step: "02",
                title: "Learn",
                desc: "Chat with your docs, take AI-generated quizzes, or face a mock interviewer that grills you on your own content.",
                icon: Brain,
              },
              {
                step: "03",
                title: "Improve",
                desc: "Track weak topics across quizzes and interviews. The AI identifies exactly what you need to study next.",
                icon: TrendingUp,
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-chart-3/10 mb-4">
                  <item.icon className="h-6 w-6 text-chart-3" />
                </div>
                <span className="block text-xs font-mono text-muted-foreground/50 mb-1">
                  {item.step}
                </span>
                <h4 className="text-lg font-semibold mb-2">{item.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── What makes this different ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">
            Not another ChatGPT wrapper
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Every answer is grounded in your documents. No hallucination. No generic responses.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {[
            {
              icon: Target,
              title: "Citation-backed answers",
              desc: "Every response includes source references so you can verify claims against your original material.",
            },
            {
              icon: Brain,
              title: "Adaptive difficulty",
              desc: "The mock interviewer adjusts questions based on your answers. Score low? It probes deeper on that topic.",
            },
            {
              icon: Shield,
              title: "Input & output guardrails",
              desc: "Prompt injection detection, PII filtering, and hallucination checks protect every interaction.",
            },
            {
              icon: Zap,
              title: "Sub-2s streaming responses",
              desc: "Groq inference at 500+ tok/s with SSE streaming. Circuit breaker auto-fails over to Gemini if needed.",
            },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="flex gap-4 p-5 rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm"
            >
              <div className="shrink-0 h-10 w-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
                <item.icon className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">{item.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Highlights strip ── */}
      <section className="relative z-10 py-10 border-y border-border/20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-wrap justify-center gap-x-8 gap-y-3 max-w-3xl mx-auto px-6"
        >
          {highlights.map((item, i) => (
            <motion.span
              key={item.label}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
            >
              <item.icon className="h-3.5 w-3.5 text-chart-3" />
              {item.label}
            </motion.span>
          ))}
        </motion.div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-3xl sm:text-5xl font-bold mb-4">
            Ready to study{" "}
            <span className="bg-gradient-to-r from-chart-3 to-chart-1 bg-clip-text text-transparent">
              smarter
            </span>
            ?
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
            Upload your first document and start chatting in under 30 seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="text-base px-8 h-12 group">
              <Link to="/register">
                Get Started — It's Free
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-border/20 py-8">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-5">
            {[
              { icon: Brain, label: "Vercel AI SDK" },
              { icon: FileText, label: "MongoDB" },
              { icon: GitBranch, label: "Qdrant" },
              { icon: Zap, label: "Redis" },
            ].map((tech) => (
              <span
                key={tech.label}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/50"
              >
                <tech.icon className="h-3 w-3" />
                {tech.label}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground/30">
            Express &bull; TypeScript &bull; Streaming SSE &bull; Circuit
            Breaker &bull; LLM-as-Judge
          </p>
        </div>
      </footer>
    </div>
  );
}
