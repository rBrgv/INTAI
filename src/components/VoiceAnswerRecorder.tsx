"use client";

import { useEffect, useRef, useState } from "react";

type VoiceAnswerRecorderProps = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
};

export default function VoiceAnswerRecorder({
  onTranscript,
  disabled = false,
}: VoiceAnswerRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
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
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      setTranscript(finalTranscript + interimTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "no-speech" || event.error === "aborted") {
        // Ignore these errors
        return;
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
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
      setTranscript("");
      setElapsedSec(0);
      setIsRecording(true);
      recognitionRef.current.start();
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleUseTranscript = () => {
    if (transcript.trim()) {
      onTranscript(transcript.trim());
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

        {transcript && (
          <div className="mb-3 rounded-md bg-white border border-slate-200 p-3 max-h-32 overflow-y-auto">
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{transcript}</p>
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

          {transcript && (
            <>
              <button
                onClick={handleUseTranscript}
                disabled={disabled}
                className="app-btn-primary px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Use transcript
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

