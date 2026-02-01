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
    <div className="space-y-5">
      {/* Modern Avatar and Label */}
      <div className="flex items-center gap-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center text-white font-bold text-2xl shadow-xl ring-4 ring-indigo-100/50 transition-all duration-300 hover:scale-105">
            <span className="drop-shadow-lg">AI</span>
          </div>
          {isTyping && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-3 border-white shadow-lg animate-pulse flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
          )}
          {question && !isTyping && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-3 border-white shadow-lg flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white mb-1">AI Interviewer</h3>
          <p className="text-sm text-slate-400 font-medium">
            {isTyping ? "Generating question..." : question ? "Ready to ask" : "Waiting to start"}
          </p>
        </div>
      </div>

      {/* Video Placeholder (if enabled) */}
      {showVideoPlaceholder && (
        <div className="relative w-full aspect-video rounded-2xl bg-slate-950 border border-white/10 overflow-hidden shadow-inner">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center shadow-lg border border-white/10">
                <Video className="w-10 h-10 text-indigo-400" />
              </div>
              <p className="text-sm font-semibold text-slate-200 mb-1">Camera Active</p>
              <p className="text-xs text-slate-500">Monitoring presence</p>
            </div>
          </div>
          {/* Subtle animation to indicate it's "active" */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 animate-pulse" />
          <div className="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full shadow-lg animate-pulse border-2 border-white" />
        </div>
      )}

      {/* Status Indicator */}
      {question && !isTyping && (
        <div className="rounded-xl bg-emerald-900/20 border border-emerald-500/20 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-100">Question Ready</p>
              <p className="text-xs text-emerald-300">You can now respond</p>
            </div>
          </div>
        </div>
      )}

      {/* Read Aloud Toggle - Modern */}
      {question && !isTyping && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 shadow-sm hover:bg-white/10 transition-colors">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${readAloud ? "bg-indigo-100 text-indigo-600" : "bg-slate-200 text-slate-500"
              }`}>
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">Read Aloud</p>
              <p className="text-xs text-slate-500">Hear the question spoken</p>
            </div>
          </div>
          <button
            onClick={() => onReadAloudChange(!readAloud)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shadow-sm ${readAloud ? "bg-indigo-600 shadow-indigo-200" : "bg-slate-300"
              }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${readAloud ? "translate-x-6" : "translate-x-1"
                }`}
            />
          </button>
        </div>
      )}

      {/* Speaking Indicator */}
      {isSpeaking && (
        <div className="rounded-xl bg-indigo-900/20 border border-indigo-500/20 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-sm font-semibold text-indigo-300">Speaking question...</p>
          </div>
        </div>
      )}

      {/* Typing Indicator */}
      {isTyping && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <TypingDots />
            <div>
              <p className="text-sm font-semibold text-slate-300">Preparing your question...</p>
              <p className="text-xs text-slate-500 mt-0.5">This will only take a moment</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


