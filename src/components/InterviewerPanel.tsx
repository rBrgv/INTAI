"use client";

import { useEffect, useState, useRef } from "react";
import { Video, VideoOff, AlertTriangle, Lock } from "lucide-react";
import Badge from "./Badge";
import TypingDots from "./TypingDots";

type InterviewerPanelProps = {
  question: string | null;
  isTyping: boolean;
  readAloud: boolean;
  onReadAloudChange: (enabled: boolean) => void;
  showVideoPlaceholder?: boolean; // New prop for video placeholder
  cameraEnabled?: boolean; // Camera is always on, but UI shows as disabled
  onCameraToggle?: (enabled: boolean) => void; // For UI state only
  tabSwitchCount?: number;
  tabSwitchWarning?: string | null;
  securityEventCount?: number;
  isRecruiterView?: boolean;
  sessionStatus?: string;
};

export default function InterviewerPanel({
  question,
  isTyping,
  readAloud,
  onReadAloudChange,
  showVideoPlaceholder = false,
  cameraEnabled = false, // UI state - always shows as off
  onCameraToggle,
  tabSwitchCount = 0,
  tabSwitchWarning = null,
  securityEventCount = 0,
  isRecruiterView = false,
  sessionStatus = "created",
}: InterviewerPanelProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Camera is always on in the background, regardless of UI state
  useEffect(() => {
    if (question && !isTyping) {
      let stream: MediaStream | null = null;
      
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn("Camera access not available in this browser");
        return;
      }
      
      // Always access camera, even if UI shows it as "off"
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: false })
        .then((mediaStream) => {
          stream = mediaStream;
          setCameraStream(mediaStream);
          // Show video feed if camera is enabled in UI
          if (cameraEnabled && videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
        })
        .catch((error) => {
          console.error("Camera access error:", error);
        });

      return () => {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      };
    }
  }, [question, isTyping, cameraEnabled]);

  // Update video display when camera toggle changes
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      if (cameraEnabled) {
        videoRef.current.srcObject = cameraStream;
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [cameraEnabled, cameraStream]);

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
    <div className="space-y-3 pb-0">
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

      {/* Video Feed or Placeholder */}
      {showVideoPlaceholder && (
        <div className="relative w-full aspect-video rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-slate-300 overflow-hidden">
          {cameraEnabled && cameraStream ? (
            // Show live video feed
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            // Show placeholder when camera is "off" in UI
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-300 flex items-center justify-center">
                  <VideoOff className="w-8 h-8 text-slate-500" />
                </div>
                <p className="text-xs font-medium text-slate-600">View Disabled</p>
                <p className="text-xs text-slate-400 mt-1">Monitoring still active</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Camera Toggle - UI shows as off, but camera is always on */}
      {question && !isTyping && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2">
              {cameraEnabled ? (
                <Video className="w-5 h-5 text-slate-600" />
              ) : (
                <VideoOff className="w-5 h-5 text-slate-400" />
              )}
              <div>
                <p className="text-xs font-semibold text-slate-900">On Camera</p>
                <p className="text-xs text-slate-500">
                  {cameraEnabled ? "Camera active" : "Camera disabled"}
                </p>
              </div>
            </div>
            <button
              onClick={() => onCameraToggle && onCameraToggle(!cameraEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                cameraEnabled ? "bg-blue-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  cameraEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Security Alerts - Below Camera Toggle */}
          {!isRecruiterView && sessionStatus === "in_progress" && (tabSwitchCount > 0 || tabSwitchWarning || securityEventCount > 0) && (
            <div className="space-y-2 pt-2 border-t border-slate-200 pb-0">
              <p className="text-xs font-semibold text-slate-700 mb-2">Security Monitoring</p>
              <div className="space-y-2">
                {tabSwitchCount > 0 && (
                  <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    tabSwitchCount > 3 
                      ? "bg-red-50 border-red-200" 
                      : "bg-amber-50 border-amber-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded ${
                        tabSwitchCount > 3 
                          ? "bg-red-100" 
                          : "bg-amber-100"
                      }`}>
                        <AlertTriangle className={`w-3.5 h-3.5 ${
                          tabSwitchCount > 3 
                            ? "text-red-600" 
                            : "text-amber-600"
                        }`} />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-900">Tab Switches</p>
                        <p className="text-xs text-slate-600">
                          {tabSwitchCount} detected
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold ${
                      tabSwitchCount > 3 
                        ? "text-red-700" 
                        : "text-amber-700"
                    }`}>
                      {tabSwitchCount > 3 ? "High" : "Moderate"}
                    </span>
                  </div>
                )}
                {tabSwitchWarning && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg border bg-red-50 border-red-200">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded bg-red-100">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-900">Warning</p>
                        <p className="text-xs text-slate-600">{tabSwitchWarning}</p>
                      </div>
                    </div>
                  </div>
                )}
                {securityEventCount > 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg border bg-red-50 border-red-200">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded bg-red-100">
                        <Lock className="w-3.5 h-3.5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-900">Security Events</p>
                        <p className="text-xs text-slate-600">
                          {securityEventCount} violation{securityEventCount > 1 ? "s" : ""} detected
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-red-700">
                      Critical
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
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


