import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import {
  FileText,
  HelpCircle,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertTriangle,
  Trophy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";

interface DashboardStats {
  documentCount: number;
  quizCount: number;
  interviewCount: number;
  avgQuizScore: number;
  avgInterviewScore: number;
  topWeakTopics: Array<{ topic: string; count: number }>;
  topStrongTopics: Array<{ topic: string; count: number }>;
  recentQuizScores: Array<{ score: number; date: string }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api<DashboardStats>("/dashboard/stats");
      setStats(data);
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex justify-center items-center h-full text-muted-foreground">
        <p>Failed to load dashboard stats.</p>
      </div>
    );
  }

  const hasActivity = stats.quizCount > 0 || stats.interviewCount > 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Your learning progress at a glance.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={FileText}
          label="Documents"
          value={stats.documentCount}
          delay={0}
        />
        <StatCard
          icon={HelpCircle}
          label="Quizzes"
          value={stats.quizCount}
          subtext={stats.avgQuizScore > 0 ? `Avg: ${stats.avgQuizScore}%` : undefined}
          delay={0.05}
        />
        <StatCard
          icon={MessageSquare}
          label="Interviews"
          value={stats.interviewCount}
          subtext={stats.avgInterviewScore > 0 ? `Avg: ${stats.avgInterviewScore}/10` : undefined}
          delay={0.1}
        />
        <StatCard
          icon={Trophy}
          label="Total Sessions"
          value={stats.quizCount + stats.interviewCount}
          delay={0.15}
        />
      </div>

      {!hasActivity ? (
        <div className="text-center py-12 text-muted-foreground">
          <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No activity yet</p>
          <p className="text-sm mt-1">
            Complete quizzes and mock interviews to see your progress here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Weak Topics */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Focus Areas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topWeakTopics.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No weak topics identified yet.</p>
                ) : (
                  <div className="space-y-3">
                    {stats.topWeakTopics.map((t, i) => (
                      <div key={t.topic} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">{t.topic}</span>
                          <Badge variant="secondary" className="text-xs text-red-600">
                            {t.count}x weak
                          </Badge>
                        </div>
                        <Progress value={Math.min((t.count / 3) * 100, 100)} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Strong Topics */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Strong Areas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topStrongTopics.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No strong topics identified yet.</p>
                ) : (
                  <div className="space-y-3">
                    {stats.topStrongTopics.map((t) => (
                      <div key={t.topic} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">{t.topic}</span>
                          <Badge variant="secondary" className="text-xs text-green-600">
                            {t.count}x strong
                          </Badge>
                        </div>
                        <Progress value={Math.min((t.count / 3) * 100, 100)} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Quiz Scores */}
          {stats.recentQuizScores.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="md:col-span-2"
            >
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    Recent Quiz Scores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2 h-24">
                    {stats.recentQuizScores.map((s, i) => (
                      <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${s.score}%` }}
                        transition={{ delay: 0.3 + i * 0.05, duration: 0.4 }}
                        className={`flex-1 rounded-t-md min-w-0 ${
                          s.score >= 80
                            ? "bg-green-500/60"
                            : s.score >= 50
                              ? "bg-yellow-500/60"
                              : "bg-red-500/60"
                        }`}
                        title={`${Math.round(s.score)}%`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>Oldest</span>
                    <span>Most Recent</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  subtext?: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
              {subtext && (
                <p className="text-xs text-muted-foreground/70">{subtext}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
