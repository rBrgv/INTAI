"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Lock, ArrowRight as ArrowRightIcon, CheckCircle2, Briefcase, GraduationCap, User, Code, TrendingUp, Clock, Circle, Shield, AlertTriangle, Lightbulb, Timer, UserCircle, Layers, Volume2, VolumeX, Maximize2, Minimize2 } from "lucide-react";
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
import { SecurityMonitor } from "@/components/SecurityMonitor";
import { isMobileDevice, getDeviceInfo } from "@/lib/deviceDetection";
import InterviewRulesModal from "@/components/InterviewRulesModal";
import { retryWithBackoff, isRetryableError } from "@/lib/retry";

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
  const isRecruiterView = searchParams?.get("view") === "recruiter";
  
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
  const [cameraEnabled, setCameraEnabled] = useState(false); // UI state - always shows as off
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [previousQuestionId, setPreviousQuestionId] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [presence, setPresence] = useState<any>(null);
  const [showPresenceModal, setShowPresenceModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [fullScreenMode, setFullScreenMode] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [tabSwitchWarning, setTabSwitchWarning] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [securityEventCount, setSecurityEventCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileWarningDismissed, setMobileWarningDismissed] = useState(false);
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

  // Detect device type
  useEffect(() => {
    setIsMobile(isMobileDevice());
    
    // Log device info to security events on interview start
    if (data?.session.status === "in_progress" && !isRecruiterView) {
      const deviceInfo = getDeviceInfo();
      fetch(`/api/sessions/${sessionId}/security-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          event: "device_detected", 
          timestamp: Date.now(),
          details: deviceInfo
        }),
      }).catch(() => {}); // Non-blocking
    }
  }, [sessionId, data?.session.status, isRecruiterView]);

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
    
    clientLogger.info("Refresh completed", { 
      sessionId, 
      hasQuestions: !!responseData?.questions, 
      questionCount: responseData?.questions?.length || 0,
      totalQuestions: responseData?.session?.totalQuestions || 0,
      status: responseData?.session?.status,
      hasCurrentQuestion: !!responseData?.currentQuestion
    });
    
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
    console.log(`[CLIENT] startInterview called for session ${sessionId}`);
    clientLogger.info("startInterview function called", { sessionId });
    setError(null);
    setLoading(true);
    setIsTyping(true);
    
    // Enter fullscreen mode when interview begins (non-blocking)
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {});
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        await (document.documentElement as any).webkitRequestFullscreen().catch(() => {});
      } else if ((document.documentElement as any).mozRequestFullScreen) {
        await (document.documentElement as any).mozRequestFullScreen().catch(() => {});
      } else if ((document.documentElement as any).msRequestFullscreen) {
        await (document.documentElement as any).msRequestFullscreen().catch(() => {});
      }
      setFullScreenMode(true);
    } catch (error) {
      // Fullscreen request failed (user may have denied permission) - non-blocking
      clientLogger.warn("Could not enter fullscreen", { error: error instanceof Error ? error.message : String(error) });
    }
    
    try {
      const startUrl = `/api/sessions/${sessionId}/start`;
      console.log(`[CLIENT] Making POST request to ${startUrl}`);
      clientLogger.info("Making POST request to start interview", { sessionId, url: startUrl });
      
      // Detect production environment for timeout and delays
      const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');
      const timeout = isProduction ? 60000 : 30000; // 60s in prod, 30s in dev
      const initialDelay = isProduction ? 3000 : 2000;
      const refreshDelay = isProduction ? 1500 : 1000;
      
      const result = await retryWithBackoff(
        async () => {
          console.log(`[CLIENT] Fetching ${startUrl}...`);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          
          try {
            const res = await fetch(`/api/sessions/${sessionId}/start`, {
              method: "POST",
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            console.log(`[CLIENT] Response status: ${res.status}`);
            const json = await res.json().catch((e) => {
              console.error(`[CLIENT] Failed to parse JSON:`, e);
              return {};
            });
            console.log(`[CLIENT] Response JSON:`, json);
            
            if (!res.ok) {
              console.error(`[CLIENT] Request failed with status ${res.status}:`, json);
              const error = new Error(json.error || json.message || `Failed to start interview (${res.status})`);
              (error as any).status = res.status;
              
              // Don't retry on client errors (4xx) - these are permanent errors
              if (res.status >= 400 && res.status < 500) {
                throw error;
              }
              
              // Only retry on server errors (5xx) or network issues
              throw error;
            }
            
            // Parse the response
            const responseData = json.data || json;
            return responseData;
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
              const timeoutError = new Error('Request timeout');
              (timeoutError as any).status = 504;
              throw timeoutError;
            }
            throw fetchError;
          }
        },
        {
          maxRetries: isProduction ? 3 : 2,
          initialDelay: 1000,
          timeout: timeout,
          onRetry: (attempt, error) => {
            // Only show retry message for retryable errors
            if (isRetryableError(error)) {
              addToast(`Retrying... (attempt ${attempt}/${isProduction ? 3 : 2})`, "info");
              clientLogger.info("Retrying start interview", { sessionId, attempt, error: error?.message });
            }
          },
        }
      );
      
      console.log(`[CLIENT] Interview start API call successful:`, result);
      clientLogger.info("Interview start API call successful", { sessionId, result });
      
      // Wait longer for database replication to complete (read replica lag)
      // Production typically has more read replica lag
      console.log(`[CLIENT] Waiting ${initialDelay}ms for database replication... (production: ${isProduction})`);
      await new Promise(resolve => setTimeout(resolve, initialDelay));
      
      // Refresh and wait for it to complete
      console.log(`[CLIENT] First refresh...`);
      await refresh();
      
      // Wait a bit more for state to update
      console.log(`[CLIENT] Waiting ${refreshDelay}ms before second refresh...`);
      await new Promise(resolve => setTimeout(resolve, refreshDelay));
      
      // Refresh one more time to ensure we have the latest data
      console.log(`[CLIENT] Second refresh...`);
      await refresh();
      
      // One final refresh after another delay (only in production)
      if (isProduction) {
        console.log(`[CLIENT] Waiting ${refreshDelay}ms before final refresh (production)...`);
        await new Promise(resolve => setTimeout(resolve, refreshDelay));
        console.log(`[CLIENT] Final refresh...`);
        await refresh();
      }
      
      // Reset loading state after refresh
      setLoading(false);
      setIsTyping(false);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[CLIENT] Failed to start interview:`, err);
      clientLogger.error("Failed to start interview after retries", err, { 
        sessionId,
        errorMessage: err.message,
        errorStack: err.stack
      });
      
      let errorMsg = "Failed to start interview. ";
      if (isRetryableError(error)) {
        errorMsg += "Please check your connection and try again.";
      } else {
        errorMsg += err.message || "An unexpected error occurred.";
      }
      
      setError(errorMsg);
      addToast(errorMsg, "error");
      setLoading(false);
      setIsTyping(false);
      
      // Don't reset to show rules modal - keep the error visible
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
      // Detect production environment for timeout
      const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');
      const timeout = isProduction ? 60000 : 30000; // 60s in prod, 30s in dev
      
      const result = await retryWithBackoff(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          
          try {
            const res = await fetch(`/api/sessions/${sessionId}/answer`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ answerText: answerText.trim() }),
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);

            const json = (await res.json().catch(() => ({}))) as Partial<EvalResp> & {
              error?: string;
              message?: string;
              details?: string;
              data?: any;
            };

            if (!res.ok) {
              const errorMsg = json.error || json.message || json.details || `Failed to submit answer (${res.status})`;
              const error = new Error(errorMsg);
              (error as any).status = res.status;
              
              // Don't retry on client errors (4xx) - these are permanent errors
              if (res.status >= 400 && res.status < 500) {
                throw error;
              }
              
              // Only retry on server errors (5xx) or network issues
              throw error;
            }

            return { res, json };
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
              const timeoutError = new Error('Request timeout');
              (timeoutError as any).status = 504;
              throw timeoutError;
            }
            throw fetchError;
          }
        },
        {
          maxRetries: 2, // Fewer retries for answer submission
          initialDelay: 500,
          onRetry: (attempt) => {
            addToast(`Retrying submission... (attempt ${attempt}/2)`, "info");
          },
        }
      );

      // Handle successful response
      const { json } = result;
      const responseData = (json as any).data || json;
      setLastEval(responseData as EvalResp);
      setAnswerText("");
      setShowConfirmDialog(false);
      
      // Update state immediately with the advanced index from response
      // This ensures UI updates immediately even if refresh gets stale data
      if (responseData.advancedToIndex !== undefined && data) {
        console.log(`[CLIENT] Updating state immediately - advancedToIndex: ${responseData.advancedToIndex}, status: ${responseData.status}`);
        setData({
          ...data,
          session: {
            ...data.session,
            currentQuestionIndex: responseData.advancedToIndex,
            status: responseData.status || data.session.status,
          },
        });
      }
      
      // Wait longer for database replication, then refresh to get full updated state
      // Use longer delay to handle read replica lag
      console.log(`[CLIENT] Waiting 2 seconds for database replication before refresh...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Refresh to get full updated state (evaluation, score summary, etc.)
      console.log(`[CLIENT] Refreshing session data...`);
      await refresh();
      
      // If refresh returned stale data, restore the correct index from the response
      // This handles cases where read replica lag causes refresh to return old data
      if (responseData.advancedToIndex !== undefined && data) {
        setTimeout(() => {
          setData((prevData) => {
            if (prevData && prevData.session.currentQuestionIndex !== responseData.advancedToIndex) {
              console.log(`[CLIENT] Refresh returned stale data (index: ${prevData.session.currentQuestionIndex}), restoring correct index: ${responseData.advancedToIndex}`);
              return {
                ...prevData,
                session: {
                  ...prevData.session,
                  currentQuestionIndex: responseData.advancedToIndex,
                  status: responseData.status || prevData.session.status,
                },
              };
            }
            return prevData;
          });
        }, 100);
      }
      setTimeout(() => {
        setIsTyping(false);
        setLoading(false);
        setIsSubmitting(false);
      }, 500);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      let errorMsg = err.message || "Failed to submit answer. Please try again.";
      
      // Handle timeout specifically
      if (err.message === 'Request timeout' || err.message.includes('timeout')) {
        errorMsg = "Request timed out. Please try again.";
      }
      
      setError(errorMsg);
      addToast(errorMsg, "error");
      setIsTyping(false);
      setLoading(false);
      setIsSubmitting(false);
      clientLogger.error("Answer submission failed after retries", err, { 
        sessionId,
        errorMessage: err.message
      });
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

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setFullScreenMode(isFullscreen);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

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

  // Tab switch tracking (visibility API)
  useEffect(() => {
    if (!started || completed || isRecruiterView) return;

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // Tab switched away (blur)
        try {
          const res = await fetch(`/api/sessions/${sessionId}/tab-switch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "blur", timestamp: Date.now() }),
          });
          const data = await res.json();
          if (data.success && data.data) {
            const newCount = data.data.tabSwitchCount || 0;
            setTabSwitchCount(newCount);
            if (data.data.warning) {
              setTabSwitchWarning(data.data.warning);
              // Show toast for warnings
              if (newCount > 3) {
                addToast(data.data.warning, "warning");
              }
            } else {
              setTabSwitchWarning(null);
            }
          }
        } catch (err) {
          clientLogger.error("Failed to log tab switch", err instanceof Error ? err : new Error(String(err)));
        }
      } else {
        // Tab switched back (focus)
        try {
          await fetch(`/api/sessions/${sessionId}/tab-switch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "focus", timestamp: Date.now() }),
          });
        } catch (err) {
          clientLogger.error("Failed to log tab focus", err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    const handleBlur = () => {
      if (document.hidden) return; // Already handled by visibilitychange
      handleVisibilityChange();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [sessionId, started, completed, isRecruiterView, refresh]);

  // Handle security events - only count critical events, not routine checks
  const handleSecurityEvent = (event: string) => {
    // Only count actual security violations, not routine monitoring
    const criticalEvents = [
      "devtools_detected",
      "screenshot_attempt",
      "clipboard_write_attempt",
      "keyboard_shortcut_blocked",
      "right_click_blocked"
    ];
    
    if (criticalEvents.includes(event)) {
      setSecurityEventCount(prev => prev + 1);
      
      // Show toast for critical events
      if (["devtools_detected", "screenshot_attempt"].includes(event)) {
        addToast(`Security alert: ${event.replace(/_/g, ' ')}`, "error");
      }
    }
    // Don't count routine checks like presence checks, idle detection, etc.
  };

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
    <div 
      className="space-y-6"
      style={started && !completed && !isRecruiterView ? { 
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none'
      } : {}}
    >
      {/* Security Monitor - Only active during interview */}
      {started && !completed && !isRecruiterView && (
        <SecurityMonitor 
          sessionId={sessionId} 
          enabled={true}
          onSecurityEvent={handleSecurityEvent}
        />
      )}
      
      {/* Toast Manager */}
      <ToastManager toasts={toasts} onRemove={removeToast} />

      {/* Interview Rules Modal */}
      {showRulesModal && (
        <InterviewRulesModal
          sessionId={sessionId}
          onAccept={() => {
            setShowRulesModal(false);
            startInterview();
          }}
          onDecline={() => setShowRulesModal(false)}
        />
      )}

      {/* Presence Modal */}
      {showPresenceModal && (
        <PresenceCheckModal
          sessionId={sessionId}
          phrasePrompt={presence?.phrasePrompt || "I confirm this interview response is my own."}
          onComplete={handlePresenceComplete}
          onSkip={handlePresenceSkip}
        />
      )}

      {/* Mobile Device Warning Banner */}
      {isMobile && !mobileWarningDismissed && started && !completed && !isRecruiterView && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800 flex items-center gap-2">
                <span>⚠️</span> Desktop Recommended
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                For the best interview experience and security, please use a desktop or laptop computer. 
                Some security features may be limited on mobile devices, and typing long answers may be difficult.
              </p>
            </div>
            <button
              onClick={() => setMobileWarningDismissed(true)}
              className="text-yellow-800 hover:text-yellow-900 text-xl font-bold leading-none flex-shrink-0"
              aria-label="Dismiss warning"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="sticky top-0 z-10 bg-[var(--bg)]/95 backdrop-blur-md border-b border-[var(--border)] py-4 -mx-4 px-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--text)]">Interview Session</h1>
            <p className="text-xs text-[var(--muted)] mt-0.5">AI-Powered Assessment</p>
          </div>
          <div className="flex items-center gap-2">
            {presence?.completedAt && (
              <Badge variant="success" className="app-badge flex items-center gap-1.5">
                <Shield className="w-3 h-3" />
                Verified
              </Badge>
            )}
            {timeElapsed > 0 && data?.session.status === "in_progress" && (
              <Badge variant="info" className="app-badge flex items-center gap-1.5">
                <Timer className="w-3 h-3" />
                {formatTime(timeElapsed)}
              </Badge>
            )}
            <Badge variant={getStatusBadgeVariant(data?.session.status || "created")} className="app-badge">
              {data?.session.status === "in_progress"
                ? "In Progress"
                : data?.session.status === "completed"
                ? "Completed"
                : "Ready"}
            </Badge>
            {started && !completed && (
              <button
                onClick={async () => {
                  const enabled = !fullScreenMode;
                  setFullScreenMode(enabled);
                  try {
                    if (enabled) {
                      if (document.documentElement.requestFullscreen) {
                        await document.documentElement.requestFullscreen();
                      } else if ((document.documentElement as any).webkitRequestFullscreen) {
                        await (document.documentElement as any).webkitRequestFullscreen();
                      } else if ((document.documentElement as any).mozRequestFullScreen) {
                        await (document.documentElement as any).mozRequestFullScreen();
                      } else if ((document.documentElement as any).msRequestFullscreen) {
                        await (document.documentElement as any).msRequestFullscreen();
                      }
                    } else {
                      if (document.exitFullscreen) {
                        await document.exitFullscreen();
                      } else if ((document as any).webkitExitFullscreen) {
                        await (document as any).webkitExitFullscreen();
                      } else if ((document as any).mozCancelFullScreen) {
                        await (document as any).mozCancelFullScreen();
                      } else if ((document as any).msExitFullscreen) {
                        await (document as any).msExitFullscreen();
                      }
                    }
                  } catch (error) {
                    console.error("Fullscreen error:", error);
                    setFullScreenMode(!enabled);
                  }
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[var(--card)] transition-colors border border-[var(--border)]"
                title={fullScreenMode ? "Exit Full Screen" : "Enter Full Screen"}
              >
                {fullScreenMode ? (
                  <>
                    <Minimize2 className="w-4 h-4 text-[var(--text)]" />
                    <span className="text-xs text-[var(--text)]">Exit Full Screen</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-4 h-4 text-[var(--text)]" />
                    <span className="text-xs text-[var(--text)]">Full Screen</span>
                  </>
                )}
              </button>
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

      {/* Context Card - Professional Interview Header */}
      <Card className="shadow-sm border border-[var(--border)] bg-gradient-to-r from-[var(--bg)] to-[var(--card)]">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-8">
            {/* Role & Level - Primary Info */}
            {data?.session.role && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                  <UserCircle className="w-5 h-5 text-[var(--primary)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)] font-medium">Position</p>
                  <p className="text-base font-semibold text-[var(--text)]">{data.session.role}</p>
                </div>
              </div>
            )}

            {data?.session.level && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-[var(--primary)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)] font-medium">Level</p>
                  <p className="text-base font-semibold text-[var(--text)] capitalize">{data.session.level}</p>
                </div>
              </div>
            )}

            {/* Divider */}
            {(data?.session.role || data?.session.level) && (
              <div className="h-12 w-px bg-[var(--border)]" />
            )}

            {/* Status - Subtle Badge */}
            <div className="flex items-center gap-2">
              {data?.session.status === "completed" ? (
                <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
              ) : data?.session.status === "in_progress" ? (
                <Clock className="w-4 h-4 text-[var(--primary)]" />
              ) : null}
              <Badge 
                variant={getStatusBadgeVariant(data?.session.status || "created")} 
                className="text-xs px-3 py-1"
              >
                {data?.session.status === "in_progress"
                  ? "Interview in Progress"
                  : data?.session.status === "completed"
                  ? "Interview Completed"
                  : "Ready to Begin"}
              </Badge>
            </div>
          </div>

          {/* Presence Verification - Right Side */}
          {presence?.completedAt && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--success)]/10 border border-[var(--success)]/20">
              <Shield className="w-4 h-4 text-[var(--success)]" />
              <span className="text-xs font-medium text-[var(--success)]">Identity Verified</span>
            </div>
          )}
        </div>
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
              <h3 className="text-lg font-semibold text-[var(--text)] mb-2">Ready to begin</h3>
              <p className="text-sm text-[var(--muted)] mb-4">
                Please review the interview rules and security guidelines before starting.
              </p>
              <button
                onClick={() => {
                  console.log(`[CLIENT] Begin Interview button clicked for session ${sessionId}`);
                  // Check if rules were already accepted
                  const rulesAccepted = localStorage.getItem(`rulesAccepted:${sessionId}`);
                  console.log(`[CLIENT] Rules accepted: ${rulesAccepted}`);
                  if (rulesAccepted) {
                    // Skip modal if already accepted
                    console.log(`[CLIENT] Rules already accepted, calling startInterview directly`);
                    startInterview();
                  } else {
                    // Show modal if not accepted
                    console.log(`[CLIENT] Rules not accepted, showing modal`);
                    setShowRulesModal(true);
                  }
                }}
                disabled={loading}
                className="app-btn-primary px-6 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Starting..." : "Review Rules & Begin Interview"}
              </button>
            </>
          )}
        </Card>
      ) : !(completed && report) ? (
        <div className="relative space-y-6">
          {/* Main 2-Column Layout for Desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
            {/* Left Column: AI Interviewer + Evaluation */}
            <div className="space-y-6 flex flex-col">
              {/* AI Interviewer Panel - Reduced size */}
              <Card variant="elevated" className="flex-shrink-0">
                <div className="scale-90 origin-top">
                  <InterviewerPanel
                    question={currentQuestionText}
                    isTyping={showTyping}
                    readAloud={readAloud}
                    onReadAloudChange={setReadAloud}
                    showVideoPlaceholder={true}
                    cameraEnabled={cameraEnabled}
                    onCameraToggle={setCameraEnabled}
                    tabSwitchCount={tabSwitchCount}
                    tabSwitchWarning={tabSwitchWarning}
                    securityEventCount={securityEventCount}
                    isRecruiterView={isRecruiterView}
                    sessionStatus={data?.session.status}
                  />
                </div>
              </Card>

              {/* Latest Evaluation - Expanded to match right column height */}
              {lastEval?.evaluation && !completed && (
                <Card variant="outlined" className="shadow-sm flex-1 flex flex-col min-h-0">
                  <h4 className="text-sm font-semibold text-[var(--text)] mb-3">Latest evaluation</h4>
                  <div className="flex items-center gap-4 mb-3">
                    <div>
                      <p className="text-xs text-[var(--muted)] mb-1">Overall</p>
                      <p className="text-xl font-bold text-[var(--primary)]">
                        {lastEval.evaluation.overall}/10
                      </p>
                    </div>
                    <div className="flex gap-4 flex-1">
                      <div>
                        <p className="text-xs text-[var(--muted)] mb-1">Technical</p>
                        <p className="text-sm font-semibold text-[var(--text)]">{lastEval.evaluation.scores.technical}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--muted)] mb-1">Communication</p>
                        <p className="text-sm font-semibold text-[var(--text)]">
                          {lastEval.evaluation.scores.communication}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--muted)] mb-1">Problem Solving</p>
                        <p className="text-sm font-semibold text-[var(--text)]">
                          {lastEval.evaluation.scores.problemSolving}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 flex-1">
                    {lastEval.evaluation.strengths && lastEval.evaluation.strengths.length > 0 && (
                      <div className="flex flex-col">
                        <p className="text-xs font-medium text-[var(--text)] mb-2">Strengths</p>
                        <ul className="space-y-2 flex-1">
                          {lastEval.evaluation.strengths.map((s, i) => (
                            <li key={i} className="flex items-start text-xs text-[var(--muted)]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {lastEval.evaluation.gaps && lastEval.evaluation.gaps.length > 0 && (
                      <div className="flex flex-col">
                        <p className="text-xs font-medium text-[var(--text)] mb-2">Areas to improve</p>
                        <ul className="space-y-2 flex-1">
                          {lastEval.evaluation.gaps.map((g, i) => (
                            <li key={i} className="flex items-start text-xs text-[var(--muted)]">
                              <ArrowRightIcon className="w-3.5 h-3.5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                              <span>{g}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  {lastEval.evaluation.followUpQuestion && (
                    <div className="mt-4 pt-4 border-t border-[var(--border)] rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-medium text-[var(--text)] mb-1">Suggested follow-up</p>
                      <p className="text-xs text-[var(--muted)]">{lastEval.evaluation.followUpQuestion}</p>
                    </div>
                  )}
                </Card>
              )}
            </div>

            {/* Right Column: Question + Answer Area */}
            <div className="space-y-6 flex flex-col">
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
                      <div className="flex gap-2 items-center">
                        {data.session.currentQuestionIndex > 0 && (
                          <button
                            onClick={previousQuestion}
                            disabled={loading}
                            className="app-btn-secondary px-3 py-1.5 text-sm disabled:opacity-60"
                          >
                            <ArrowLeft className="w-4 h-4 inline mr-1" /> Previous
                          </button>
                        )}
                        {/* Read Aloud Button */}
                        {data.currentQuestion && (
                          <button
                            onClick={() => {
                              if (isSpeaking) {
                                window.speechSynthesis.cancel();
                                setIsSpeaking(false);
                              } else if (data.currentQuestion) {
                                const utterance = new SpeechSynthesisUtterance(data.currentQuestion.text);
                                utterance.rate = 0.9;
                                utterance.pitch = 1;
                                utterance.volume = 0.8;
                                utterance.onstart = () => setIsSpeaking(true);
                                utterance.onend = () => setIsSpeaking(false);
                                utterance.onerror = () => setIsSpeaking(false);
                                window.speechSynthesis.speak(utterance);
                              }
                            }}
                            disabled={loading}
                            className={`app-btn-secondary px-3 py-1.5 text-sm disabled:opacity-60 flex items-center gap-1.5 ${
                              isSpeaking ? "bg-blue-100 text-blue-700" : ""
                            }`}
                            title={isSpeaking ? "Stop reading" : "Read question aloud"}
                          >
                            {isSpeaking ? (
                              <>
                                <VolumeX className="w-4 h-4" />
                                Stop
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-4 h-4" />
                                Read
                              </>
                            )}
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
                  <div className="mb-4 p-6 bg-[var(--card)] rounded-lg border border-[var(--border)] shadow-sm">
                    <p className="text-lg text-[var(--text)] leading-relaxed font-medium">
                      {data.currentQuestion.text}
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4 pt-4 border-t border-[var(--border)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-[var(--muted)]">
                        Interview Progress
                      </span>
                      <span className="text-xs font-semibold text-[var(--text)]">
                        {currentQuestionNum} of {data.session.totalQuestions}
                      </span>
                    </div>
                    <div className="w-full bg-[var(--border)] rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-[var(--primary)] h-2 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.round((currentQuestionNum / data.session.totalQuestions) * 100)}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-[var(--muted)]">
                      <span>{Math.round((currentQuestionNum / data.session.totalQuestions) * 100)}% Complete</span>
                      <span>{data.session.totalQuestions - currentQuestionNum} remaining</span>
                    </div>
                  </div>
                </Card>
              )}


              {/* Answer Input Card */}
              {!completed && data?.currentQuestion && (
                <Card variant="elevated" className="transition-all duration-300 flex-1 flex flex-col min-h-0">
                  {/* Submit Button - At Top */}
                  <div className="mb-4 flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={handleSubmitClick}
                      disabled={isSubmitting || loading || completed || !answerText.trim()}
                      className="app-btn-primary px-6 py-3 disabled:opacity-60 disabled:cursor-not-allowed flex-1"
                    >
                      {isSubmitting || loading ? "Submitting..." : "Submit Answer"}
                    </button>
                    {loading && <Skeleton className="h-10 w-24" />}
                  </div>
                  <p className="mb-4 text-xs text-center text-[var(--muted)] flex-shrink-0">
                    Press Ctrl+Enter to submit
                  </p>

                  <div className="mb-4 flex-shrink-0">
                    <h3 className="text-lg font-semibold text-[var(--text)] mb-1">
                      Your Response
                    </h3>
                    {fullScreenMode && (
                      <p className="text-xs text-[var(--muted)] mt-1">Full screen mode active</p>
                    )}
                  </div>

                  {/* Voice Answer Recorder */}
                  <div className="mb-4 flex-shrink-0">
                    <VoiceAnswerRecorder
                      key={data.currentQuestion.id}
                      onTranscript={(text) => setAnswerText(text)}
                      disabled={loading || completed}
                    />
                  </div>

                  {/* Text Answer Input - Expands to fill space */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <textarea
                      className="w-full h-full rounded-lg border-2 border-[var(--border)] p-5 text-sm text-[var(--text)] bg-[var(--bg)] focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] disabled:bg-slate-50 disabled:cursor-not-allowed resize-none transition-all"
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      onPaste={(e) => {
                        // Allow paste in full screen mode
                      }}
                      style={{ userSelect: 'text' }} // Allow text selection in textarea
                      placeholder="Share your thoughts, approach, and examples here. You can also use voice recording above to transcribe your response."
                      disabled={loading || completed}
                    />
                    <div className="mt-3 flex items-center justify-between flex-shrink-0">
                      <p className="text-xs text-[var(--muted)]">
                        {answerText.length > 0 ? `${answerText.length} characters` : "Start typing or use voice recording"}
                      </p>
                      <p className="text-xs text-[var(--muted)] italic">
                        Responses may be included in your interview report
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Interview Report - Only show if report not generated yet */}
              {completed && !report && (
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
                      ) : (
                        "Generate report"
                      )}
                    </button>
                  </div>

                  {reportLoading && (
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
                </Card>
              )}
            </div>
          </div>
        </div>
      ) : null}

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
