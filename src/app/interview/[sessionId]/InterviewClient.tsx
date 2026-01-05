"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Lock, ArrowRight as ArrowRightIcon, CheckCircle2 } from "lucide-react";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import Progress from "@/components/Progress";
import Skeleton from "@/components/Skeleton";
import InterviewerPanel from "@/components/InterviewerPanel";
import ReportView from "@/components/ReportView";
import { clientLogger } from "@/lib/clientLogger";
import PresenceCheckModal from "@/components/PresenceCheckModal";
import VoiceAnswerRecorder from "@/components/VoiceAnswerRecorder";
import { ToastManager, ToastType } from "@/components/Toast";

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
  questions?: Array<{
    id: string;
    text: string;
    category: string;
    difficulty: string;
    index: number;
    answered: boolean;
    evaluated: boolean;
  }>;
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
  const searchParams = useSearchParams();
  const isRecruiterView = searchParams.get("view") === "recruiter";
  
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
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [tabSwitchWarning, setTabSwitchWarning] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [interviewStartTime, setInterviewStartTime] = useState<number | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type?: ToastType }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-save draft answer to localStorage
  useEffect(() => {
    if (answerText && data?.session.status === "in_progress") {
      const draftKey = `interview_draft_${sessionId}_${data.currentQuestion?.id || 'current'}`;
      localStorage.setItem(draftKey, answerText);
    }
  }, [answerText, sessionId, data?.session.status, data?.currentQuestion?.id]);

  // Load draft answer from localStorage (only when interview is already in progress, not during start)
  useEffect(() => {
    if (data?.currentQuestion?.id && data?.session.status === "in_progress" && !answerText && !loading) {
      const draftKey = `interview_draft_${sessionId}_${data.currentQuestion.id}`;
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        setAnswerText(saved);
      }
    }
  }, [data?.currentQuestion?.id, sessionId, data?.session.status, loading]);

  // Clear draft when question changes
  useEffect(() => {
    if (previousQuestionId && data?.currentQuestion?.id && previousQuestionId !== data.currentQuestion.id) {
      const oldDraftKey = `interview_draft_${sessionId}_${previousQuestionId}`;
      localStorage.removeItem(oldDraftKey);
    }
  }, [data?.currentQuestion?.id, previousQuestionId, sessionId]);

  // Track interview start time and elapsed time
  useEffect(() => {
    if (data?.session.status === "in_progress" && !interviewStartTime) {
      // Try to get start time from session, or use current time
      const startTime = data.session.id ? Date.now() : Date.now(); // Could get from session.createdAt
      setInterviewStartTime(startTime);
    }
  }, [data?.session.status, interviewStartTime]);

  // Update elapsed time every second
  useEffect(() => {
    if (interviewStartTime && data?.session.status === "in_progress") {
      const interval = setInterval(() => {
        setTimeElapsed(Math.floor((Date.now() - interviewStartTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [interviewStartTime, data?.session.status]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  async function refresh() {
    // Add cache-busting timestamp
    const timestamp = Date.now();
    const res = await fetch(`/api/sessions/${sessionId}?t=${timestamp}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || json.message || "Failed");
    // Handle standardized API response format
    const responseData = json.data || json;
    setData(responseData);
    setInitialLoading(false);
    setPresence(responseData.presence || null);
    setTabSwitchCount(responseData.session?.tabSwitchCount || 0);
    
    if (responseData?.session?.status === "completed") {
      fetchReport().catch(() => {});
    }
  }

  async function fetchReport() {
    const res = await fetch(`/api/sessions/${sessionId}/report`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || json.message || "Failed to fetch report");
    // Handle standardized API response format
    const responseData = json.data || json;
    setReport(responseData.report ?? null);
    setReportScoreSummary(responseData.scoreSummary ?? null);
    setShareToken(responseData.shareToken ?? null);
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
      addToast("Share link copied to clipboard", "success");
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
        addToast("Share link copied to clipboard", "success");
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
    // Don't set isTyping here - it should only be set when actually generating questions
    // setIsTyping(true);
    
    try {
      const res = await fetch(`/api/sessions/${sessionId}/start`, {
        method: "POST",
      });
      
      let json: any = {};
      try {
        json = await res.json();
      } catch (e) {
        clientLogger.error("Failed to parse response", e instanceof Error ? e : new Error(String(e)), { sessionId });
        setError("Failed to parse server response");
        setLoading(false);
        return;
      }
      
      if (!res.ok) {
        const errorMsg = json.error || `Failed to start interview (${res.status})`;
        setError(errorMsg);
        addToast(errorMsg, "error");
        setLoading(false);
        return;
      }
      
      // Wait a bit for database to update, then refresh
      await new Promise(resolve => setTimeout(resolve, 1000));
      await refresh();
      
      // Reset loading state after refresh
      setLoading(false);
    } catch (error) {
      clientLogger.error("Network error starting interview", error instanceof Error ? error : new Error(String(error)), { sessionId });
      const errorMsg = "Network error. Please check your connection and try again.";
      setError(errorMsg);
      addToast(errorMsg, "error");
      setLoading(false);
      setIsTyping(false);
    }
  }

  const addToast = (message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  async function previousQuestion() {
    if (!data || data.session.currentQuestionIndex === 0) return;
    
    setError(null);
    setLoading(true);
    setIsTyping(true);
    const res = await fetch(`/api/sessions/${sessionId}/previous`, {
      method: "POST",
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      addToast(json.error || "Failed to go back", "error");
      setIsTyping(false);
      return;
    }
    await refresh();
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
      const errorMsg = json.error || "Failed to advance";
      addToast(errorMsg, "error");
      setIsTyping(false);
      return;
    }
    await refresh();
    // Small delay to show typing indicator
    setTimeout(() => setIsTyping(false), 500);
  }

  async function jumpToQuestion(targetIndex: number) {
    if (!data || targetIndex === data.session.currentQuestionIndex) return;
    if (targetIndex < 0 || targetIndex >= data.session.totalQuestions) return;

    setError(null);
    setLoading(true);
    const diff = targetIndex - data.session.currentQuestionIndex;
    
    try {
      if (diff > 0) {
        // Move forward
        for (let i = 0; i < diff; i++) {
          await fetch(`/api/sessions/${sessionId}/next`, { method: "POST" });
        }
      } else {
        // Move backward
        for (let i = 0; i < Math.abs(diff); i++) {
          await fetch(`/api/sessions/${sessionId}/previous`, { method: "POST" });
        }
      }
      await refresh();
    } catch (error) {
      addToast("Failed to jump to question", "error");
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer() {
    // Prevent double submission
    if (isSubmitting) {
      return;
    }
    
    setError(null);
    
    // Basic client-side validation
    if (!answerText || !answerText.trim()) {
      const errorMsg = "Please enter an answer before submitting";
      setError(errorMsg);
      addToast(errorMsg, "error");
      return;
    }
    
    setIsSubmitting(true);
    setLoading(true);
    setIsTyping(true);

    // Clear draft from localStorage
    if (data?.currentQuestion?.id) {
      const draftKey = `interview_draft_${sessionId}_${data.currentQuestion.id}`;
      localStorage.removeItem(draftKey);
    }

    try {
      const res = await fetch(`/api/sessions/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerText: answerText.trim() }),
      });

      const json = (await res.json().catch(() => ({}))) as Partial<EvalResp> & {
        error?: string;
        message?: string;
        details?: string;
        data?: any;
      };

      if (!res.ok) {
        // Extract error message from standardized API response
        const errorMsg = json.error || json.message || json.details || `Failed to submit answer (${res.status})`;
        setError(errorMsg);
        addToast(errorMsg, "error");
        setIsTyping(false);
        setLoading(false);
        setIsSubmitting(false);
        clientLogger.error("Answer submission failed", new Error(errorMsg), { 
          sessionId, 
          status: res.status,
          response: json 
        });
        return;
      }

      // Handle standardized API response format
      const responseData = (json as any).data || json;
      setLastEval(responseData as EvalResp);
      setAnswerText("");
      setShowConfirmDialog(false);
      await refresh();
      // Small delay to show typing indicator for next question
      setTimeout(() => {
        setIsTyping(false);
        setLoading(false);
        setIsSubmitting(false);
      }, 500);
    } catch (error) {
      setIsTyping(false);
      setLoading(false);
      setIsSubmitting(false);
      const errorMsg = error instanceof Error ? error.message : "Network error submitting answer";
      setError(errorMsg);
      addToast(errorMsg, "error");
      clientLogger.error("Network error submitting answer", error instanceof Error ? error : new Error(String(error)), { sessionId });
    }
  }

  const handleSubmitClick = () => {
    setShowConfirmDialog(true);
  };



  useEffect(() => {
    refresh().catch((e) => {
      const errorMsg = e.message || "Failed to load session";
      setError(errorMsg);
      addToast(errorMsg, "error");
      setInitialLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const started = (data?.session.totalQuestions ?? 0) > 0;
  const completed = data?.session.status === "completed";
  const currentQuestionNum = (data?.session.currentQuestionIndex ?? 0) + 1;

  // Beforeunload warning during active interview
  useEffect(() => {
    if (data?.session.status === "in_progress" && !completed) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = "You have an active interview in progress. Are you sure you want to leave?";
        return e.returnValue;
      };

      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }
  }, [data?.session.status, completed]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter to submit (with Ctrl/Cmd to avoid accidental submits)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isSubmitting && !loading && !completed && answerText.trim()) {
        e.preventDefault();
        handleSubmitClick();
      }
      // Esc to cancel confirmation dialog
      if (e.key === 'Escape' && showConfirmDialog) {
        e.preventDefault();
        setShowConfirmDialog(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, loading, completed, answerText, showConfirmDialog, handleSubmitClick]);

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
  // Only show typing indicator when we're actually generating/evaluating (not during general loading)
  // Show typing when: isTyping is true AND we have a current question AND we're not in general loading state
  const showTyping = isTyping && !!data?.currentQuestion && !loading;

  return (
    <div className={`space-y-6 ${focusMode ? "bg-slate-50 p-4 rounded-lg" : ""}`}>
      {/* Toast Manager */}
      <ToastManager toasts={toasts} onRemove={removeToast} />

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
            {timeElapsed > 0 && data?.session.status === "in_progress" && (
              <Badge variant="info" className="app-badge">
                <span title="Time elapsed">⏱️ {formatTime(timeElapsed)}</span>
              </Badge>
            )}
            {tabSwitchCount > 0 && !isRecruiterView && data?.session.status === "in_progress" && (
              <Badge 
                variant={tabSwitchCount > 3 ? "error" : "warning"} 
                className="app-badge"
              >
                {tabSwitchCount} Switch{tabSwitchCount > 1 ? "es" : ""}
              </Badge>
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

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-[var(--text)] mb-2">Confirm Submission</h3>
            <p className="text-sm text-[var(--muted)] mb-4">
              Are you sure you want to submit this answer? You won't be able to edit it after submission.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--card)]"
              >
                Cancel (Esc)
              </button>
              <button
                onClick={submitAnswer}
                disabled={isSubmitting || loading}
                className="app-btn-primary px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting || loading ? "Submitting..." : "Submit Answer"}
              </button>
            </div>
          </Card>
        </div>
      )}

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
              {data?.session.mode === "company" 
                ? "Company" 
                : data?.session.mode === "college"
                ? "College"
                : "Individual"}
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
        <div className="relative">
          {/* Main 2-Column Layout for Desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
            {/* Left Column: AI Interviewer + Question */}
            <div className="space-y-6">
              {/* AI Interviewer Panel */}
              <Card variant="elevated">
                <InterviewerPanel
                  question={currentQuestionText}
                  isTyping={showTyping}
                  readAloud={readAloud}
                  onReadAloudChange={setReadAloud}
                  showVideoPlaceholder={true}
                />
              </Card>

              {/* Question Card - Only show if we have a question */}
              {!completed && data?.currentQuestion && (
                <Card variant="elevated" className="transition-all duration-300">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="info" className="app-badge">
                          Question {currentQuestionNum} of {data.session.totalQuestions}
                        </Badge>
                        <Badge className="app-badge">{data.currentQuestion.category}</Badge>
                        <Badge variant="default" className="app-badge">{data.currentQuestion.difficulty}</Badge>
                      </div>
                      <div className="flex gap-2">
                        {data.session.currentQuestionIndex > 0 && (
                          <button
                            onClick={previousQuestion}
                            disabled={loading}
                            className="app-btn-secondary px-3 py-1.5 text-sm disabled:opacity-60"
                          >
                            <ArrowLeft className="w-4 h-4 inline mr-1" /> Previous
                          </button>
                        )}
                        {data.session.currentQuestionIndex < data.session.totalQuestions - 1 && (
                          <button
                            onClick={nextQuestion}
                            disabled={loading}
                            className="app-btn-secondary px-3 py-1.5 text-sm disabled:opacity-60"
                          >
                            Next <ArrowRight className="w-4 h-4 inline ml-1" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div className="mb-4 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <p className="text-base text-slate-900 leading-relaxed font-medium">
                      {data.currentQuestion.text}
                    </p>
                  </div>

                  {/* Coaching Hint */}
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <p className="text-xs font-medium text-amber-900 mb-1">💡 Coaching Tip</p>
                    <p className="text-xs text-amber-700">
                      {getCoachingHint(data.currentQuestion.category)}
                    </p>
                  </div>
                </Card>
              )}
            </div>

            {/* Right Column: Answer Area */}
            <div className="space-y-6">
          {/* Visual Question Timeline */}
          {!completed && data?.questions && data.questions.length > 0 && (
            <Card className="shadow-sm overflow-hidden">
              <div className="p-4">
                <h4 className="text-sm font-semibold text-[var(--text)] mb-4">Interview Progress</h4>
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {data.questions.map((q, idx) => {
                    const isCurrent = idx === data.session.currentQuestionIndex;
                    const isAnswered = q.answered;
                    const isReached = idx <= data.session.currentQuestionIndex;
                    const isLocked = idx > data.session.currentQuestionIndex;
                    
                    return (
                      <div key={q.id} className="flex items-center gap-2 flex-shrink-0">
                        {/* Question Circle */}
                        <div className="relative">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                              isCurrent
                                ? "bg-[var(--primary)] text-white ring-4 ring-[var(--primary)] ring-opacity-30 scale-110"
                                : isAnswered
                                ? "bg-green-500 text-white"
                                : isLocked
                                ? "bg-slate-200 text-slate-400 border-2 border-dashed border-slate-300"
                                : "bg-slate-300 text-slate-600"
                            }`}
                          >
                            {isLocked ? (
                              <Lock className="w-3 h-3" />
                            ) : isAnswered ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <span>{idx + 1}</span>
                            )}
                          </div>
                          {/* Pulse animation for current question */}
                          {isCurrent && (
                            <div className="absolute inset-0 rounded-full bg-[var(--primary)] animate-ping opacity-20" />
                          )}
                        </div>
                        
                        {/* Connector Line (not after last item) */}
                        {data.questions && idx < data.questions.length - 1 && (
                          <div
                            className={`h-1 w-8 transition-colors ${
                              isAnswered
                                ? "bg-green-500"
                                : isReached
                                ? "bg-[var(--primary)]"
                                : "bg-slate-200"
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* Status Text */}
                <div className="mt-4 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-slate-600">Completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[var(--primary)] ring-2 ring-[var(--primary)] ring-opacity-30" />
                      <span className="text-slate-600">Current</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-slate-200 border-2 border-dashed border-slate-300" />
                      <span className="text-slate-600">Locked</span>
                    </div>
                  </div>
                  <span className="text-slate-500">
                    {data.questions.filter(q => q.answered).length} of {data.questions.length} completed
                  </span>
                </div>
              </div>
            </Card>
          )}


              {/* Answer Input Card */}
              {!completed && data?.currentQuestion && (
                <Card variant="elevated" className="transition-all duration-300">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-[var(--text)] mb-2">
                      Your Response
                    </h3>
                    {focusMode && (
                      <p className="text-xs text-[var(--muted)]">(Paste disabled in focus mode)</p>
                    )}
                  </div>

                  {/* Voice Answer Recorder */}
                  <div className="mb-4">
                    <VoiceAnswerRecorder
                      key={data.currentQuestion.id}
                      onTranscript={(text) => setAnswerText(text)}
                      disabled={loading || completed}
                    />
                  </div>

                  {/* Text Answer Input */}
                  <div>
                    <textarea
                      className="w-full rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--text)] focus:ring-2 focus:ring-indigo-200 focus:border-[var(--primary)] disabled:bg-slate-50 disabled:cursor-not-allowed min-h-[200px]"
                      rows={8}
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      onPaste={(e) => {
                        if (focusMode) {
                          e.preventDefault();
                        }
                      }}
                      placeholder="Type your response here or use voice recording above..."
                      disabled={loading || completed}
                    />
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {answerText.length} characters • Your responses may be quoted in the interview report
                    </p>
                  </div>

                  {/* Submit Button */}
                  <div className="mt-6 flex items-center gap-3">
                    <button
                      onClick={handleSubmitClick}
                      disabled={isSubmitting || loading || completed || !answerText.trim()}
                      className="app-btn-primary px-6 py-3 disabled:opacity-60 disabled:cursor-not-allowed flex-1"
                    >
                      {isSubmitting || loading ? "Submitting..." : "Submit Answer"}
                    </button>
                    {loading && <Skeleton className="h-10 w-24" />}
                  </div>
                  <p className="mt-2 text-xs text-center text-[var(--muted)]">
                    Press Ctrl+Enter to submit
                  </p>
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
                            <CheckCircle2 className="w-3 h-3 text-green-600 mr-2 inline" />
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
                            <ArrowRightIcon className="w-3 h-3 text-yellow-600 mr-2 inline" />
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
                                {typeof window !== 'undefined' ? `${window.location.origin}/share/${shareToken}` : `/share/${shareToken}`}
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
                    </div>
                  )}
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report View - Full Width */}
      {completed && report && (
        <ReportView
          report={report}
          scoreSummary={reportScoreSummary || undefined}
          context={{
            mode: data?.session.mode,
            role: data?.session.role,
            level: data?.session.level,
          }}
          viewType={isRecruiterView ? "recruiter" : "candidate"}
        />
      )}
    </div>
  );
}
