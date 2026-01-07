"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "./Card";
import Badge from "./Badge";
import { Shield, ChevronDown, ChevronUp, AlertTriangle, Eye, MousePointer2, Keyboard, Monitor, RefreshCw } from "lucide-react";

type SecurityEvent = {
  event: string;
  timestamp: number;
  details?: Record<string, any>;
};

type SecurityEventPanelProps = {
  sessionId: string;
  enabled: boolean;
};

const EVENT_ICONS: Record<string, React.ReactNode> = {
  devtools_detected: <Monitor className="w-4 h-4" />,
  screenshot_attempt: <AlertTriangle className="w-4 h-4" />,
  clipboard_write_attempt: <Keyboard className="w-4 h-4" />,
  keyboard_shortcut_blocked: <Keyboard className="w-4 h-4" />,
  right_click_blocked: <MousePointer2 className="w-4 h-4" />,
  tab_switched_away: <Eye className="w-4 h-4" />,
  tab_hidden_during_presence_check: <Eye className="w-4 h-4" />,
};

const EVENT_LABELS: Record<string, string> = {
  devtools_detected: "DevTools Detected",
  screenshot_attempt: "Screenshot Attempt",
  clipboard_write_attempt: "Clipboard Access",
  keyboard_shortcut_blocked: "Shortcut Blocked",
  right_click_blocked: "Right-Click Blocked",
  tab_switched_away: "Tab Switched",
  tab_hidden_during_presence_check: "Tab Hidden",
  security_monitor_initialized: "Security Monitor Started",
  idle_detected: "Idle Detected",
  devtools_attempt_f12: "F12 Pressed (DevTools)",
  devtools_closed: "DevTools Closed",
  drag_blocked: "Drag & Drop Blocked",
};

