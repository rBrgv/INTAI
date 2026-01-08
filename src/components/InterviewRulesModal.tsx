"use client";

import { useState, useEffect } from "react";
import Card from "./Card";
import { Shield, Eye, MousePointer2, Keyboard, Monitor, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

type InterviewRulesModalProps = {
  sessionId: string;
  onAccept: () => void;
  onDecline?: () => void;
};

const MIN_READING_TIME = 10; // seconds

export default function InterviewRulesModal({ sessionId, onAccept, onDecline }: InterviewRulesModalProps) {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [readingTime, setReadingTime] = useState(0);
  const [hasSeenBefore, setHasSeenBefore] = useState(false);

  // Check if user has seen rules before
  useEffect(() => {
    const seen = localStorage.getItem(`rulesAccepted:${sessionId}`);
    if (seen) {
      setHasSeenBefore(true);
      // If seen before, auto-enable checkbox but still require scroll
    }
  }, [sessionId]);

  // Track reading time
  useEffect(() => {
    const interval = setInterval(() => {
      setReadingTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    if (isAtBottom && !hasScrolled) {
      setHasScrolled(true);
    }
  };

  const canAccept = hasScrolled && readingTime >= MIN_READING_TIME;

  const handleAccept = () => {
    console.log(`[CLIENT] Rules modal accepted for session ${sessionId}`);
    // Persist acceptance
    localStorage.setItem(`rulesAccepted:${sessionId}`, Date.now().toString());
    console.log(`[CLIENT] Calling onAccept callback`);
    onAccept();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card variant="elevated" className="max-w-3xl w-full max-h-[90vh] flex flex-col shadow-lg">
        <div className="p-6 border-b border-[var(--border)] flex-shrink-0">
          <h2 className="text-2xl font-semibold text-[var(--text)] flex items-center gap-2">
            <Shield className="w-6 h-6 text-[var(--primary)]" />
            Interview Rules & Security Guidelines
          </h2>
          <p className="text-sm text-[var(--muted)] mt-2">
            Please read and understand the following rules before beginning your interview.
          </p>
        </div>

        <div
          className="overflow-y-auto flex-1 min-h-0 p-6 pb-8 space-y-6"
          onScroll={handleScroll}
        >
          {/* General Rules */}
          <section>
            <h3 className="text-lg font-semibold text-[var(--text)] mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[var(--success)]" />
              General Rules
            </h3>
            <ul className="space-y-2 text-sm text-[var(--text)]">
              <li className="flex items-start gap-2">
                <span className="text-[var(--primary)] mt-1">•</span>
                <span>Answer all questions honestly and to the best of your ability</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--primary)] mt-1">•</span>
                <span>Use your own words and avoid copying from external sources</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--primary)] mt-1">•</span>
                <span>Complete the interview in one session without interruptions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--primary)] mt-1">•</span>
                <span>Desktop or laptop computers are recommended for the best experience</span>
              </li>
            </ul>
          </section>

          {/* Security Monitoring */}
          <section>
            <h3 className="text-lg font-semibold text-[var(--text)] mb-3 flex items-center gap-2">
              <Eye className="w-5 h-5 text-[var(--warning)]" />
              Security Monitoring
            </h3>
            <p className="text-sm text-[var(--muted)] mb-3">
              The following activities are monitored and logged during your interview:
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                <Monitor className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-[var(--text)]">Tab & Window Switching</p>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Switching tabs or windows is tracked. Multiple switches (&gt;3) may result in warnings and flagging.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                <Keyboard className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-[var(--text)]">Keyboard Shortcuts</p>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Copy (Ctrl+C), Paste (Ctrl+V), and other shortcuts are disabled. Attempts are logged.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                <MousePointer2 className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-[var(--text)]">Right-Click & Text Selection</p>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Right-click context menu is disabled. Text selection outside the answer field is restricted.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                <Shield className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-[var(--text)]">Developer Tools & Screenshots</p>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Opening browser developer tools or taking screenshots is detected and logged.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* What Happens If Rules Are Violated */}
          <section>
            <h3 className="text-lg font-semibold text-[var(--text)] mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[var(--danger)]" />
              Consequences
            </h3>
            <div className="space-y-2 text-sm text-[var(--text)]">
              <p className="text-[var(--muted)]">
                Violations of interview rules may result in:
              </p>
              <ul className="space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--danger)] mt-1">•</span>
                  <span>Warnings displayed during the interview</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--danger)] mt-1">•</span>
                  <span>Security events logged in your interview record</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--danger)] mt-1">•</span>
                  <span>Flagging in the final interview report</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--danger)] mt-1">•</span>
                  <span>Potential disqualification from the selection process</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Privacy Note */}
          <section className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              <strong>Privacy Note:</strong> All security monitoring is done to ensure a fair and honest interview process. 
              Your answers and responses are evaluated by AI and may be reviewed by recruiters. Security events are logged 
              for audit purposes but do not include the content of your answers.
            </p>
          </section>
        </div>

        <div className="p-6 border-t border-[var(--border)] bg-[var(--bg)] flex-shrink-0">
          {/* Reading Progress */}
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Reading time: {readingTime}s / {MIN_READING_TIME}s
              </span>
              <span className={hasScrolled ? "text-[var(--success)]" : "text-[var(--muted)]"}>
                {hasScrolled ? "✓ Scrolled to bottom" : "Scroll to bottom"}
              </span>
            </div>
            <div className="w-full bg-[var(--border)] rounded-full h-1.5">
              <div
                className="bg-[var(--primary)] h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((readingTime / MIN_READING_TIME) * 100, 100)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <input
                type="checkbox"
                id="rules-checkbox"
                checked={canAccept}
                onChange={(e) => {
                  if (e.target.checked && canAccept) {
                    // Only allow checking if requirements are met
                  }
                }}
                disabled={!canAccept}
                className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-50"
              />
              <label htmlFor="rules-checkbox" className={`cursor-pointer ${!canAccept ? 'opacity-60' : ''}`}>
                I have read and understood the rules and security guidelines
                {!canAccept && (
                  <span className="block text-[var(--muted)] mt-1">
                    {!hasScrolled && "Please scroll to the bottom. "}
                    {readingTime < MIN_READING_TIME && `Please read for at least ${MIN_READING_TIME} seconds.`}
                  </span>
                )}
              </label>
            </div>
            <div className="flex gap-3">
              {onDecline && (
                <button
                  onClick={onDecline}
                  className="px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg)] rounded-lg transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleAccept}
                disabled={!canAccept}
                className="app-btn-primary px-6 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
              >
                I Agree & Begin Interview
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

