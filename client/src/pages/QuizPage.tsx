import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Trophy,
  Clock,
  BarChart3,
  FileText,
  AlertCircle,
  RotateCcw,
  History,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useDocuments, type Document } from "@/hooks/useDocuments";
import { api } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────

interface QuizQuestion {
  id: string;
  type: "mcq" | "true_false" | "open_ended";
  question: string;
  options?: string[];
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  // These are only available after evaluation
  correctAnswer?: string;
  explanation?: string;
}

interface GeneratedQuiz {
  quizId: string;
  questions: QuizQuestion[];
  totalQuestions: number;
  estimatedTimeMinutes: number;
  topics: string[];
}

interface AnswerEvaluation {
  questionId: string;
  isCorrect: boolean;
  score: number;
  feedback: string;
  keyPointsCovered: string[];
  keyPointsMissed: string[];
}

interface QuizEvaluation {
  evaluations: AnswerEvaluation[];
  overallScore: number;
  totalCorrect: number;
  totalQuestions: number;
  weakTopics: string[];
  strongTopics: string[];
  overallFeedback: string;
}

interface QuizHistoryItem {
  quizId: string;
  documentIds: string[];
  overallScore: number;
  totalCorrect: number;
  totalQuestions: number;
  difficulty: string;
  status: "generated" | "completed";
  topics: string[];
  weakTopics: string[];
  strongTopics: string[];
  createdAt: string;
  completedAt?: string;
}

type QuizState = "config" | "taking" | "submitting" | "results";

// ── Main Component ───────────────────────────────────────────────────

