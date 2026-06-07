import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mic,
  Send,
  Loader2,
  MessageSquare,
  History,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trophy,
  Target,
  ChevronDown,
  ChevronUp,
  StopCircle,
  Sparkles,
  BookOpen,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useDocuments, type Document } from "@/hooks/useDocuments";
import { api } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────

interface InterviewQuestion {
  question: string;
  topic: string;
  difficulty: string;
  isFollowUp?: boolean;
  hint?: string;
}

interface AnswerEvaluation {
  score: number;
  feedback: string;
  coveredPoints: string[];
  missedPoints: string[];
}

interface InterviewResult {
  overallScore: number;
  summary: string;
  questionsAsked: number;
  topicsAssessed: Array<{ topic: string; score: number; feedback: string }>;
  strongAreas: string[];
  weakAreas: string[];
  suggestedStudyTopics: string[];
  totalRounds: number;
}

interface RoundEntry {
  question: InterviewQuestion;
  answer: string;
  evaluation: AnswerEvaluation;
}

interface HistoryItem {
  sessionId: string;
  topic: string;
  difficulty: string;
  currentRound: number;
  result?: { overallScore: number; strongAreas: string[]; weakAreas: string[] };
  createdAt: string;
  completedAt?: string;
}

type InterviewState = "config" | "active" | "loading" | "results";

// ── Main Component ───────────────────────────────────────────────────

