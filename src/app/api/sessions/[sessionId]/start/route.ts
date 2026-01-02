import { NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/sessionStore";
import { openai } from "@/lib/openai";
import { buildQuestionGenPrompt } from "@/lib/prompts";
import { InterviewQuestion } from "@/lib/types";

export async function POST(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  const existing = getSession(params.sessionId);
  if (!existing) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY missing" },
      { status: 500 }
    );
  }

  // If already started and has questions, do nothing
  if (existing.questions.length > 0) {
    return NextResponse.json({ ok: true, alreadyStarted: true });
  }

  const prompt = buildQuestionGenPrompt({
    mode: existing.mode,
    role: existing.role,
    level: existing.level,
    resumeText: existing.resumeText,
    jdText: existing.jdText,
    count: 8,
  });

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages: [
      { role: "system", content: "You generate interview questions as JSON." },
      { role: "user", content: prompt },
    ],
  });

  const raw = resp.choices[0]?.message?.content ?? "";

  let parsed: { questions: InterviewQuestion[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse model JSON", raw },
      { status: 500 }
    );
  }

  if (
    !parsed.questions ||
    !Array.isArray(parsed.questions) ||
    parsed.questions.length === 0
  ) {
    return NextResponse.json(
      { error: "Model returned no questions", raw },
      { status: 500 }
    );
  }

  const updated = updateSession(params.sessionId, (s) => ({
    ...s,
    status: "in_progress",
    questions: parsed.questions.map((q, i) => ({
      ...q,
      id: q.id || `q${i + 1}`,
    })),
    currentQuestionIndex: 0,
  }));

  return NextResponse.json({ ok: true, total: updated?.questions.length ?? 0 });
}

