"use client";

import { useEffect, useRef, useState } from "react";
import Card from "./Card";
import { clientLogger } from "@/lib/clientLogger";

type PresenceCheckModalProps = {
  sessionId: string;
  phrasePrompt: string;
  onComplete: () => void;
  onSkip: () => void;
};

export default function PresenceCheckModal({
  sessionId,
  phrasePrompt,
  onComplete,
  onSkip,
}: PresenceCheckModalProps) {
  const [step, setStep] = useState<"photo" | "phrase">("photo");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [phraseTranscript, setPhraseTranscript] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  // Check if already dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem(`presenceDismissed:${sessionId}`);
    if (dismissed === "true") {
      onSkip();
    }
  }, [sessionId, onSkip]);

  // Initialize camera
  useEffect(() => {
    if (step === "photo" && !photoDataUrl) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          setCameraError("Camera access not available. You can skip this step.");
          clientLogger.error("Camera error", err instanceof Error ? err : new Error(String(err)), { sessionId });
        });
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [step, photoDataUrl]);

  // Initialize speech recognition
  useEffect(() => {
    if (step === "phrase") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setSpeechError("Speech recognition not supported. You can skip this step.");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setPhraseTranscript(transcript);
        setIsRecording(false);
      };

      recognition.onerror = (event: any) => {
        setSpeechError("Speech recognition error. You can skip this step.");
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [step]);

  const takePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      setPhotoDataUrl(dataUrl);

      // Stop camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    }
  };

  const startRecording = () => {
    if (recognitionRef.current) {
      setIsRecording(true);
      setSpeechError(null);
      recognitionRef.current.start();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoDataUrl: photoDataUrl || undefined,
          phraseTranscript: phraseTranscript || undefined,
        }),
      });

      if (res.ok) {
        localStorage.setItem(`presenceDismissed:${sessionId}`, "true");
        onComplete();
      }
    } catch (error) {
      clientLogger.error("Failed to save presence", error instanceof Error ? error : new Error(String(error)), { sessionId });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(`presenceDismissed:${sessionId}`, "true");
    onSkip();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card variant="elevated" className="max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-[var(--text)]">Presence check (optional)</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            This step helps maintain a focused interview experience. You may skip it.
          </p>
        </div>

        {step === "photo" && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-300 mb-2">Step 1: Take a photo</p>
              {cameraError ? (
                <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
                  <p className="text-sm text-yellow-800">{cameraError}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {!photoDataUrl ? (
                    <div className="relative bg-slate-100 rounded-lg overflow-hidden aspect-video">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="relative bg-slate-100 rounded-lg overflow-hidden aspect-video">
                      <img
                        src={photoDataUrl}
                        alt="Captured photo"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {!photoDataUrl && (
                    <button
                      onClick={takePhoto}
                      className="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700"
                    >
                      Take photo
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              {photoDataUrl && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded-md bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : "Save photo & continue"}
                </button>
              )}
              <button
                onClick={() => setStep("phrase")}
                disabled={saving}
                className="flex-1 rounded-md bg-black px-4 py-2 text-white font-medium hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {photoDataUrl ? "Continue to phrase" : "Skip photo, go to phrase"}
              </button>
              <button
                onClick={handleSkip}
                disabled={saving}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-60"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {step === "phrase" && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-300 mb-2">Step 2: Speak a phrase</p>
              <div className="rounded-md bg-blue-50 border border-blue-200 p-4 mb-3">
                <p className="text-sm font-medium text-blue-900 mb-1">Please say:</p>
                <p className="text-sm text-blue-700">{phrasePrompt}</p>
              </div>

              {speechError ? (
                <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
                  <p className="text-sm text-yellow-800">{speechError}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {isRecording && (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />
                      Recording...
                    </div>
                  )}
                  {phraseTranscript && (
                    <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
                      <p className="text-sm text-slate-700">
                        <span className="font-medium">Captured:</span> {phraseTranscript}
                      </p>
                    </div>
                  )}
                  {!phraseTranscript && !isRecording && (
                    <button
                      onClick={startRecording}
                      className="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700"
                    >
                      Start recording
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving || (!phraseTranscript && !speechError)}
                className="flex-1 rounded-md bg-black px-4 py-2 text-white font-medium hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save & continue"}
              </button>
              <button
                onClick={handleSkip}
                disabled={saving}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-60"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