export default function QuizPage() {
  const { documents, isLoading: docsLoading } = useDocuments();
  const readyDocs = documents.filter((d) => d.status === "ready");

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Quiz</h1>
        <p className="text-muted-foreground mt-1">
          Generate quizzes from your study materials and test your knowledge.
        </p>
      </div>

      <Tabs defaultValue="quiz">
        <TabsList>
          <TabsTrigger value="quiz" className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            New Quiz
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quiz" className="mt-4">
          {docsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : readyDocs.length === 0 ? (
            <EmptyState />
          ) : (
            <QuizFlow documents={readyDocs} />
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <QuizHistoryList />
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
        Upload study materials on the Documents page first, then come back to generate quizzes.
      </p>
    </div>
  );
}

// ── Quiz Flow (config → taking → results) ────────────────────────────

function QuizFlow({ documents }: { documents: Document[] }) {
  const [state, setState] = useState<QuizState>("config");
  const [quiz, setQuiz] = useState<GeneratedQuiz | null>(null);
  const [evaluation, setEvaluation] = useState<QuizEvaluation | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (config: {
    documentIds: string[];
    numQuestions: number;
    difficulty: string;
    questionTypes: string[];
  }) => {
    setState("submitting");
    setError(null);
    try {
      const result = await api<GeneratedQuiz>("/quiz/generate", {
        method: "POST",
        body: JSON.stringify(config),
      });
      setQuiz(result);
      setAnswers({});
      setState("taking");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate quiz");
      setState("config");
    }
  };

  const handleSubmit = async () => {
    if (!quiz) return;
    setState("submitting");
    setError(null);
    try {
      const answerArray = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer,
      }));
      const result = await api<QuizEvaluation>("/quiz/evaluate", {
        method: "POST",
        body: JSON.stringify({ quizId: quiz.quizId, answers: answerArray }),
      });
      setEvaluation(result);
      setState("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to evaluate quiz");
      setState("taking");
    }
  };

  const handleReset = () => {
    setState("config");
    setQuiz(null);
    setEvaluation(null);
    setAnswers({});
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
            <QuizConfig documents={documents} onGenerate={handleGenerate} />
          </motion.div>
        )}

        {state === "submitting" && !quiz && (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-4"
          >
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Generating your quiz...</p>
            <p className="text-xs text-muted-foreground/60">
              This may take 10-20 seconds
            </p>
          </motion.div>
        )}

        {(state === "taking" || (state === "submitting" && quiz)) && quiz && (
          <motion.div
            key="taking"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <QuizTaker
              quiz={quiz}
              answers={answers}
              setAnswers={setAnswers}
              onSubmit={handleSubmit}
              isSubmitting={state === "submitting"}
            />
          </motion.div>
        )}

        {state === "results" && quiz && evaluation && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <QuizResults
              quiz={quiz}
              evaluation={evaluation}
              answers={answers}
              onReset={handleReset}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Quiz Config ──────────────────────────────────────────────────────

function QuizConfig({
  documents,
  onGenerate,
}: {
  documents: Document[];
  onGenerate: (config: {
    documentIds: string[];
    numQuestions: number;
    difficulty: string;
    questionTypes: string[];
  }) => void;
}) {
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [numQuestions, setNumQuestions] = useState("5");
  const [difficulty, setDifficulty] = useState("mixed");
  const [questionTypes, setQuestionTypes] = useState<string[]>([
    "mcq",
    "true_false",
    "open_ended",
  ]);

  const toggleDoc = (id: string) => {
    setSelectedDocs((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const toggleType = (type: string) => {
    setQuestionTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev; // must keep at least one
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  };

  const canGenerate = selectedDocs.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5" />
          Quiz Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Document Selection */}
        <div className="space-y-2">
          <Label>Select Documents</Label>
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

        {/* Number of Questions */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Number of Questions</Label>
            <Select value={numQuestions} onValueChange={setNumQuestions}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 5, 8, 10, 15, 20].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} questions
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Difficulty */}
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
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Question Types */}
        <div className="space-y-2">
          <Label>Question Types</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "mcq", label: "Multiple Choice" },
              { value: "true_false", label: "True / False" },
              { value: "open_ended", label: "Open Ended" },
            ].map((type) => (
              <button
                key={type.value}
                onClick={() => toggleType(type.value)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  questionTypes.includes(type.value)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/30"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={() =>
            onGenerate({
              documentIds: selectedDocs,
              numQuestions: parseInt(numQuestions),
              difficulty,
              questionTypes,
            })
          }
          disabled={!canGenerate}
          className="w-full"
          size="lg"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Generate Quiz
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Quiz Taker ───────────────────────────────────────────────────────

function QuizTaker({
  quiz,
  answers,
  setAnswers,
  onSubmit,
  isSubmitting,
}: {
  quiz: GeneratedQuiz;
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const question = quiz.questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / quiz.totalQuestions) * 100;

  const setAnswer = (value: string) => {
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
  };

  const canSubmit = answeredCount === quiz.totalQuestions;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Question {currentIndex + 1} of {quiz.totalQuestions}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            ~{quiz.estimatedTimeMinutes} min
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex flex-wrap gap-1.5">
          {quiz.questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(i)}
              className={`h-8 w-8 rounded-md text-xs font-medium transition-colors ${
                i === currentIndex
                  ? "bg-primary text-primary-foreground"
                  : answers[q.id]
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <p className="font-medium text-foreground leading-relaxed">
                  {question.question}
                </p>
                <div className="flex gap-1.5 shrink-0">
                  <Badge variant="secondary" className="text-xs">
                    {question.topic}
                  </Badge>
                  <DifficultyBadge difficulty={question.difficulty} />
                </div>
              </div>

              {/* MCQ Options */}
              {question.type === "mcq" && question.options && (
                <div className="grid gap-2">
                  {question.options.map((option, i) => (
                    <label
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        answers[question.id] === option
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        checked={answers[question.id] === option}
                        onChange={() => setAnswer(option)}
                        className="accent-primary"
                      />
                      <span className="text-sm">{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* True/False */}
              {question.type === "true_false" && (
                <div className="grid grid-cols-2 gap-3">
                  {["true", "false"].map((value) => (
                    <button
                      key={value}
                      onClick={() => setAnswer(value)}
                      className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                        answers[question.id] === value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/30 text-muted-foreground"
                      }`}
                    >
                      {value === "true" ? "True" : "False"}
                    </button>
                  ))}
                </div>
              )}

              {/* Open Ended */}
              {question.type === "open_ended" && (
                <Textarea
                  placeholder="Type your answer..."
                  value={answers[question.id] || ""}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={4}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        {currentIndex < quiz.totalQuestions - 1 ? (
          <Button
            onClick={() =>
              setCurrentIndex((i) => Math.min(quiz.totalQuestions - 1, i + 1))
            }
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={onSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Evaluating...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Submit ({answeredCount}/{quiz.totalQuestions})
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Quiz Results ─────────────────────────────────────────────────────

function QuizResults({
  quiz,
  evaluation,
  answers,
  onReset,
}: {
  quiz: GeneratedQuiz;
  evaluation: QuizEvaluation;
  answers: Record<string, string>;
  onReset: () => void;
}) {
  const isHighScore = evaluation.overallScore >= 80;

  return (
    <div className="space-y-6">
      {/* Score Card */}
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <Card
          className={`border-2 ${isHighScore ? "border-green-500/30 bg-green-500/5" : "border-border"}`}
        >
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <Trophy
                className={`h-12 w-12 mx-auto ${isHighScore ? "text-yellow-500" : "text-muted-foreground"}`}
              />
              <div>
                <motion.p
                  className="text-4xl font-bold text-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  {Math.round(evaluation.overallScore)}%
                </motion.p>
                <p className="text-sm text-muted-foreground mt-1">
                  {evaluation.totalCorrect} of {evaluation.totalQuestions} correct
                </p>
              </div>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {evaluation.overallFeedback}
              </p>

              {/* Topics */}
              <div className="flex flex-wrap justify-center gap-4 pt-2">
                {evaluation.strongTopics.length > 0 && (
                  <div className="text-left">
                    <p className="text-xs font-medium text-green-500 mb-1">Strong Topics</p>
                    <div className="flex flex-wrap gap-1">
                      {evaluation.strongTopics.map((t) => (
                        <Badge key={t} variant="secondary" className="text-green-600 text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {evaluation.weakTopics.length > 0 && (
                  <div className="text-left">
                    <p className="text-xs font-medium text-red-500 mb-1">Needs Improvement</p>
                    <div className="flex flex-wrap gap-1">
                      {evaluation.weakTopics.map((t) => (
                        <Badge key={t} variant="secondary" className="text-red-600 text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Per-question Results */}
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground">Question Breakdown</h3>
        {quiz.questions.map((question, i) => {
          const eval_ = evaluation.evaluations.find((e) => e.questionId === question.id);
          if (!eval_) return null;

          return (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card
                className={`border-l-4 ${
                  eval_.isCorrect ? "border-l-green-500" : "border-l-red-500"
                }`}
              >
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start gap-3">
                    {eval_.isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{question.question}</p>
                      <div className="mt-2 space-y-1 text-sm">
                        <p className="text-muted-foreground">
                          <span className="font-medium">Your answer:</span>{" "}
                          {answers[question.id] || "[No answer]"}
                        </p>
                        {!eval_.isCorrect && (
                          <p className="text-green-600">
                            <span className="font-medium">Correct:</span>{" "}
                            {/* correctAnswer comes from the completed quiz result */}
                            {eval_.feedback}
                          </p>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">{eval_.feedback}</p>

                      {/* Key points */}
                      {eval_.keyPointsMissed.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-red-500">Missed:</p>
                          <ul className="text-xs text-muted-foreground list-disc list-inside">
                            {eval_.keyPointsMissed.map((p, j) => (
                              <li key={j}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <Badge
                        variant={eval_.isCorrect ? "secondary" : "destructive"}
                        className="text-xs"
                      >
                        {eval_.score}/5
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Reset */}
      <div className="flex justify-center">
        <Button onClick={onReset} variant="outline" size="lg">
          <RotateCcw className="h-4 w-4 mr-2" />
          Take Another Quiz
        </Button>
      </div>
    </div>
  );
}

// ── Quiz History ─────────────────────────────────────────────────────

function QuizHistoryList() {
  const [history, setHistory] = useState<QuizHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api<QuizHistoryItem[]>("/quiz/history");
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
        <p className="font-medium">No quiz history yet</p>
        <p className="text-sm mt-1">Generate and complete a quiz to see your results here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((item, i) => (
        <motion.div
          key={item.quizId}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
        >
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div
                className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                  item.status === "completed"
                    ? item.overallScore >= 80
                      ? "bg-green-500/10"
                      : item.overallScore >= 50
                        ? "bg-yellow-500/10"
                        : "bg-red-500/10"
                    : "bg-muted"
                }`}
              >
                {item.status === "completed" ? (
                  <span
                    className={`text-sm font-bold ${
                      item.overallScore >= 80
                        ? "text-green-500"
                        : item.overallScore >= 50
                          ? "text-yellow-500"
                          : "text-red-500"
                    }`}
                  >
                    {Math.round(item.overallScore)}%
                  </span>
                ) : (
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">
                    {item.topics.slice(0, 3).join(", ")}
                  </p>
                  <DifficultyBadge difficulty={item.difficulty} />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span>{item.totalQuestions} questions</span>
                  {item.status === "completed" && (
                    <span>
                      {item.totalCorrect}/{item.totalQuestions} correct
                    </span>
                  )}
                  <span>
                    {new Date(item.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
              <Badge variant={item.status === "completed" ? "secondary" : "outline"}>
                {item.status === "completed" ? "Completed" : "In Progress"}
              </Badge>
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
    mixed: "text-blue-600",
  };

  return (
    <Badge variant="outline" className={`text-xs ${colors[difficulty] || ""}`}>
      {difficulty}
    </Badge>
  );
}
