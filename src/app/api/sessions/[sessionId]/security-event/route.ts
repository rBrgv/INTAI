import { getSession, updateSession, logAudit } from "@/lib/unifiedStore";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// Configure for production
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30; // Security event logging should be fast

export async function POST(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const body = await req.json();
    const { event, timestamp, details } = body;

    if (!event || typeof event !== "string") {
      return apiError(
        "Invalid request",
        "Event type is required and must be a string",
        400
      );
    }

    const session = await getSession(params.sessionId);
    if (!session) {
      return apiError("Session not found", "The requested session does not exist", 404);
    }

    // Only track security events during active interview
    // But still save them if status is "in_progress" or if we're in the interview flow
    if (session.status === "completed") {
      return apiSuccess({ ignored: true }, "Security event ignored (interview completed)");
    }
    
    // Allow events even if status is "created" - they might be triggered during setup
    // The important thing is to track them once the interview starts

    const currentEvents = session.securityEvents || [];
    const newEvent = { 
      event, 
      timestamp: timestamp || Date.now(),
      details: details || {}
    };
    const updatedEvents = [...currentEvents, newEvent];

    // Keep only last 100 events to prevent unbounded growth
    const trimmedEvents = updatedEvents.slice(-100);

    const updated = await updateSession(params.sessionId, (s) => ({
      ...s,
      securityEvents: trimmedEvents,
    }));

    logger.info("Security event logged", {
      sessionId: params.sessionId,
      event,
      totalEvents: trimmedEvents.length,
      updated: !!updated,
      sessionStatus: session.status,
    });

    if (updated) {
      // Log critical security events to audit trail
      const criticalEvents = [
        "devtools_detected",
        "screenshot_attempt",
        "clipboard_write_attempt",
        "keyboard_shortcut_blocked"
      ];

      if (criticalEvents.includes(event)) {
        await logAudit('security_event', 'session', params.sessionId, {
          event_type: event,
          timestamp: newEvent.timestamp,
          details: newEvent.details,
        });
      }
    }

    return apiSuccess(
      {
        eventLogged: true,
        totalEvents: trimmedEvents.length,
      },
      "Security event logged"
    );
  } catch (error) {
    logger.error("Security event logging error", error instanceof Error ? error : new Error(String(error)), { sessionId: params.sessionId });
    return apiError(
      "Internal server error",
      error instanceof Error ? error.message : "An unexpected error occurred",
      500
    );
  }
}