export default function InterviewPage() {
  const { documents, isLoading: docsLoading } = useDocuments();
  const readyDocs = documents.filter((d) => d.status === "ready");

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mock Interview</h1>
        <p className="text-muted-foreground mt-1">
          Practice with an AI interviewer that adapts to your answers.
        </p>
      </div>

      <Tabs defaultValue="interview">
        <TabsList>
          <TabsTrigger value="interview" className="gap-1.5">
            <Mic className="h-4 w-4" />
            New Interview
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="interview" className="mt-4">
          {docsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : readyDocs.length === 0 ? (
            <EmptyState />
          ) : (
            <InterviewFlow documents={readyDocs} />
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <InterviewHistoryList />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
      <p className="font-medium">No documents available</p>
      <p className="text-sm mt-1">
        Upload your resume or study materials on the Documents page first.
      </p>
    </div>
  );
}

// ── Interview Flow ───────────────────────────────────────────────────

function InterviewFlow({ documents }: { documents: Document[] }) {
  const [state, setState] = useState<InterviewState>("config");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [rounds, setRounds] = useState<RoundEntry[]>([]);
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [maxRounds, setMaxRounds] = useState(4);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async (config: {
    documentIds: string[];
    topic?: string;
    difficulty: string;
    numRounds: number;
  }) => {
    setState("loading");
    setError(null);
    setMaxRounds(config.numRounds);
    try {
      const res = await api<{
        sessionId: string;
        question: string;
        topic: string;
        difficulty: string;
      }>("/interview/start", {
        method: "POST",
        body: JSON.stringify(config),
      });
      setSessionId(res.sessionId);
      setCurrentQuestion({
        question: res.question,
        topic: res.topic,
        difficulty: res.difficulty,
      });
      setRounds([]);
      setState("active");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start interview");
      setState("config");
    }
  };

  const handleAnswer = async (answer: string) => {
    if (!sessionId || !currentQuestion) return;
    setState("loading");
    setError(null);
    try {
      const res = await api<{
        evaluation: AnswerEvaluation;
        nextQuestion?: InterviewQuestion;
        sessionComplete: boolean;
        result?: InterviewResult;
      }>("/interview/answer", {
        method: "POST",
        body: JSON.stringify({ sessionId, answer }),
      });

      setRounds((prev) => [
        ...prev,
        { question: currentQuestion, answer, evaluation: res.evaluation },
      ]);

      if (res.sessionComplete && res.result) {
        setResult(res.result);
        setCurrentQuestion(null);
        setState("results");
      } else if (res.nextQuestion) {
        setCurrentQuestion(res.nextQuestion);
        setState("active");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process answer");
      setState("active");
    }
  };

  const handleEndEarly = async () => {
    if (!sessionId) return;
    setState("loading");
    try {
      const res = await api<InterviewResult>("/interview/end", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
      setResult(res);
      setCurrentQuestion(null);
      setState("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end interview");
      setState("active");
    }
  };

  const handleReset = () => {
    setState("config");
    setSessionId(null);
    setCurrentQuestion(null);
    setRounds([]);
    setResult(null);
    setError(null);
  };

  return (
    <>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg p-3"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {state === "config" && (
          <motion.div
            key="config"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <InterviewConfig documents={documents} onStart={handleStart} />
          </motion.div>
        )}

        {state === "loading" && !currentQuestion && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-4"
          >
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">
              {rounds.length === 0 ? "Preparing your interview..." : "Evaluating your answer..."}
            </p>
          </motion.div>
        )}

        {(state === "active" || (state === "loading" && currentQuestion)) && currentQuestion && (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <ActiveInterview
              question={currentQuestion}
              rounds={rounds}
              maxRounds={maxRounds}
              onAnswer={handleAnswer}
              onEndEarly={handleEndEarly}
              isLoading={state === "loading"}
            />
          </motion.div>
        )}

        {state === "results" && result && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <InterviewResults
              result={result}
              rounds={rounds}
              onReset={handleReset}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Interview Config ─────────────────────────────────────────────────

function InterviewConfig({
  documents,
  onStart,
}: {
  documents: Document[];
  onStart: (config: {
    documentIds: string[];
    topic?: string;
    difficulty: string;
    numRounds: number;
  }) => void;
}) {
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [numRounds, setNumRounds] = useState("4");

  const toggleDoc = (id: string) => {
    setSelectedDocs((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          Interview Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Document Selection */}
        <div className="space-y-2">
          <Label>Select Documents (resume, study materials, etc.)</Label>
          <div className="grid gap-2 max-h-48 overflow-y-auto">
            {documents.map((doc) => (
              <label
                key={doc._id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedDocs.includes(doc._id)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedDocs.includes(doc._id)}
                  onChange={() => toggleDoc(doc._id)}
                  className="accent-primary"
                />
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">{doc.originalName}</span>
                <Badge variant="secondary" className="ml-auto text-xs shrink-0">
                  {doc.chunkCount} chunks
                </Badge>
              </label>
            ))}
          </div>
        </div>

        {/* Topic + Difficulty + Rounds */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Topic (optional)</Label>
            <Input
              placeholder="e.g., React, System Design"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Rounds</Label>
            <Select value={numRounds} onValueChange={setNumRounds}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5, 6, 8].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} rounds
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={() =>
            onStart({
              documentIds: selectedDocs,
              topic: topic.trim() || undefined,
              difficulty,
              numRounds: parseInt(numRounds),
            })
          }
          disabled={selectedDocs.length === 0}
          className="w-full"
          size="lg"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Start Interview
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Active Interview ─────────────────────────────────────────────────

function ActiveInterview({
  question,
  rounds,
  maxRounds,
  onAnswer,
  onEndEarly,
  isLoading,
}: {
  question: InterviewQuestion;
  rounds: RoundEntry[];
  maxRounds: number;
  onAnswer: (answer: string) => void;
  onEndEarly: () => void;
  isLoading: boolean;
}) {
  const [answer, setAnswer] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentRound = rounds.length + 1;
  const progress = (rounds.length / maxRounds) * 100;

  const handleSubmit = () => {
    if (!answer.trim() || isLoading) return;
    onAnswer(answer.trim());
    setAnswer("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Round {currentRound} of {maxRounds}</span>
        <Button variant="ghost" size="sm" onClick={onEndEarly} disabled={isLoading || rounds.length === 0}>
          <StopCircle className="h-3.5 w-3.5 mr-1" />
          End Early
        </Button>
      </div>
      <Progress value={progress} className="h-2" />

      {/* Previous rounds (collapsible) */}
      {rounds.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Previous rounds ({rounds.length})
          </button>
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-3">
                  {rounds.map((round, i) => (
                    <RoundCard key={i} round={round} index={i} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Last evaluation feedback */}
      {rounds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className={`border-l-4 ${
            rounds[rounds.length - 1].evaluation.score >= 4
              ? "border-l-green-500 bg-green-500/5"
              : rounds[rounds.length - 1].evaluation.score >= 3
                ? "border-l-yellow-500 bg-yellow-500/5"
                : "border-l-red-500 bg-red-500/5"
          }`}>
            <CardContent className="py-3">
              <div className="flex items-start gap-2">
                <ScoreBadge score={rounds[rounds.length - 1].evaluation.score} />
                <p className="text-sm text-muted-foreground">
                  {rounds[rounds.length - 1].evaluation.feedback}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Current Question */}
      <motion.div
        key={question.question}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <p className="font-medium text-foreground leading-relaxed pt-1">
                  {question.question}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Badge variant="secondary" className="text-xs">{question.topic}</Badge>
                <DifficultyBadge difficulty={question.difficulty} />
                {question.isFollowUp && (
                  <Badge variant="outline" className="text-xs text-orange-500">
                    Follow-up
                  </Badge>
                )}
              </div>
            </div>

            {question.hint && (
              <p className="text-xs text-muted-foreground/70 italic pl-11">
                Hint: {question.hint}
              </p>
            )}

            {/* Answer input */}
            <div className="pl-11 space-y-3">
              <Textarea
                ref={textareaRef}
                placeholder="Type your answer... (Ctrl+Enter to submit)"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={4}
                disabled={isLoading}
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleSubmit}
                  disabled={!answer.trim() || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Evaluating...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Answer
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ── Interview Results ────────────────────────────────────────────────

function InterviewResults({
  result,
  rounds,
  onReset,
}: {
  result: InterviewResult;
  rounds: RoundEntry[];
  onReset: () => void;
}) {
  const isGoodScore = result.overallScore >= 7;

  return (
    <div className="space-y-6">
      {/* Score Card */}
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <Card className={`border-2 ${isGoodScore ? "border-green-500/30 bg-green-500/5" : "border-border"}`}>
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <Trophy className={`h-12 w-12 mx-auto ${isGoodScore ? "text-yellow-500" : "text-muted-foreground"}`} />
              <div>
                <motion.p
                  className="text-4xl font-bold text-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  {result.overallScore}/10
                </motion.p>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.questionsAsked} questions across {result.totalRounds} rounds
                </p>
              </div>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                {result.summary}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Topics + Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Topic Scores */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4" />
              Topics Assessed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.topicsAssessed.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t.topic}</span>
                  <ScoreBadge score={t.score} />
                </div>
                <p className="text-xs text-muted-foreground">{t.feedback}</p>
                <Progress value={(t.score / 5) * 100} className="h-1.5" />
              </motion.div>
            ))}
          </CardContent>
        </Card>

        {/* Strengths + Weaknesses + Recommendations */}
        <div className="space-y-4">
          {result.strongAreas.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-green-500 mb-2">Strong Areas</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.strongAreas.map((a) => (
                    <Badge key={a} variant="secondary" className="text-green-600 text-xs">{a}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {result.weakAreas.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-red-500 mb-2">Needs Improvement</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.weakAreas.map((a) => (
                    <Badge key={a} variant="secondary" className="text-red-600 text-xs">{a}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {result.suggestedStudyTopics.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-blue-500 mb-2">Study Recommendations</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {result.suggestedStudyTopics.map((t, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <BookOpen className="h-3 w-3 mt-0.5 shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Round-by-Round Breakdown */}
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground">Round Breakdown</h3>
        {rounds.map((round, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <RoundCard round={round} index={i} expanded />
          </motion.div>
        ))}
      </div>

      {/* Reset */}
      <div className="flex justify-center">
        <Button onClick={onReset} variant="outline" size="lg">
          <Sparkles className="h-4 w-4 mr-2" />
          Start New Interview
        </Button>
      </div>
    </div>
  );
}

// ── Round Card (reusable) ────────────────────────────────────────────

function RoundCard({
  round,
  index,
  expanded = false,
}: {
  round: RoundEntry;
  index: number;
  expanded?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(expanded);

  return (
    <Card className={`border-l-4 ${
      round.evaluation.score >= 4
        ? "border-l-green-500"
        : round.evaluation.score >= 3
          ? "border-l-yellow-500"
          : "border-l-red-500"
    }`}>
      <CardContent className="py-3">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <ScoreBadge score={round.evaluation.score} />
            <span className="text-sm font-medium truncate">
              Round {index + 1}: {round.question.topic}
            </span>
            {round.question.isFollowUp && (
              <Badge variant="outline" className="text-xs text-orange-500 shrink-0">
                Follow-up
              </Badge>
            )}
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-2 text-sm">
                <p className="font-medium text-foreground">{round.question.question}</p>
                <p className="text-muted-foreground">
                  <span className="font-medium">Your answer:</span> {round.answer}
                </p>
                <p className="text-muted-foreground">{round.evaluation.feedback}</p>
                {round.evaluation.missedPoints.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-red-500">Missed:</p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside">
                      {round.evaluation.missedPoints.map((p, j) => (
                        <li key={j}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

// ── Interview History ────────────────────────────────────────────────

function InterviewHistoryList() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api<HistoryItem[]>("/interview/history");
      setHistory(data);
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="font-medium">No interview history yet</p>
        <p className="text-sm mt-1">Complete a mock interview to see your results here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((item, i) => (
        <motion.div
          key={item.sessionId}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
        >
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div
                className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                  item.result
                    ? item.result.overallScore >= 7
                      ? "bg-green-500/10"
                      : item.result.overallScore >= 5
                        ? "bg-yellow-500/10"
                        : "bg-red-500/10"
                    : "bg-muted"
                }`}
              >
                {item.result ? (
                  <span
                    className={`text-sm font-bold ${
                      item.result.overallScore >= 7
                        ? "text-green-500"
                        : item.result.overallScore >= 5
                          ? "text-yellow-500"
                          : "text-red-500"
                    }`}
                  >
                    {item.result.overallScore}/10
                  </span>
                ) : (
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{item.topic}</p>
                  <DifficultyBadge difficulty={item.difficulty} />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span>{item.currentRound} rounds</span>
                  <span>
                    {new Date(item.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
              {item.result && (
                <div className="flex flex-wrap gap-1 max-w-48">
                  {item.result.weakAreas.slice(0, 2).map((a) => (
                    <Badge key={a} variant="secondary" className="text-xs text-red-600">{a}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    easy: "text-green-600",
    medium: "text-yellow-600",
    hard: "text-red-600",
  };
  return (
    <Badge variant="outline" className={`text-xs ${colors[difficulty] || ""}`}>
      {difficulty}
    </Badge>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 4
      ? "bg-green-500/10 text-green-500"
      : score >= 3
        ? "bg-yellow-500/10 text-yellow-500"
        : "bg-red-500/10 text-red-500";
  const icon = score >= 4 ? CheckCircle2 : score >= 3 ? Target : XCircle;
  const Icon = icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {score}/5
    </span>
  );
}
