import { NextResponse } from "next/server";
import { getSession } from "@/lib/unifiedStore";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  const sessionId = params.sessionId;
  logger.info("GET session request received", { sessionId });
  
  try {
    const session = await getSession(sessionId);
    logger.debug("Session lookup result", { sessionId, found: !!session, status: session?.status });
    
    if (!session) {
      logger.warn("Session not found", { sessionId });
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

    logger.info("Session retrieved successfully", { 
      sessionId, 
      status: session.status, 
      questionCount: session.questions?.length || 0,
      currentIndex: session.currentQuestionIndex || 0
    });

    const response = apiSuccess({
      session: {
        id: session.id,
        mode: session.mode,
        role: session.role,
        level: session.level,
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex || 0,
        totalQuestions: session.questions?.length || 0,
        tabSwitchCount: session.tabSwitchCount || 0,
        securityEvents: session.securityEvents || [],
      },
      currentQuestion,
      questions: questionsWithStatus,
      scoreSummary: session.scoreSummary,
      presence: session.presence,
    });

    // Disable caching to ensure fresh data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    logger.error("Error in GET session route", error instanceof Error ? error : new Error(String(error)), { sessionId });
    return apiError(
      "Internal server error",
      error instanceof Error ? error.message : "An unexpected error occurred",
      500
    );
  }
}

