"use client";

import { useEffect, useState } from "react";
import TypingDots from "./TypingDots";

type InterviewerPanelProps = {
  question: string | null;
  isTyping: boolean;
  readAloud: boolean;
  onReadAloudChange: (enabled: boolean) => void;
};

export default function InterviewerPanel({
  question,
  isTyping,
  readAloud,
  onReadAloudChange,
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
      {/* Avatar and Label */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-lg shadow-md">
          AI
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">AI Interviewer</p>
          <p className="text-xs text-slate-500">Asking questions</p>
        </div>
      </div>

      {/* Question Bubble */}
      <div className="relative">
        {isTyping ? (
          <div className="rounded-2xl rounded-tl-sm bg-slate-100 border border-slate-200 p-4">
            <TypingDots />
          </div>
        ) : question ? (
          <div className="rounded-2xl rounded-tl-sm bg-blue-50 border border-blue-200 p-4 shadow-sm transition-all duration-300">
            <p className="text-sm text-slate-900 leading-relaxed">{question}</p>
          </div>
        ) : (
          <div className="rounded-2xl rounded-tl-sm bg-slate-50 border border-slate-200 p-4">
            <p className="text-sm text-slate-500 italic">Waiting to start interview...</p>
          </div>
        )}
      </div>

      {/* Read Aloud Toggle */}
      {question && !isTyping && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onReadAloudChange(!readAloud)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              readAloud
                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {isSpeaking ? (
              <>
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                Speaking...
              </>
            ) : readAloud ? (
              <>
                <span>🔊</span>
                Read aloud ON
              </>
            ) : (
              <>
                <span>🔇</span>
                Read aloud OFF
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

