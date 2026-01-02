"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import Progress from "@/components/Progress";
import Skeleton from "@/components/Skeleton";
import InterviewerPanel from "@/components/InterviewerPanel";
import ReportView from "@/components/ReportView";
import PresenceCheckModal from "@/components/PresenceCheckModal";
import VoiceAnswerRecorder from "@/components/VoiceAnswerRecorder";

type ApiState = {
  session: {
    id: string;
    mode: string;
    role?: string;
    level?: string;
    status: string;
    currentQuestionIndex: number;
    totalQuestions: number;
  };
  currentQuestion: null | {
    id: string;
    text: string;
    category: string;
    difficulty: string;
  };
  scoreSummary?: {
    countEvaluated: number;
    avg: {
      technical: number;
      communication: number;
      problemSolving: number;
      overall: number;
    };
  };
  presence?: {
    photoDataUrl?: string;
    phrasePrompt?: string;
    phraseTranscript?: string;
    completedAt?: number;
  };
};

type EvalResp = {
  ok: boolean;
  evaluation: {
    questionId: string;
    scores: { technical: number; communication: number; problemSolving: number };
    overall: number;
    strengths: string[];
    gaps: string[];
    followUpQuestion: string;
  };
  scoreSummary: {
    countEvaluated: number;
    avg: {
      technical: number;
      communication: number;
      problemSolving: number;
      overall: number;
    };
  };
  advancedToIndex: number;
  status: string;
};

type Report = {
  recommendation: "strong_hire" | "hire" | "borderline" | "no_hire";
  confidence: number;
  executiveSummary: string;
  strengths: string[];
  gapsAndRisks: string[];
  evidence: Array<{ 
    claim: string; 
    supportingAnswerSnippet: string; 
    relatedQuestionId: string;
    evidenceType?: "technical" | "leadership" | "communication" | "problem_solving";
  }>;
  nextRoundFocus: string[];
};

function getCoachingHint(category: string): string {
  const hints: Record<string, string> = {
    technical: "Answer with approach + tradeoffs + example",
    scenario: "Use STAR: Situation/Task/Action/Result",
    behavioral: "Give one real conflict + resolution",
    experience: "Add scope, metrics, impact",
  };
  return hints[category] || "Provide a clear, structured answer";
}

function getStatusBadgeVariant(status: string): "default" | "success" | "warning" | "info" {
  if (status === "completed") return "success";
  if (status === "in_progress") return "info";
  return "default";
}

