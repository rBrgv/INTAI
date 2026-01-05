"use client";

import { useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";

type VoiceAnswerRecorderProps = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
};

export default function VoiceAnswerRecorder({
  onTranscript,
  disabled = false,
}: VoiceAnswerRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState(""); // Persistent draft transcript (finalized text)
  const [interimTranscript, setInterimTranscript] = useState(""); // Current interim results
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let newInterim = "";
      let newFinal = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newFinal += transcript + " ";
        } else {
          newInterim += transcript;
        }
      }

      // Update interim transcript (live typing)
      setInterimTranscript(newInterim);
      
      // Add finalized text to persistent transcript
      if (newFinal) {
        setTranscript((prev) => {
          return prev ? `${prev} ${newFinal.trim()}`.trim() : newFinal.trim();
        });
      }
    };

    recognition.onerror = (event: any) => {
      logger.error("Speech recognition error", new Error(event.error));
      if (event.error === "no-speech" || event.error === "aborted") {
        // Ignore these errors
        return;
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      // Keep transcript persistent - don't clear on silence
      // Finalize any remaining interim text
      if (interimTranscript.trim()) {
        setTranscript((prev) => {
          return prev ? `${prev} ${interimTranscript.trim()}`.trim() : interimTranscript.trim();
        });
        setInterimTranscript("");
      }
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setElapsedSec((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsedSec(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = () => {
    if (recognitionRef.current && !disabled) {
      // Don't clear transcript - keep it persistent
      // Only reset timer and interim transcript for new session
      setElapsedSec(0);
      setInterimTranscript(""); // Reset interim, but keep persistent transcript
      setIsRecording(true);
      recognitionRef.current.start();
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      // Finalize any remaining interim text
      if (interimTranscript.trim()) {
        setTranscript((prev) => {
          return prev ? `${prev} ${interimTranscript.trim()}`.trim() : interimTranscript.trim();
        });
        setInterimTranscript("");
      }
    }
  };

  const handleUseTranscript = () => {
    const fullTranscript = transcript + (interimTranscript ? ` ${interimTranscript}` : "");
    if (fullTranscript.trim()) {
      onTranscript(fullTranscript.trim());
      // Keep transcript persistent so user can edit or continue recording
    }
  };

  const handleClear = () => {
    setTranscript("");
    setElapsedSec(0);
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isSupported) {
    return (
      <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
        <p className="text-xs text-slate-600">
          Voice recording not supported in this browser. Please type your answer.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-slate-50 border border-[var(--border)] p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-[var(--text)]">Record response</p>
          {isRecording && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />
              <span>Recording...</span>
              <span className="font-mono">{formatTime(elapsedSec)}</span>
            </div>
          )}
        </div>

        {(transcript || interimTranscript) && (
          <div className="mb-3 rounded-md bg-white border border-slate-200 p-3 max-h-32 overflow-y-auto">
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {transcript}
              {interimTranscript && (
                <span className="text-slate-500 italic">{interimTranscript}</span>
              )}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={disabled}
              className="app-btn-primary px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700"
            >
              Start recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="rounded-md bg-red-600 px-4 py-2 text-white text-sm font-medium hover:bg-red-700"
            >
              Stop recording
            </button>
          )}

          {(transcript || interimTranscript) && (
            <>
              <button
                onClick={handleUseTranscript}
                disabled={disabled}
                className="app-btn-primary px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Confirm Answer
              </button>
              <button
                onClick={handleClear}
                className="app-btn-secondary px-4 py-2 text-sm"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

