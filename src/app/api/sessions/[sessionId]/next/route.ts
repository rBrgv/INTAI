import { NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/sessionStore";

export async function POST(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  const existing = getSession(params.sessionId);
  if (!existing) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (existing.questions.length === 0) {
    return NextResponse.json(
      { error: "Interview not started. Call /start first." },
      { status: 400 }
    );
  }

  const nextIndex = Math.min(
    existing.currentQuestionIndex + 1,
    existing.questions.length - 1
  );

  const updated = updateSession(params.sessionId, (s) => ({
    ...s,
    currentQuestionIndex: nextIndex,
  }));

  return NextResponse.json({
    ok: true,
    currentQuestionIndex: updated?.currentQuestionIndex ?? nextIndex,
  });
}

