import { NextResponse } from "next/server";
import { getSession } from "@/lib/sessionStore";

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  const session = getSession(params.sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const currentQuestion =
    session.questions[session.currentQuestionIndex] ?? null;

  return NextResponse.json({
    session: {
      id: session.id,
      mode: session.mode,
      role: session.role,
      level: session.level,
      status: session.status,
      currentQuestionIndex: session.currentQuestionIndex,
      totalQuestions: session.questions.length,
    },
    currentQuestion,
    scoreSummary: session.scoreSummary,
    presence: session.presence,
  });
}

