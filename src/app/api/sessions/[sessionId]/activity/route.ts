import { getSession, updateSession } from "@/lib/unifiedStore";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

/**
 * POST /api/sessions/[sessionId]/activity
 * Updates the last activity timestamp for a session
 * Used for session timeout tracking
 */
export async function POST(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getSession(params.sessionId);
    if (!session) {
      return apiError("Session not found", "The requested session does not exist", 404);
    }

    // Only update activity for active sessions
    if (session.status !== "in_progress") {
      return apiSuccess({ ignored: true }, "Activity update ignored (session not active)");
    }

    const now = Date.now();
    await updateSession(params.sessionId, (s) => ({
      ...s,
      lastActivityAt: now,
    }));

    return apiSuccess({ lastActivityAt: now }, "Activity updated");
  } catch (error) {
    logger.error("Activity update error", error instanceof Error ? error : new Error(String(error)), { sessionId: params.sessionId });
    return apiError(
      "Internal server error",
      error instanceof Error ? error.message : "An unexpected error occurred",
      500
    );
  }
}