export default function SecurityEventPanel({ sessionId, enabled }: SecurityEventPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSecurityEvents = useCallback(async () => {
    if (!enabled) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (!res.ok) {
        console.error("Failed to fetch session:", res.status);
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      
      // Debug logging
      if (process.env.NODE_ENV === 'development') {
        console.log('SecurityEventPanel fetch:', {
          success: data.success,
          hasData: !!data.data,
          hasSession: !!data.data?.session,
          hasEvents: !!data.data?.session?.securityEvents,
          eventCount: data.data?.session?.securityEvents?.length || 0,
          sessionStatus: data.data?.session?.status,
          events: data.data?.session?.securityEvents || [],
        });
      }
      
      // Handle both response formats
      const securityEvents = data.data?.session?.securityEvents || 
                            data.session?.securityEvents || 
                            [];
      
      if (Array.isArray(securityEvents)) {
        // Sort by timestamp, newest first
        const sortedEvents = [...securityEvents].sort((a, b) => b.timestamp - a.timestamp);
        setEvents(sortedEvents);
        
        // Auto-open panel if there are critical events and it's closed
        const hasCritical = sortedEvents.some((e: SecurityEvent) => 
          ['devtools_detected', 'screenshot_attempt', 'clipboard_write_attempt', 'keyboard_shortcut_blocked', 'right_click_blocked'].includes(e.event)
        );
        if (hasCritical && !isOpen && sortedEvents.length > 0) {
          setIsOpen(true);
        }
      } else {
        // If no events array, set empty array
        setEvents([]);
      }
    } catch (err) {
      console.error("Failed to fetch security events", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, sessionId]);

  useEffect(() => {
    if (enabled) {
      // Initial fetch with small delay to ensure session is ready
      const initialTimeout = setTimeout(() => {
        fetchSecurityEvents();
      }, 500);
      
      // Poll for updates every 2 seconds (more frequent)
      const interval = setInterval(fetchSecurityEvents, 2000);
      
      return () => {
        clearTimeout(initialTimeout);
        clearInterval(interval);
      };
    }
  }, [enabled, sessionId, fetchSecurityEvents]);

  // Refresh when panel opens
  useEffect(() => {
    if (isOpen && enabled) {
      fetchSecurityEvents();
    }
  }, [isOpen, enabled, fetchSecurityEvents]);

  if (!enabled) return null;

  const criticalEvents = events.filter(e => 
    ['devtools_detected', 'screenshot_attempt', 'clipboard_write_attempt', 'keyboard_shortcut_blocked', 'right_click_blocked'].includes(e.event)
  );
  
  // Show all events, sorted by timestamp (newest first), limit to last 50 for performance
  const displayEvents = events
    .slice(-50)
    .reverse(); // Last 50 events, newest first

  return (
    <Card className={`border-l-4 ${criticalEvents.length > 0 ? 'border-l-[var(--danger)]' : 'border-l-[var(--warning)]'}`}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex-1 flex items-center justify-between p-4 hover:bg-[var(--bg)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Shield className={`w-5 h-5 ${criticalEvents.length > 0 ? 'text-[var(--danger)]' : 'text-[var(--warning)]'}`} />
              {criticalEvents.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--danger)] rounded-full animate-pulse" />
              )}
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-sm text-[var(--text)] flex items-center gap-2">
                Security Events
                {criticalEvents.length > 0 && (
                  <Badge variant="error" className="text-xs px-1.5 py-0">
                    {criticalEvents.length}
                  </Badge>
                )}
              </h3>
              <p className="text-xs text-[var(--muted)]">
                {events.length} total event{events.length !== 1 ? 's' : ''}
                {criticalEvents.length > 0 && (
                  <span className="text-[var(--danger)] ml-2 font-semibold">
                    • {criticalEvents.length} security alert{criticalEvents.length !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
            </div>
          </div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-[var(--muted)]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[var(--muted)]" />
          )}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            fetchSecurityEvents();
          }}
          className="p-2 hover:bg-[var(--bg)] rounded transition-colors"
          title="Refresh events"
        >
          <RefreshCw className={`w-4 h-4 text-[var(--muted)] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-[var(--border)] p-4 space-y-3 max-h-96 overflow-y-auto">
          {loading && events.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-4">Loading events...</p>
          ) : events.length === 0 ? (
            <div className="text-sm text-[var(--muted)] text-center py-4">
              <p>No security events recorded</p>
              <p className="text-xs mt-2 text-[var(--muted)]/70">
                Events will appear here when detected during the interview
              </p>
            </div>
          ) : displayEvents.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-4">No events to display</p>
          ) : (
            displayEvents.map((event, index) => {
              const isCritical = ['devtools_detected', 'screenshot_attempt', 'clipboard_write_attempt', 'keyboard_shortcut_blocked', 'right_click_blocked'].includes(event.event);
              const eventLabel = EVENT_LABELS[event.event] || event.event.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              const eventIcon = EVENT_ICONS[event.event] || <Shield className="w-4 h-4" />;

              return (
                <div
                  key={`${event.timestamp}-${index}`}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    isCritical
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : 'bg-[var(--bg)] border-[var(--border)]'
                  }`}
                >
                  <div className={`flex-shrink-0 mt-0.5 ${
                    isCritical ? 'text-red-600 dark:text-red-400' : 'text-[var(--muted)]'
                  }`}>
                    {eventIcon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={`text-sm font-medium ${
                        isCritical ? 'text-red-800 dark:text-red-200' : 'text-[var(--text)]'
                      }`}>
                        {eventLabel}
                      </p>
                      {isCritical && (
                        <Badge variant="error" className="text-xs">Critical</Badge>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted)]">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </p>
                    {event.details && Object.keys(event.details).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-[var(--muted)] cursor-pointer hover:text-[var(--text)]">
                          View details
                        </summary>
                        <pre className="text-xs mt-2 p-2 bg-[var(--bg)] rounded border border-[var(--border)] overflow-x-auto">
                          {JSON.stringify(event.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </Card>
  );
}

