import { NextResponse } from "next/server";
import { createSession } from "@/lib/sessionStore";
import { InterviewMode, InterviewSession, RoleLevel } from "@/lib/types";

function randomId() {
  return crypto.randomUUID();
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode = body.mode as InterviewMode;
  if (mode !== "company" && mode !== "open") {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const resumeText = String(body.resumeText ?? "").trim();
  if (!resumeText || resumeText.length < 50) {
    return NextResponse.json(
      { error: "Resume text is required (min 50 chars)." },
      { status: 400 }
    );
  }

  const jdText = body.jdText ? String(body.jdText).trim() : undefined;
  const role = body.role ? String(body.role).trim() : undefined;
  const level = body.level as RoleLevel | undefined;

  if (mode === "company") {
    if (!jdText || jdText.length < 50) {
      return NextResponse.json(
        { error: "JD text is required for Company mode (min 50 chars)." },
        { status: 400 }
      );
    }
  }

  if (mode === "open") {
    if (!role) {
      return NextResponse.json(
        { error: "Role is required for Open Market mode." },
        { status: 400 }
      );
    }
    if (!level || !["junior", "mid", "senior"].includes(level)) {
      return NextResponse.json(
        { error: "Level must be one of: junior, mid, senior." },
        { status: 400 }
      );
    }
  }

  const session: InterviewSession = {
    id: randomId(),
    mode,
    createdAt: Date.now(),
    resumeText,
    jdText,
    role,
    level,
    status: "created",
    questions: [],
    currentQuestionIndex: 0,
    answers: [],
    evaluations: [],
    scoreSummary: {
      countEvaluated: 0,
      avg: { technical: 0, communication: 0, problemSolving: 0, overall: 0 },
    },
    presence: {
      phrasePrompt: "I confirm this interview response is my own.",
    },
  };

  createSession(session);

  return NextResponse.json({ sessionId: session.id }, { status: 201 });
}

