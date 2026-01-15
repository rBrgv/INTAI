import { NextResponse } from "next/server";
import { getSession, updateSession, logAudit } from "@/lib/unifiedStore";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// Configure for production
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30; // Tab switch logging should be fast

export async function POST(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const body = await req.json();
    const eventType = body.type as "blur" | "focus";
    const timestamp = body.timestamp || Date.now();

    if (eventType !== "blur" && eventType !== "focus") {
      return apiError(
        "Invalid event type",
        "Event type must be 'blur' or 'focus'",
        400
      );
    }

    const session = await getSession(params.sessionId);
    if (!session) {
      return apiError("Session not found", "The requested session does not exist", 404);
    }

    // Only track during active interview (not in recruiter view or completed)
    if (session.status === "completed" || session.status === "created") {
      return apiSuccess({ ignored: true }, "Tab switch event ignored (interview not active)");
    }

    const currentEvents = session.tabSwitchEvents || [];
    const newEvent = { timestamp, type: eventType };
    const updatedEvents = [...currentEvents, newEvent];

    // Count blur events (tab switches away)
    const blurCount = updatedEvents.filter(e => e.type === "blur").length;

    const updated = await updateSession(params.sessionId, (s) => ({
      ...s,
      tabSwitchCount: blurCount,
      tabSwitchEvents: updatedEvents,
    }));

    if (updated) {
      // Log to session history
      await logAudit('tab_switch', 'session', params.sessionId, {
        event_type: eventType,
        total_blur_count: blurCount,
        timestamp,
      });
    }

    // Return warning message based on switch count
    let warning: string | null = null;
    if (blurCount > 5) {
      warning = "Excessive tab switching detected. Interview may be flagged.";
    } else if (blurCount > 3) {
      warning = "Multiple tab switches detected. Please stay focused.";
    }

    return apiSuccess(
      {
        tabSwitchCount: blurCount,
        warning,
      },
      "Tab switch event logged"
    );
  } catch (error) {
    logger.error("Tab switch logging error", error instanceof Error ? error : new Error(String(error)), { sessionId: params.sessionId });
    return apiError(
      "Internal server error",
      error instanceof Error ? error.message : "An unexpected error occurred",
      500
    );
  }
}

