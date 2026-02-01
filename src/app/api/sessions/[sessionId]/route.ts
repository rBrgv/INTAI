import { NextResponse } from "next/server";
import { getSession } from "@/lib/unifiedStore";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { getCachedSession, setCachedSession } from "@/lib/cache";

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  // Check cache first
  const cached = getCachedSession(params.sessionId);
  if (cached) {
    const response = apiSuccess(cached);
    response.headers.set('X-Cache', 'HIT');
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
  }

  const session = await getSession(params.sessionId);
  if (!session) {
    return apiError("Session not found", "The requested session does not exist", 404);
  }

  const currentQuestion =
    session.questions && session.questions.length > 0
      ? session.questions[session.currentQuestionIndex] ?? null
      : null;

  // Get all questions with their answer status
  const questionsWithStatus = session.questions?.map((q, index) => {
    const answer = session.answers?.find(a => a.questionId === q.id);
    const evaluation = session.evaluations?.find(e => e.questionId === q.id);
    return {
      id: q.id,
      text: q.text,
      category: q.category,
      difficulty: q.difficulty,
      index,
      answered: !!answer,
      evaluated: !!evaluation,
    };
  }) || [];

  const responseData = {
    session: {
      id: session.id,
      mode: session.mode,
      role: session.role,
      level: session.level,
      status: session.status,
      currentQuestionIndex: session.currentQuestionIndex || 0,
      totalQuestions: session.questions?.length || 0,
      tabSwitchCount: session.tabSwitchCount || 0,
    },
    currentQuestion,
    questions: questionsWithStatus,
    scoreSummary: session.scoreSummary,
    presence: session.presence,
  };

  // Cache the response for future requests
  setCachedSession(params.sessionId, responseData);

  const response = apiSuccess(responseData);

  // Disable caching to ensure fresh data
  response.headers.set('X-Cache', 'MISS');
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
}

