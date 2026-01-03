"use client";

import { useEffect, useState } from "react";
import { Mic, Video, CheckCircle2 } from "lucide-react";
import TypingDots from "./TypingDots";

type InterviewerPanelProps = {
  question: string | null;
  isTyping: boolean;
  readAloud: boolean;
  onReadAloudChange: (enabled: boolean) => void;
  showVideoPlaceholder?: boolean; // New prop for video placeholder
};

export default function InterviewerPanel({
  question,
  isTyping,
  readAloud,
  onReadAloudChange,
  showVideoPlaceholder = false,
}: InterviewerPanelProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (question && readAloud && !isTyping) {
      const utterance = new SpeechSynthesisUtterance(question);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 0.8;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);

      return () => {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      };
    }
  }, [question, readAloud, isTyping]);

  return (
    <div className="space-y-4">
      {/* Enhanced Avatar and Label */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg ring-4 ring-blue-100">
            AI
          </div>
          {isTyping && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white animate-pulse" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-base font-bold text-slate-900">AI Interviewer</p>
          <p className="text-xs text-slate-500">
            {isTyping ? "Generating question..." : question ? "Ready to ask" : "Waiting to start"}
          </p>
        </div>
      </div>

      {/* Video Placeholder (if enabled) */}
      {showVideoPlaceholder && (
        <div className="relative w-full aspect-video rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-slate-300 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-300 flex items-center justify-center">
                <Video className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-xs font-medium text-slate-600">Camera Active</p>
              <p className="text-xs text-slate-400 mt-1">Monitoring presence</p>
            </div>
          </div>
          {/* Subtle animation to indicate it's "active" */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 animate-pulse" />
        </div>
      )}

      {/* Status Indicator */}
      {question && !isTyping && (
        <div className="rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <p className="text-xs font-medium text-green-800">Question ready</p>
          </div>
        </div>
      )}

      {/* Read Aloud Toggle - Enhanced */}
      {question && !isTyping && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-slate-600" />
            <div>
              <p className="text-xs font-semibold text-slate-900">Read Aloud</p>
              <p className="text-xs text-slate-500">Hear the question</p>
            </div>
          </div>
          <button
            onClick={() => onReadAloudChange(!readAloud)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              readAloud ? "bg-blue-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                readAloud ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      )}

      {/* Speaking Indicator */}
      {isSpeaking && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-xs font-medium text-blue-800">Speaking question...</p>
          </div>
        </div>
      )}

      {/* Typing Indicator */}
      {isTyping && (
        <div className="rounded-lg bg-slate-100 border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <TypingDots />
            <p className="text-xs text-slate-600">Preparing your question...</p>
          </div>
        </div>
      )}
    </div>
  );
}


