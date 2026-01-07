"use client";

import { useEffect, useRef } from "react";
import { clientLogger } from "@/lib/clientLogger";
import { isMobileDevice, getDeviceInfo } from "@/lib/deviceDetection";

type SecurityMonitorProps = {
  sessionId: string;
  enabled: boolean;
  onSecurityEvent?: (event: string) => void;
};

export function SecurityMonitor({ sessionId, enabled, onSecurityEvent }: SecurityMonitorProps) {
  const devToolsOpenRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const idleLoggedRef = useRef(false);
  const isMobile = isMobileDevice();

  useEffect(() => {
    if (!enabled) return;

    // Log security event to API
    const logSecurityEvent = async (event: string, details?: Record<string, any>) => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/security-event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            event, 
            timestamp: Date.now(),
            details: details || {}
          }),
        });
        
        const data = await res.json().catch(() => ({}));
        
        if (res.ok && data.success) {
          // Only call callback if event was actually logged (not ignored)
          if (!data.data?.ignored) {
            onSecurityEvent?.(event);
          } else {
            // Event was ignored (e.g., interview completed) - don't count it
            if (process.env.NODE_ENV === 'development') {
              console.log('Security event ignored:', event, data);
            }
          }
        } else {
          // Log if event failed to save
          clientLogger.warn("Security event not logged", { sessionId, event, status: res.status, error: data.error || "Unknown error" });
        }
      } catch (err) {
        clientLogger.error("Failed to log security event", err instanceof Error ? err : new Error(String(err)), { sessionId, event });
      }
    };

    // Log device info on initialization
    const deviceInfo = getDeviceInfo();
    logSecurityEvent("security_monitor_initialized", { deviceInfo });

    // 1. Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logSecurityEvent("right_click_blocked", { isMobile });
    };

    // 2. Disable text selection
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };

    // 3. Disable keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+S, Ctrl+P, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
      if (e.ctrlKey || e.metaKey) {
        const blockedKeys = ['c', 'v', 'x', 'a', 's', 'p', 'u'];
        const blockedCombos = [
          { key: 'i', shift: true }, // Ctrl+Shift+I (DevTools)
          { key: 'j', shift: true }, // Ctrl+Shift+J (Console)
          { key: 'k', shift: true }, // Ctrl+Shift+K (Console in Firefox)
        ];

        if (blockedKeys.includes(e.key.toLowerCase())) {
          e.preventDefault();
          logSecurityEvent(`keyboard_shortcut_blocked`, { key: e.key, ctrl: true });
        }

        if (blockedCombos.some(combo => combo.key === e.key.toLowerCase() && combo.shift === e.shiftKey)) {
          e.preventDefault();
          logSecurityEvent(`keyboard_shortcut_blocked`, { key: e.key, ctrl: true, shift: true });
        }
      }

      // Block F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault();
        logSecurityEvent("devtools_attempt_f12");
      }

      // Block PrintScreen
      if (e.key === 'PrintScreen' || (e.key === 'F13' && e.shiftKey)) {
        e.preventDefault();
        logSecurityEvent("screenshot_attempt");
      }

      // Track activity
      lastActivityRef.current = Date.now();
    };

    // 4. Detect DevTools opening (less reliable on mobile)
    const detectDevTools = () => {
      // Skip DevTools detection on mobile as it's unreliable
      if (isMobile) return;
      
      const threshold = 160;
      const heightDiff = window.outerHeight - window.innerHeight;
      const widthDiff = window.outerWidth - window.innerWidth;
      
      if (heightDiff > threshold || widthDiff > threshold) {
        if (!devToolsOpenRef.current) {
          devToolsOpenRef.current = true;
          logSecurityEvent("devtools_detected", { 
            heightDiff, 
            widthDiff,
            method: heightDiff > threshold ? 'height' : 'width',
            isMobile: false
          });
        }
      } else {
        if (devToolsOpenRef.current) {
          devToolsOpenRef.current = false;
          logSecurityEvent("devtools_closed");
        }
      }
    };

    // 5. Periodic presence check (every 2 minutes) - Only log if tab is hidden
    const presenceCheckInterval = setInterval(() => {
      if (document.hidden) {
        logSecurityEvent("tab_hidden_during_presence_check");
      }
      // Don't log if tab is visible - that's normal
    }, 2 * 60 * 1000);

    // 6. Mouse and keyboard activity tracking
    const trackActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // 7. Idle detection (5 minutes) - Only log once per idle period
    const idleCheckInterval = setInterval(() => {
      const idleTime = Date.now() - lastActivityRef.current;
      if (idleTime > 5 * 60 * 1000 && !idleLoggedRef.current) {
        idleLoggedRef.current = true;
        logSecurityEvent("idle_detected", { idleTimeMs: idleTime });
      } else if (idleTime < 5 * 60 * 1000 && idleLoggedRef.current) {
        // Reset if user becomes active again
        idleLoggedRef.current = false;
      }
    }, 60000); // Check every minute

    // Note: Tab switch tracking is handled in InterviewClient, not here
    // to avoid duplicate logging

    // 8. Prevent drag and drop of text/images
    const handleDragStart = (e: DragEvent) => {
      if (e.dataTransfer) {
        e.preventDefault();
        logSecurityEvent("drag_blocked");
      }
    };

    // 10. Detect copy attempts via clipboard API (may be limited on mobile)
    const originalClipboardWrite = navigator.clipboard?.writeText;
    if (navigator.clipboard && originalClipboardWrite && !isMobile) {
      // On mobile, clipboard API monitoring is less reliable, so we skip it
      (navigator.clipboard as any).writeText = function(text: string) {
        logSecurityEvent("clipboard_write_attempt", { isMobile: false });
        return originalClipboardWrite.call(this, text);
      };
    }

    // Attach all event listeners
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', detectDevTools);
    document.addEventListener('mousemove', trackActivity);
    document.addEventListener('mousedown', trackActivity);
    document.addEventListener('keypress', trackActivity);
    // Note: visibilitychange is handled in InterviewClient for tab switch tracking
    document.addEventListener('dragstart', handleDragStart);

    // Initial DevTools check and continuous monitoring
    detectDevTools();
    const devToolsCheckInterval = setInterval(detectDevTools, 1000);

    // Initial activity timestamp
    lastActivityRef.current = Date.now();

    // Cleanup
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', detectDevTools);
      document.removeEventListener('mousemove', trackActivity);
      document.removeEventListener('mousedown', trackActivity);
      document.removeEventListener('keypress', trackActivity);
      // Note: visibilitychange is handled in InterviewClient
      document.removeEventListener('dragstart', handleDragStart);
      
      clearInterval(presenceCheckInterval);
      clearInterval(idleCheckInterval);
      clearInterval(devToolsCheckInterval);

      // Restore clipboard API if we modified it
      if (navigator.clipboard && originalClipboardWrite && !isMobile) {
        (navigator.clipboard as any).writeText = originalClipboardWrite;
      }
    };
  }, [enabled, sessionId, onSecurityEvent, isMobile]);

  return null;
}