export default function InterviewClient({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<ApiState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [answerText, setAnswerText] = useState("");
  const [lastEval, setLastEval] = useState<EvalResp | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportScoreSummary, setReportScoreSummary] = useState<ApiState["scoreSummary"] | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [readAloud, setReadAloud] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [previousQuestionId, setPreviousQuestionId] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [presence, setPresence] = useState<any>(null);
  const [showPresenceModal, setShowPresenceModal] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/sessions/${sessionId}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed");
    setData(json);
    setInitialLoading(false);
    setPresence(json.presence || null);

    if (json?.session?.status === "completed") {
      fetchReport().catch(() => {});
    }
  }

  async function fetchReport() {
    const res = await fetch(`/api/sessions/${sessionId}/report`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Failed to fetch report");
    setReport(json.report ?? null);
    setReportScoreSummary(json.scoreSummary ?? null);
    setShareToken(json.shareToken ?? null);
  }

  async function generateReport() {
    setReportError(null);
    setReportLoading(true);
    setIsTyping(true);
    const res = await fetch(`/api/sessions/${sessionId}/report`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setReportLoading(false);
    setIsTyping(false);
    if (!res.ok) {
      setReportError(json.error || "Failed to generate report");
      return;
    }
    setReport(json.report);
    setShareToken(json.shareToken ?? null);
    setSuccessMessage("Report generated successfully");
    setTimeout(() => setSuccessMessage(null), 3000);
    // Fetch score summary from report endpoint
    const reportRes = await fetch(`/api/sessions/${sessionId}/report`);
    const reportJson = await reportRes.json().catch(() => ({}));
    if (reportRes.ok) {
      setReportScoreSummary(reportJson.scoreSummary ?? null);
      setShareToken(reportJson.shareToken ?? null);
    }
  }

  async function copyShareLink() {
    if (!shareToken) return;

    const shareUrl = `${window.location.origin}/share/${shareToken}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Fallback: select text
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch {
        // Ignore
      }
      document.body.removeChild(textArea);
    }
  }

  async function startInterview() {
    setError(null);
    setLoading(true);
    setIsTyping(true);
    const res = await fetch(`/api/sessions/${sessionId}/start`, {
      method: "POST",
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error || "Failed to start");
      setIsTyping(false);
      return;
    }
    setSuccessMessage("Interview started");
    setTimeout(() => setSuccessMessage(null), 3000);
    await refresh();
    // Small delay to show typing indicator
    setTimeout(() => setIsTyping(false), 500);
  }

  async function nextQuestion() {
    setError(null);
    setLoading(true);
    setIsTyping(true);
    const res = await fetch(`/api/sessions/${sessionId}/next`, {
      method: "POST",
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error || "Failed to advance");
      setIsTyping(false);
      return;
    }
    await refresh();
    // Small delay to show typing indicator
    setTimeout(() => setIsTyping(false), 500);
  }

  async function submitAnswer() {
    setError(null);
    setLoading(true);
    setIsTyping(true);

    const res = await fetch(`/api/sessions/${sessionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answerText }),
    });

    const json = (await res.json().catch(() => ({}))) as Partial<EvalResp> & {
      error?: string;
    };
    setLoading(false);

    if (!res.ok) {
      setError(json.error || "Failed to submit answer");
      setIsTyping(false);
      return;
    }

    setLastEval(json as EvalResp);
    setAnswerText("");
    setSuccessMessage("Answer submitted and evaluated");
    setTimeout(() => setSuccessMessage(null), 3000);
    await refresh();
    // Small delay to show typing indicator for next question
    setTimeout(() => setIsTyping(false), 500);
  }

  useEffect(() => {
    refresh().catch((e) => {
      setError(e.message);
      setInitialLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const started = (data?.session.totalQuestions ?? 0) > 0;
  const completed = data?.session.status === "completed";
  const currentQuestionNum = (data?.session.currentQuestionIndex ?? 0) + 1;

  // Show presence modal on first load if not dismissed
  useEffect(() => {
    if (!initialLoading && data && !started) {
      const dismissed = localStorage.getItem(`presenceDismissed:${sessionId}`);
      if (!dismissed && !presence?.completedAt) {
        setShowPresenceModal(true);
      }
    }
  }, [initialLoading, data, started, sessionId, presence]);

  const handlePresenceComplete = () => {
    setShowPresenceModal(false);
    refresh();
  };

  const handlePresenceSkip = () => {
    setShowPresenceModal(false);
  };

  // Track question changes for transitions
  useEffect(() => {
    if (data?.currentQuestion?.id && data.currentQuestion.id !== previousQuestionId) {
      setPreviousQuestionId(data.currentQuestion.id);
    }
  }, [data?.currentQuestion?.id, previousQuestionId]);

  const scoreSummary = reportScoreSummary || data?.scoreSummary || lastEval?.scoreSummary;
  const lowestScore = scoreSummary
    ? Math.min(
        scoreSummary.avg.technical,
        scoreSummary.avg.communication,
        scoreSummary.avg.problemSolving
      )
    : null;
  const commsIsLowest =
    scoreSummary &&
    scoreSummary.avg.communication === lowestScore &&
    scoreSummary.avg.communication < scoreSummary.avg.technical &&
    scoreSummary.avg.communication < scoreSummary.avg.problemSolving;

  if (initialLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" variant="rectangular" />
        <Skeleton className="h-64" variant="rectangular" />
      </div>
    );
  }

  const currentQuestionText = data?.currentQuestion?.text || null;
  const showTyping = isTyping || loading || reportLoading;

  return (
    <div className={`space-y-6 ${focusMode ? "bg-slate-50 p-4 rounded-lg" : ""}`}>
      {/* Presence Modal */}
      {showPresenceModal && (
        <PresenceCheckModal
          sessionId={sessionId}
          phrasePrompt={presence?.phrasePrompt || "I confirm this interview response is my own."}
          onComplete={handlePresenceComplete}
          onSkip={handlePresenceSkip}
        />
      )}

      {/* Top Header Bar */}
      <div className="sticky top-0 z-10 bg-[var(--bg)]/80 backdrop-blur-sm border-b border-[var(--border)] py-3 -mx-4 px-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--text)]">AI Interview Platform</h1>
            <p className="text-xs text-[var(--muted)] mt-0.5">Interview session</p>
          </div>
          <div className="flex items-center gap-3">
            {presence?.completedAt && (
              <Badge variant="success" className="app-badge">Presence</Badge>
            )}
            <Badge variant={getStatusBadgeVariant(data?.session.status || "created")} className="app-badge">
              {data?.session.status === "in_progress"
                ? "In progress"
                : data?.session.status === "completed"
                ? "Completed"
                : "Created"}
            </Badge>
            {started && !completed && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={focusMode}
                  onChange={(e) => setFocusMode(e.target.checked)}
                  className="rounded border-slate-300 text-[var(--primary)] focus:ring-2 focus:ring-indigo-200"
                />
                <span className="text-xs text-[var(--muted)]">Focus mode</span>
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Toast Messages */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 shadow-sm">
          <p className="text-sm text-red-800 font-medium">{error}</p>
        </div>
      )}
      {successMessage && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 shadow-sm">
          <p className="text-sm text-green-800 font-medium">{successMessage}</p>
        </div>
      )}

      {/* Context Card */}
      <Card className="shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Mode</p>
            <Badge variant="info">
              {data?.session.mode === "company" ? "Company" : "Open Market"}
            </Badge>
          </div>
          {data?.session.role && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Role</p>
              <p className="text-sm font-medium">{data.session.role}</p>
            </div>
          )}
          {data?.session.level && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Level</p>
              <Badge>{data.session.level}</Badge>
            </div>
          )}
          <div className="ml-auto flex items-center gap-3">
            {presence?.completedAt && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Presence</p>
                <Badge variant="success">Presence captured</Badge>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 mb-1">Status</p>
              <Badge variant={getStatusBadgeVariant(data?.session.status || "created")}>
                {data?.session.status === "in_progress"
                  ? "In Progress"
                  : data?.session.status === "completed"
                  ? "Completed"
                  : "Created"}
              </Badge>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)] font-mono">{sessionId}</p>
      </Card>

      {!started ? (
        <Card>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-32" />
            </div>
          ) : (
            <>
              <p className="text-sm text-[var(--muted)] mb-4">
                Ready to begin. Click below to generate interview questions.
              </p>
              <button
                onClick={startInterview}
                disabled={loading}
                className="app-btn-primary px-6 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Starting..." : "Begin interview"}
              </button>
            </>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Interviewer Panel */}
          <div className="lg:col-span-1">
            <Card variant="elevated" className="sticky top-4">
              <InterviewerPanel
                question={currentQuestionText}
                isTyping={showTyping}
                readAloud={readAloud}
                onReadAloudChange={setReadAloud}
              />
            </Card>
          </div>

          {/* Right Column: Answer & Evaluation */}
          <div className="lg:col-span-2 space-y-6">
          {/* Progress Indicator */}
          {!completed && (
            <Card className="shadow-sm">
              <Progress
                current={currentQuestionNum}
                total={data?.session.totalQuestions || 0}
              />
            </Card>
          )}

          {/* Question Details Card */}
          {!completed && data?.currentQuestion && (
            <Card variant="elevated" className="transition-all duration-300 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text)]">
                    Question {currentQuestionNum} of {data.session.totalQuestions}
                  </h3>
                  <div className="mt-2 flex gap-2">
                    <Badge className="app-badge">{data.currentQuestion.category}</Badge>
                    <Badge variant="default" className="app-badge">{data.currentQuestion.difficulty}</Badge>
                  </div>
                </div>
              </div>

              {/* Coaching Hint */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-4">
                <p className="text-xs font-medium text-blue-900 mb-1">Coaching hint</p>
                <p className="text-xs text-blue-700">
                  {getCoachingHint(data.currentQuestion.category)}
                </p>
              </div>

              {/* Voice Answer Recorder */}
              <div className="mb-4">
                <VoiceAnswerRecorder
                  onTranscript={(text) => setAnswerText(text)}
                  disabled={loading || completed}
                />
                {focusMode && (
                  <p className="mt-2 text-xs text-[var(--muted)] italic">
                    Voice responses recommended for best results.
                  </p>
                )}
              </div>

              {/* Answer Input */}
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Your response {focusMode && <span className="text-xs text-[var(--muted)]">(paste disabled)</span>}
                </label>
                {loading && answerText ? (
                  <Skeleton className="h-32" variant="rectangular" />
                ) : (
                  <textarea
                    className="w-full rounded-lg border border-[var(--border)] p-3 text-sm text-[var(--text)] focus:ring-2 focus:ring-indigo-200 focus:border-[var(--primary)] disabled:bg-slate-50 disabled:cursor-not-allowed"
                    rows={6}
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    onPaste={(e) => {
                      if (focusMode) {
                        e.preventDefault();
                      }
                    }}
                    placeholder="Type your response here..."
                    disabled={loading || completed}
                  />
                )}
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {answerText.length} characters • Your responses may be quoted in the interview report
                </p>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={submitAnswer}
                    disabled={loading || completed || !answerText.trim()}
                    className="app-btn-primary px-6 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? "Submitting..." : "Submit response"}
                  </button>
                  {loading && (
                    <Skeleton className="h-6 w-24" />
                  )}
                </div>
              </div>
            </Card>
          )}

            {/* Score Trend Card */}
            {scoreSummary && !completed && (
            <Card className="shadow-sm">
              <h4 className="text-sm font-semibold text-[var(--text)] mb-3">Score trend</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-[var(--muted)]">Overall</p>
                  <p className="text-lg font-semibold text-[var(--text)]">
                    {scoreSummary.avg.overall.toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Technical</p>
                  <p className="text-lg font-semibold text-[var(--text)]">
                    {scoreSummary.avg.technical.toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Communication</p>
                  <p className="text-lg font-semibold text-[var(--text)]">
                    {scoreSummary.avg.communication.toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Problem solving</p>
                  <p className="text-lg font-semibold text-[var(--text)]">
                    {scoreSummary.avg.problemSolving.toFixed(1)}
                  </p>
                </div>
              </div>
              {commsIsLowest && (
                <div className="mt-3 rounded-lg bg-yellow-50 border border-yellow-200 p-2">
                  <p className="text-xs text-yellow-800">
                    Try a 3-part structure: context → action → outcome
                  </p>
                </div>
              )}
            </Card>
          )}

            {/* Latest Evaluation */}
            {lastEval?.evaluation && !completed && (
            <Card variant="outlined" className="shadow-sm">
              <h4 className="text-sm font-semibold text-[var(--text)] mb-3">Latest evaluation</h4>
              <div className="flex gap-4 mb-4">
                <div>
                  <p className="text-xs text-[var(--muted)]">Overall</p>
                  <p className="text-xl font-bold text-[var(--text)]">
                    {lastEval.evaluation.overall}/10
                  </p>
                </div>
                <div className="flex gap-3">
                  <div>
                    <p className="text-xs text-[var(--muted)]">Technical</p>
                    <p className="text-sm font-semibold text-[var(--text)]">{lastEval.evaluation.scores.technical}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">Communication</p>
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {lastEval.evaluation.scores.communication}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">Problem solving</p>
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {lastEval.evaluation.scores.problemSolving}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-[var(--text)] mb-2">Strengths</p>
                  <ul className="text-xs text-[var(--muted)] space-y-1">
                    {lastEval.evaluation.strengths.map((s, i) => (
                      <li key={i} className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text)] mb-2">Areas to improve</p>
                  <ul className="text-xs text-[var(--muted)] space-y-1">
                    {lastEval.evaluation.gaps.map((g, i) => (
                      <li key={i} className="flex items-start">
                        <span className="text-yellow-600 mr-2">→</span>
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {lastEval.evaluation.followUpQuestion && (
                <div className="mt-4 rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-medium text-[var(--text)] mb-1">Suggested follow-up</p>
                  <p className="text-xs text-[var(--muted)]">{lastEval.evaluation.followUpQuestion}</p>
                </div>
              )}
            </Card>
          )}

            {/* Interview Report */}
            {completed && (
            <Card variant="elevated" className="shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-[var(--text)]">Interview report</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Comprehensive evaluation from all responses and assessments
                  </p>
                </div>
                <button
                  onClick={generateReport}
                  disabled={reportLoading}
                  className="app-btn-primary px-6 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {reportLoading ? (
                    <span className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4" variant="circular" />
                      Generating...
                    </span>
                  ) : report ? (
                    "Regenerate report"
                  ) : (
                    "Generate report"
                  )}
                </button>
              </div>

              {reportLoading && !report && (
                <div className="space-y-4">
                  <Skeleton className="h-24" variant="rectangular" />
                  <Skeleton className="h-32" variant="rectangular" />
                  <Skeleton className="h-48" variant="rectangular" />
                </div>
              )}

              {reportError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4 shadow-sm">
                  <p className="text-sm text-red-800 font-medium">{reportError}</p>
                </div>
              )}

              {report && (
                <div className="space-y-6">
                  {/* Share Link Section */}
                  {shareToken && (
                    <Card variant="outlined" className="shadow-sm">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[var(--muted)] mb-1">Shareable report link</p>
                          <p className="text-xs font-mono text-[var(--text)] truncate" id="share-url">
                            /share/{shareToken}
                          </p>
                        </div>
                        <button
                          onClick={copyShareLink}
                          className="app-btn-secondary flex-shrink-0 px-4 py-2 text-sm"
                        >
                          {copySuccess ? "Copied" : "Copy link"}
                        </button>
                      </div>
                    </Card>
                  )}

                  {/* Report View */}
                  <ReportView
                    report={report}
                    scoreSummary={reportScoreSummary || data?.scoreSummary || undefined}
                    context={{
                      mode: data?.session.mode,
                      role: data?.session.role,
                      level: data?.session.level,
                    }}
                    readOnly={false}
                  />
                </div>
              )}
            </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
