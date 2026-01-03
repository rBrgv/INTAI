import { NextResponse } from "next/server";
import { getSession, updateSession, logAudit } from "@/lib/unifiedStore";
import { apiSuccess, apiError } from "@/lib/apiResponse";

export async function POST(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  const existing = await getSession(params.sessionId);
  if (!existing) {
    return apiError("Session not found", "The requested session does not exist", 404);
  }

  if (!existing.questions || existing.questions.length === 0) {
    return apiError(
      "Interview not started",
      "Please start the interview first by calling /start",
      400
    );
  }

  const nextIndex = Math.min(
    existing.currentQuestionIndex + 1,
    existing.questions.length - 1
  );

  const updated = await updateSession(params.sessionId, (s) => ({
    ...s,
    currentQuestionIndex: nextIndex,
  }));

  if (!updated) {
    return apiError(
      "Failed to update session",
      "Could not advance to next question",
      500
    );
  }

  if (updated) {
    await logAudit('question_advanced', 'session', params.sessionId, {
      new_index: updated.currentQuestionIndex,
    });
  }

  return apiSuccess(
    {
      currentQuestionIndex: updated.currentQuestionIndex,
    },
    "Moved to next question"
  );
}


