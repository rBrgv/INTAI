import { NextResponse } from "next/server";
import { getSession, updateSession, logAudit } from "@/lib/unifiedStore";
import { apiSuccess, apiError } from "@/lib/apiResponse";

// Configure for production
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30; // Navigation should be fast

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

  const previousIndex = Math.max(
    existing.currentQuestionIndex - 1,
    0
  );

  const updated = await updateSession(params.sessionId, (s) => ({
    ...s,
    currentQuestionIndex: previousIndex,
  }));

  if (!updated) {
    return apiError(
      "Failed to update session",
      "Could not navigate to previous question",
      500
    );
  }

  await logAudit('question_navigated_back', 'session', params.sessionId, {
    new_index: updated.currentQuestionIndex,
  });

  return apiSuccess(
    {
      currentQuestionIndex: updated.currentQuestionIndex,
    },
    "Moved to previous question"
  );
}

