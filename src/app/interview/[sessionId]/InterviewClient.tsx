"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Lock, ArrowRight as ArrowRightIcon, CheckCircle2, Lightbulb, Info } from "lucide-react";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import Progress from "@/components/Progress";
import Skeleton from "@/components/Skeleton";
import InterviewerPanel from "@/components/InterviewerPanel";
import ReportView from "@/components/ReportView";
import InterviewHelpPanel from "@/components/InterviewHelpPanel";
import AnswerFeedback from "@/components/AnswerFeedback";
import { clientLogger } from "@/lib/clientLogger";
import PresenceCheckModal from "@/components/PresenceCheckModal";
import VoiceAnswerRecorder from "@/components/VoiceAnswerRecorder";
import { ToastContainer, ToastType } from "@/components/Toast";

// Loading Tips Component
function LoadingTips() {
  const tips = [
    { icon: "🎙️", text: "Find a quiet place with stable internet connection" },
    { icon: "💡", text: "You can use voice or text to answer questions" },
    { icon: "⏱️", text: "Take your time to think before answering" },
    { icon: "📝", text: "Be specific and provide examples in your answers" },
    { icon: "🎯", text: "Focus on demonstrating your problem-solving approach" },
  ];

  const [currentTip, setCurrentTip] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % tips.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [tips.length]);

  return (
    <div className="relative h-20 overflow-hidden">
      {tips.map((tip, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-all duration-500 transform ${index === currentTip
            ? "opacity-100 translate-y-0"
            : index < currentTip
              ? "opacity-0 -translate-y-full"
              : "opacity-0 translate-y-full"
            }`}
        >
          <div className="flex items-start gap-3 p-4 bg-[var(--info-bg)] border border-[var(--info)]/30 rounded-xl">
            <span className="text-2xl flex-shrink-0">{tip.icon}</span>
            <p className="text-sm text-[var(--text)] font-medium leading-relaxed">
              {tip.text}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}


type ApiState = {
  session: {
    id: string;
    mode: string;
    role?: string;
    level?: string;
    status: string;
    currentQuestionIndex: number;
    totalQuestions: number;
    startedAt?: number; // Timestamp when interview was started
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
  const [questionDisplayedAt, setQuestionDisplayedAt] = useState<number | null>(null);
  const [lastActivityAt, setLastActivityAt] = useState<number>(Date.now());
  const [sessionTimeoutWarning, setSessionTimeoutWarning] = useState<number | null>(null); // Minutes remaining

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

    // Prevent overwriting 'in_progress' with stale 'created' status from server lag/cache
    setData((current) => {
      // If we are locally 'in_progress' or 'completed' but server says 'created',
      // keep our local state to preventing looping back to start screen.
      if ((current?.session?.status === 'in_progress' || current?.session?.status === 'completed')
        && responseData?.session?.status === 'created') {
        console.warn("Ignoring stale 'created' status from server refresh");
        return current;
      }
      return responseData;
    });
    setInitialLoading(false);
    setPresence(responseData.presence || null);
    setTabSwitchCount(responseData.session?.tabSwitchCount || 0);

    if (responseData?.session?.status === "completed") {
      // Check if we have a report
      try {
        const res = await fetch(`/api/sessions/${sessionId}/report`);
        const json = await res.json().catch(() => ({}));
        const reportData = json.data || json;

        if (reportData.report) {
          setReport(reportData.report);
          setReportScoreSummary(reportData.scoreSummary ?? null);
          setShareToken(reportData.shareToken ?? null);
        } else {
          // Generate it if missing
          generateReport();
        }
      } catch (e) {
        console.error("Failed to check report status", e);
      }
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

    try {
      // Set a long timeout (60s) to allow OpenAI to finish
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const res = await fetch(`/api/sessions/${sessionId}/report`, {
        method: "POST",
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setReportError(json.error || json.message || "Failed to generate report");
        return;
      }

      // Handle standardized API response format
      const responseData = json.data || json;
      setReport(responseData.report ?? null);
      setShareToken(responseData.shareToken ?? null);
      setSuccessMessage("Report generated successfully");
      setTimeout(() => setSuccessMessage(null), 3000);

      // Fetch score summary from report endpoint
      const reportRes = await fetch(`/api/sessions/${sessionId}/report`);
      const reportJson = await reportRes.json().catch(() => ({}));
      if (reportRes.ok) {
        const reportData = reportJson.data || reportJson;
        setReportScoreSummary(reportData.scoreSummary ?? null);
        setShareToken(reportData.shareToken ?? null);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setReportError("Report generation timed out. The server is taking too long. Please refresh the page to check if it completed.");
      } else {
        setReportError("Failed to generate report. Please try again.");
      }
      console.error("Report generation error:", error);
    } finally {
      setReportLoading(false);
      setIsTyping(false);
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
    // Request fullscreen (Must be first to be close to user gesture)
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        await (document.documentElement as any).webkitRequestFullscreen(); // Safari
      }
    } catch (e) {
      console.warn("Fullscreen request failed", e);
    }

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

      addToast("Interview started successfully", "success");

      // Optimistically update state using the response data
      // This bypasses any fetch lag/caching issues
      const responseData = json.data || json;
      if (responseData.questions && Array.isArray(responseData.questions)) {
        setData((prev) => {
          if (!prev) return null;

          // Map API questions to UI format
          const newQuestions = responseData.questions.map((q: any, i: number) => ({
            id: q.id,
            text: q.text,
            category: q.category,
            difficulty: q.difficulty,
            index: i,
            answered: false,
            evaluated: false
          }));

          return {
            ...prev,
            session: {
              ...prev.session,
              status: "in_progress",
              totalQuestions: newQuestions.length,
            },
            questions: newQuestions,
            // Set current question to first one
            currentQuestion: {
              id: newQuestions[0].id,
              text: newQuestions[0].text,
              category: newQuestions[0].category,
              difficulty: newQuestions[0].difficulty,
            }
          };
        });
      }

      // Refresh in background to sync fully
      refresh().catch(() => { });

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
    addToast("Moved to previous question", "info");
    setIsTyping(false);
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
    setIsTyping(false);
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
      addToast(`Jumped to question ${targetIndex + 1}`, "info");
    } catch (error) {
      addToast("Failed to jump to question", "error");
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer() {
    // Prevent double submission
    if (loading) return;

    // Client-side validation
    if (answerText.trim().length < 10) {
      const msg = "Answer is too short. Please provide at least 10 characters.";
      setError(msg);
      addToast(msg, "warning");
      return;
    }

    setError(null);
    setLoading(true);
    setIsTyping(true);

    // Ensure we have a questionDisplayedAt timestamp
    const displayedAt = questionDisplayedAt ||
      (data?.session.startedAt ? data.session.startedAt : Date.now());
    const finalDisplayedAt = displayedAt > 0 ? displayedAt : Date.now() - 1000;

    // Clear draft from localStorage
    if (data?.currentQuestion?.id) {
      const draftKey = `interview_draft_${sessionId}_${data.currentQuestion.id}`;
      localStorage.removeItem(draftKey);
    }

    try {
      const res = await fetch(`/api/sessions/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answerText: answerText.trim(),
          questionDisplayedAt: finalDisplayedAt,
        }),
      });

      const json = await res.json().catch(() => ({}));
      const responseData = json.data || json;
      const errorMsg = json.message || json.error;

      if (!res.ok) {
        const finalErrorMsg = errorMsg || "Failed to submit answer";
        setError(finalErrorMsg);
        addToast(finalErrorMsg, "error");
        setLoading(false);
        setIsTyping(false);
        return;
      }

      // Success - optimistically update state from API response
      const evalResponse: EvalResp = {
        ok: true,
        evaluation: responseData.evaluation,
        scoreSummary: responseData.scoreSummary,
        advancedToIndex: responseData.advancedToIndex,
        status: responseData.status,
      };

      setLastEval(evalResponse);
      setAnswerText("");
      setQuestionDisplayedAt(null);
      setShowConfirmDialog(false);
      addToast("Answer submitted and evaluated", "success");

      // Optimistically update the current state without a full refresh
      if (data && responseData.advancedToIndex !== undefined && responseData.status) {
        setData({
          ...data,
          session: {
            ...data.session,
            currentQuestionIndex: responseData.advancedToIndex,
            status: responseData.status,
          },
          currentQuestion: data.questions?.[responseData.advancedToIndex] ? {
            id: data.questions[responseData.advancedToIndex].id,
            text: data.questions[responseData.advancedToIndex].text,
            category: data.questions[responseData.advancedToIndex].category,
            difficulty: data.questions[responseData.advancedToIndex].difficulty,
          } : null,
          scoreSummary: responseData.scoreSummary,
        });
      }

      setIsTyping(false);
      setLoading(false);

      // Refresh in background to sync any missed updates (non-blocking, silent)
      refresh().catch(() => { });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Network error occurred";
      setError(errorMsg);
      addToast(errorMsg, "error");
      setLoading(false);
      setIsTyping(false);
    }
  }

  const handleSubmitClick = () => {
    if (answerText.trim().length < 10) {
      addToast("Answer is too short. Please provide at least 10 characters.", "warning");
      return;
    }
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

  // Security Monitors (Fullscreen, Tab Switch, Copy/Paste)
  useEffect(() => {
    if (!started || completed || isRecruiterView) return;

    // Detect Tab Switching
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount(prev => {
          const newCount = prev + 1;
          if (newCount > 3 && !tabSwitchWarning) {
            setTabSwitchWarning("Frequent tab switching detected. This incident will be reported.");
          }
          // Persist tab switch count to server in background if possible, or local state used in next submit
          return newCount;
        });
        addToast("Warning: Tab switching is monitored.", "warning");
      }
    };

    // Detect Fullscreen Exit
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        addToast("Please maintain fullscreen mode for the duration of the interview.", "warning");
      }
    };

    // Detect Copy
    const handleCopy = (e: ClipboardEvent) => {
      // Log copy attempt
      addToast("Copying content is monitored.", "warning");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange); // Safari
    document.addEventListener("copy", handleCopy);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("copy", handleCopy);
    };
  }, [started, completed, isRecruiterView, tabSwitchWarning]);

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
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !loading && !completed && answerText.trim()) {
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
  }, [loading, completed, answerText, showConfirmDialog, handleSubmitClick]);

  // Track when question is displayed
  useEffect(() => {
    if (data?.currentQuestion?.id && data?.session.status === "in_progress") {
      const now = Date.now();
      // Only update if this is a new question (different from previous)
      if (data.currentQuestion.id !== previousQuestionId) {
        setQuestionDisplayedAt(now);
        setLastActivityAt(now);
        setPreviousQuestionId(data.currentQuestion.id);
      }
    }
  }, [data?.currentQuestion?.id, data?.session.status, previousQuestionId]);

  // Track user activity for session timeout
  useEffect(() => {
    if (data?.session.status === "in_progress" && !completed) {
      const handleActivity = () => {
        setLastActivityAt(Date.now());
      };

      // Track various user interactions
      window.addEventListener('mousedown', handleActivity);
      window.addEventListener('keydown', handleActivity);
      window.addEventListener('scroll', handleActivity);
      window.addEventListener('touchstart', handleActivity);

      return () => {
        window.removeEventListener('mousedown', handleActivity);
        window.removeEventListener('keydown', handleActivity);
        window.removeEventListener('scroll', handleActivity);
        window.removeEventListener('touchstart', handleActivity);
      };
    }
  }, [data?.session.status, completed]);

  // Session timeout check (30 minutes inactivity)
  useEffect(() => {
    if (data?.session.status === "in_progress" && !completed) {
      const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
      const WARNING_MS = 5 * 60 * 1000; // Warn 5 minutes before timeout

      const checkTimeout = () => {
        const now = Date.now();
        const inactiveTime = now - lastActivityAt;
        const timeRemaining = TIMEOUT_MS - inactiveTime;
        const minutesRemaining = Math.ceil(timeRemaining / 60000);

        if (timeRemaining <= 0) {
          // Session expired
          addToast("Session expired due to inactivity. Please refresh to continue.", "warning");
          setSessionTimeoutWarning(0);
        } else if (timeRemaining <= WARNING_MS && minutesRemaining !== sessionTimeoutWarning) {
          // Show warning
          setSessionTimeoutWarning(minutesRemaining);
          addToast(`Session will expire in ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''} due to inactivity.`, "warning");
        } else if (timeRemaining > WARNING_MS) {
          setSessionTimeoutWarning(null);
        }
      };

      const interval = setInterval(checkTimeout, 60000); // Check every minute
      checkTimeout(); // Initial check

      return () => clearInterval(interval);
    }
  }, [data?.session.status, completed, lastActivityAt, sessionTimeoutWarning]);

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
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Presence Modal */}
      {showPresenceModal && (
        <PresenceCheckModal
          sessionId={sessionId}
          phrasePrompt={presence?.phrasePrompt || "I confirm this interview response is my own."}
          onComplete={handlePresenceComplete}
          onSkip={handlePresenceSkip}
        />
      )}

      {/* Top Header Bar - Modern */}
      <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md border-b border-white/10 py-4 -mx-4 px-4 mb-8 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">AI Interview Platform</h1>
            <p className="text-sm text-slate-400 font-medium">Professional Interview Experience</p>
          </div>
          <div className="flex items-center gap-3">
            {presence?.completedAt && (
              <Badge variant="success" className="app-badge px-3 py-1.5 shadow-sm font-semibold">Presence Verified</Badge>
            )}
            {timeElapsed > 0 && data?.session.status === "in_progress" && (
              <div className="px-4 py-2 bg-slate-100 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-sm font-semibold text-slate-700" title="Time elapsed">
                  ⏱️ {formatTime(timeElapsed)}
                </span>
              </div>
            )}
            {tabSwitchCount > 0 && !isRecruiterView && data?.session.status === "in_progress" && (
              <Badge
                variant={tabSwitchCount > 3 ? "error" : "warning"}
                className="app-badge px-3 py-1.5 shadow-sm font-semibold"
              >
                {tabSwitchCount} Switch{tabSwitchCount > 1 ? "es" : ""}
              </Badge>
            )}
            <Badge variant={getStatusBadgeVariant(data?.session.status || "created")} className="app-badge px-3 py-1.5 shadow-sm font-semibold">
              {data?.session.status === "in_progress"
                ? "In Progress"
                : data?.session.status === "completed"
                  ? "Completed"
                  : "Created"}
            </Badge>
            {started && !completed && (
              <label className="flex items-center gap-2.5 cursor-pointer px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={focusMode}
                  onChange={(e) => setFocusMode(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0"
                />
                <span className="text-sm font-medium text-slate-700">Focus mode</span>
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog - Modern */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full mx-4 shadow-2xl border-0">
            <div className="p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                <Info className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 text-center">Confirm Submission</h3>
              <p className="text-sm text-slate-400 mb-6 text-center leading-relaxed">
                Are you sure you want to submit this answer? You won't be able to edit it after submission.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 px-4 py-3 text-sm font-semibold border-2 border-slate-600 rounded-xl hover:bg-white/5 transition-colors text-slate-300"
                >
                  Cancel (Esc)
                </button>
                <button
                  onClick={submitAnswer}
                  disabled={loading}
                  className="flex-1 px-4 py-3 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Submitting..." : "Submit Answer"}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Toast Messages - Modern */}
      {error && (
        <div className="rounded-xl bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 p-5 shadow-lg mb-6">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">!</span>
            </div>
            <p className="text-sm text-red-900 font-semibold flex-1">{error}</p>
          </div>
        </div>
      )}
      {successMessage && (
        <div className="rounded-xl bg-[var(--success-bg)] border border-[var(--success)]/30 p-5 shadow-lg mb-6 backdrop-blur-md">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[var(--success)] flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
            <p className="text-sm text-[var(--success)] font-semibold flex-1">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Context Card - Modern */}
      <Card className="shadow-lg border-0 bg-[var(--card)] mb-8 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs font-semibold text-[var(--muted)] mb-2 uppercase tracking-wide">Mode</p>
            <Badge variant="info" className="px-3 py-1.5 shadow-sm font-semibold">
              {data?.session.mode === "company"
                ? "Company"
                : data?.session.mode === "college"
                  ? "College"
                  : "Individual"}
            </Badge>
          </div>
          {data?.session.role && (
            <div>
              <p className="text-xs font-semibold text-[var(--muted)] mb-2 uppercase tracking-wide">Role</p>
              <p className="text-sm font-bold text-[var(--text)]">{data.session.role}</p>
            </div>
          )}
          {data?.session.level && (
            <div>
              <p className="text-xs font-semibold text-[var(--muted)] mb-2 uppercase tracking-wide">Level</p>
              <Badge className="px-3 py-1.5 shadow-sm font-semibold">{data.session.level}</Badge>
            </div>
          )}
          <div className="ml-auto flex items-center gap-4">
            {presence?.completedAt && (
              <div>
                <p className="text-xs font-semibold text-[var(--muted)] mb-2 uppercase tracking-wide">Presence</p>
                <Badge variant="success" className="px-3 py-1.5 shadow-sm font-semibold">Verified</Badge>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-[var(--muted)] mb-2 uppercase tracking-wide">Status</p>
              <Badge variant={getStatusBadgeVariant(data?.session.status || "created")} className="px-3 py-1.5 shadow-sm font-semibold">
                {data?.session.status === "in_progress"
                  ? "In Progress"
                  : data?.session.status === "completed"
                    ? "Completed"
                    : "Created"}
              </Badge>
            </div>
          </div>
        </div>
        {/* Session ID hidden for cleaner UX - available in URL */}
      </Card>

      {!started ? (
        <Card className="shadow-lg border-0 bg-[var(--card)]">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center animate-pulse">
                <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
              </div>
              <h3 className="text-xl font-bold text-[var(--text)] mb-4">Preparing Your Interview...</h3>
              <div className="max-w-md mx-auto">
                <LoadingTips />
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--primary-glow)] flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-[var(--primary)]" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--text)] mb-3">Ready to Begin</h2>
              <p className="text-base text-[var(--muted)] mb-6 max-w-md mx-auto">
                Click below to generate your personalized interview questions based on your profile and the job requirements.
              </p>
              <button
                onClick={startInterview}
                disabled={loading}
                className="app-btn-primary px-8 py-4 text-lg w-full sm:w-auto"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Starting Interview...
                  </span>
                ) : (
                  "Begin Interview"
                )}
              </button>
            </div>
          )}
        </Card>
      ) : (
        <div className="relative">
          {/* Main 2-Column Layout for Desktop - Enhanced Spacing */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 max-w-7xl mx-auto">
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

              {/* Question Card - Modern Design */}
              {/* Question Card - Modern Design */}
              {!completed && data?.currentQuestion && (
                <Card variant="elevated" className="transition-all duration-300 shadow-lg border-0 bg-[var(--card)] backdrop-blur-md">
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <Badge variant="info" className="app-badge px-3 py-1.5 text-xs font-semibold shadow-sm">
                          Question {currentQuestionNum} of {data.session.totalQuestions}
                        </Badge>
                        <Badge className="app-badge px-3 py-1.5 text-xs font-semibold shadow-sm bg-[var(--bg-secondary)] text-[var(--muted)] border-[var(--border)]">
                          {data.currentQuestion.category}
                        </Badge>
                        <Badge variant="default" className="app-badge px-3 py-1.5 text-xs font-semibold shadow-sm">
                          {data.currentQuestion.difficulty}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        {data.session.currentQuestionIndex > 0 && (
                          <button
                            onClick={previousQuestion}
                            disabled={loading}
                            className="app-btn-secondary px-4 py-2 text-sm"
                          >
                            <ArrowLeft className="w-4 h-4 inline mr-1.5" /> Previous
                          </button>
                        )}
                        {data.session.currentQuestionIndex < data.session.totalQuestions - 1 && (
                          <button
                            onClick={nextQuestion}
                            disabled={loading}
                            className="app-btn-secondary px-4 py-2 text-sm"
                          >
                            Next <ArrowRight className="w-4 h-4 inline ml-1.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Question Text - Enhanced */}
                  <div className="mb-5 p-6 bg-gradient-to-br from-indigo-900/20 via-purple-900/20 to-pink-900/20 rounded-2xl border border-[var(--primary)]/20 shadow-inner">
                    <p className="text-lg text-[var(--text)] leading-relaxed font-semibold tracking-tight">
                      {data.currentQuestion.text}
                    </p>
                  </div>

                  {/* Coaching Hint - Modern */}
                  <div className="rounded-xl bg-[var(--warning-bg)] border border-[var(--warning)]/30 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--warning)]/20 flex items-center justify-center flex-shrink-0">
                        <Lightbulb className="w-4 h-4 text-[var(--warning)]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--warning)] mb-1">Coaching Tip</p>
                        <p className="text-sm text-[var(--text)]/80 leading-relaxed">
                          {getCoachingHint(data.currentQuestion.category)}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>

            {/* Right Column: Answer Area */}
            <div className="space-y-6">
              {/* Visual Question Timeline - Modern */}
              {!completed && data?.questions && data.questions.length > 0 && (
                <Card className="shadow-lg border-0 overflow-hidden bg-[var(--card)]">
                  <div className="p-6 bg-[var(--bg-secondary)]/30">
                    <div className="flex items-center justify-between mb-5">
                      <h4 className="text-base font-bold text-[var(--text)]">Interview Progress</h4>
                      <span className="text-sm font-semibold text-[var(--muted)] bg-[var(--bg-secondary)] px-3 py-1 rounded-lg shadow-sm border border-[var(--border)]">
                        {data.questions.filter(q => q.answered).length} / {data.questions.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-hide">
                      {data.questions.map((q, idx) => {
                        const isCurrent = idx === data.session.currentQuestionIndex;
                        const isAnswered = q.answered;
                        const isReached = idx <= data.session.currentQuestionIndex;
                        const isLocked = idx > data.session.currentQuestionIndex;

                        return (
                          <div key={q.id} className="flex items-center gap-2 flex-shrink-0">
                            {/* Question Circle - Enhanced */}
                            <div className="relative">
                              <div
                                className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-300 shadow-lg ${isCurrent
                                  ? "bg-[var(--primary)] text-white ring-4 ring-[var(--primary-glow)] scale-110 shadow-[var(--primary-glow)]"
                                  : isAnswered
                                    ? "bg-[var(--success)] text-white shadow-[var(--success-bg)]"
                                    : isLocked
                                      ? "bg-[var(--bg-secondary)] text-[var(--muted)] border-2 border-dashed border-[var(--border)] shadow-none"
                                      : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] shadow-sm"
                                  }`}
                              >
                                {isLocked ? (
                                  <Lock className="w-4 h-4" />
                                ) : isAnswered ? (
                                  <Check className="w-5 h-5" />
                                ) : (
                                  <span>{idx + 1}</span>
                                )}
                              </div>
                              {/* Pulse animation for current question */}
                              {isCurrent && (
                                <div className="absolute inset-0 rounded-xl bg-indigo-600 animate-ping opacity-30" />
                              )}
                            </div>

                            {/* Connector Line - Enhanced */}
                            {data.questions && idx < data.questions.length - 1 && (
                              <div
                                className={`h-1.5 w-10 rounded-full transition-all duration-300 ${isAnswered
                                  ? "bg-gradient-to-r from-emerald-500 to-green-500 shadow-sm"
                                  : isReached
                                    ? "bg-gradient-to-r from-indigo-500 to-purple-500 shadow-sm"
                                    : "bg-slate-200"
                                  }`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Status Legend - Modern */}
                    <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-5">
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 shadow-sm" />
                          <span className="text-slate-700 font-medium">Completed</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 ring-2 ring-indigo-200 shadow-sm" />
                          <span className="text-slate-700 font-medium">Current</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 rounded-lg bg-slate-100 border-2 border-dashed border-slate-300" />
                          <span className="text-slate-700 font-medium">Locked</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}


              {/* Answer Input Card - Modern */}
              {!completed && data?.currentQuestion && (
                <Card variant="elevated" className="transition-all duration-300 shadow-lg border-0">
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 mb-1">
                          Your Response
                        </h3>
                        <p className="text-sm text-slate-600">Share your thoughts and experience</p>
                      </div>
                      {!isRecruiterView && (
                        <div className="flex items-center gap-2.5 px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/60 rounded-xl shadow-sm">
                          <Lightbulb className="w-4 h-4 text-indigo-600" />
                          <span className="text-xs font-semibold text-indigo-900 max-w-[200px] truncate">
                            {getCoachingHint(data.currentQuestion.category)}
                          </span>
                        </div>
                      )}
                    </div>
                    {focusMode && (
                      <div className="mt-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs font-medium text-amber-800">🔒 Focus mode active - Paste disabled</p>
                      </div>
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

                  {/* Text Answer Input - Modern */}
                  <div>
                    <textarea
                      className="w-full rounded-xl border-2 border-slate-200 p-5 text-base text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:cursor-not-allowed min-h-[240px] transition-all duration-200 shadow-sm focus:shadow-md resize-none"
                      rows={10}
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      onPaste={(e) => {
                        addToast("Paste detected. Security incident logged.", "warning");
                        if (focusMode) {
                          e.preventDefault();
                        }
                      }}
                      placeholder="Type your response here or use voice recording above..."
                      disabled={loading || completed}
                    />
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <p className="text-xs font-medium text-slate-600">
                          <span className="font-semibold text-slate-900">{answerText.length}</span> characters
                        </p>
                        <p className="text-xs text-slate-500">
                          Your responses may be quoted in the interview report
                        </p>
                      </div>
                      {answerText.length < 50 && answerText.length > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                          <Info className="w-3.5 h-3.5 text-amber-600" />
                          <span className="text-xs font-medium text-amber-800">Consider expanding your answer</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Answer Quality Tips - Modern */}
                  {answerText.length > 0 && data?.currentQuestion && !isRecruiterView && (
                    <div className="mt-5 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/60 rounded-xl shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <Lightbulb className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-indigo-900 mb-2">Tips for a strong answer:</p>
                          <ul className="text-sm text-indigo-800 space-y-1.5">
                            {data.currentQuestion.category === "technical" && (
                              <>
                                <li className="flex items-start gap-2"><span className="text-indigo-600 font-bold">•</span> <span>Explain your approach step-by-step</span></li>
                                <li className="flex items-start gap-2"><span className="text-indigo-600 font-bold">•</span> <span>Discuss trade-offs and alternatives</span></li>
                                <li className="flex items-start gap-2"><span className="text-indigo-600 font-bold">•</span> <span>Include code examples if relevant</span></li>
                              </>
                            )}
                            {(data.currentQuestion.category === "behavioral" || data.currentQuestion.category === "scenario") && (
                              <>
                                <li className="flex items-start gap-2"><span className="text-indigo-600 font-bold">•</span> <span>Use STAR method: Situation, Task, Action, Result</span></li>
                                <li className="flex items-start gap-2"><span className="text-indigo-600 font-bold">•</span> <span>Be specific with numbers and outcomes</span></li>
                                <li className="flex items-start gap-2"><span className="text-indigo-600 font-bold">•</span> <span>Show what you learned</span></li>
                              </>
                            )}
                            {data.currentQuestion.category === "experience" && (
                              <>
                                <li className="flex items-start gap-2"><span className="text-indigo-600 font-bold">•</span> <span>Provide concrete examples from your work</span></li>
                                <li className="flex items-start gap-2"><span className="text-indigo-600 font-bold">•</span> <span>Explain challenges and how you overcame them</span></li>
                                <li className="flex items-start gap-2"><span className="text-indigo-600 font-bold">•</span> <span>Connect to the role requirements</span></li>
                              </>
                            )}
                            {!["technical", "behavioral", "scenario", "experience"].includes(data.currentQuestion.category) && (
                              <>
                                <li className="flex items-start gap-2"><span className="text-indigo-600 font-bold">•</span> <span>Be clear and structured</span></li>
                                <li className="flex items-start gap-2"><span className="text-indigo-600 font-bold">•</span> <span>Provide specific examples</span></li>
                                <li className="flex items-start gap-2"><span className="text-indigo-600 font-bold">•</span> <span>Show your thought process</span></li>
                              </>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Show Feedback After Submission */}
                  {lastEval?.ok && lastEval.evaluation && !completed && !isRecruiterView && (
                    <div className="mt-4">
                      <AnswerFeedback
                        evaluation={lastEval.evaluation}
                        questionCategory={data?.currentQuestion?.category || "general"}
                      />
                    </div>
                  )}

                  {/* Submit Button - Modern */}
                  <div className="mt-6 flex items-center gap-3">
                    <button
                      onClick={handleSubmitClick}
                      disabled={loading || completed || !answerText.trim()}
                      className="flex-1 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          <span>Submit Answer</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-center text-slate-500 font-medium">
                    Press <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-xs font-mono">Ctrl</kbd> + <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-xs font-mono">Enter</kbd> to submit
                  </p>
                </Card>
              )}

              {/* Latest Evaluation - Enhanced with AnswerFeedback component */}
              {lastEval?.evaluation && !completed && !isRecruiterView && (
                <AnswerFeedback
                  evaluation={lastEval.evaluation}
                  questionCategory={data?.currentQuestion?.category || "general"}
                />
              )}

              {/* Legacy evaluation display for recruiter view */}
              {lastEval?.evaluation && !completed && isRecruiterView && (
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
                    </div>
                  )}
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report Generation Loading State */}
      {completed && !report && (
        <Card className="shadow-lg border-0 bg-[var(--card)]">
          <div className="p-12 text-center">
            <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-white animate-pulse" />
            </div>
            <h2 className="text-3xl font-bold text-[var(--text)] mb-3">Interview Complete!</h2>
            <p className="text-lg text-[var(--muted)] mb-8">Great job completing all questions</p>

            <div className="max-w-md mx-auto space-y-4">
              <div className="flex items-center gap-4 p-4 bg-[var(--bg-secondary)] rounded-xl">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-bold text-[var(--text)]">Analyzing your responses...</p>
                  <p className="text-xs text-[var(--muted)]">Evaluating technical skills and communication</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-[var(--bg-secondary)]/50 rounded-xl opacity-70">
                <div className="w-10 h-10 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center flex-shrink-0">
                  <div className="w-5 h-5 border-2 border-[var(--muted)] rounded-full" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-[var(--text)]">Processing evaluation scores...</p>
                  <p className="text-xs text-[var(--muted)]">Calculating overall performance</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-[var(--bg-secondary)]/30 rounded-xl opacity-50">
                <div className="w-10 h-10 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center flex-shrink-0">
                  <div className="w-5 h-5 border-2 border-[var(--muted)] rounded-full" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-[var(--text)]">Generating your report...</p>
                  <p className="text-xs text-[var(--muted)]">Preparing detailed insights and recommendations</p>
                </div>
              </div>
            </div>

            <p className="mt-8 text-sm text-[var(--muted)]">This usually takes 10-15 seconds</p>
          </div>
        </Card>
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
