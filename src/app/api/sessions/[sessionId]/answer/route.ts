import { NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/sessionStore";
import { openai } from "@/lib/openai";
import { buildAnswerEvalPrompt } from "@/lib/prompts";
import { rateLimit } from "@/lib/rateLimit";
import { InterviewEvaluation } from "@/lib/types";

function clampInt(n: unknown, min: number, max: number) {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.round(x)));
}

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    // Best-effort: extract first {...} block
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const sliced = raw.slice(start, end + 1);
      return JSON.parse(sliced);
    }
    throw new Error("Invalid JSON");
  }
}

function computeSummary(evals: InterviewEvaluation[]) {
  const n = evals.length;
  if (n === 0) {
    return {
      countEvaluated: 0,
      avg: { technical: 0, communication: 0, problemSolving: 0, overall: 0 },
    };
  }
  const sum = evals.reduce(
    (acc, e) => {
      acc.technical += e.scores.technical;
      acc.communication += e.scores.communication;
      acc.problemSolving += e.scores.problemSolving;
      acc.overall += e.overall;
      return acc;
    },
    { technical: 0, communication: 0, problemSolving: 0, overall: 0 }
  );

  return {
    countEvaluated: n,
    avg: {
      technical: Math.round((sum.technical / n) * 10) / 10,
      communication: Math.round((sum.communication / n) * 10) / 10,
      problemSolving: Math.round((sum.problemSolving / n) * 10) / 10,
      overall: Math.round((sum.overall / n) * 10) / 10,
    },
  };
}

export async function POST(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  const sessionId = params.sessionId;
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Basic rate limit by IP (best-effort)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rl = rateLimit({ key: `answer:${ip}`, limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const answerText = String(body.answerText ?? "").trim();
  if (answerText.length < 10) {
    return NextResponse.json(
      { error: "Answer too short (min 10 chars)." },
      { status: 400 }
    );
  }

  const currentQuestion = session.questions[session.currentQuestionIndex];
  if (!currentQuestion) {
    return NextResponse.json(
      { error: "No current question. Start interview first." },
      { status: 400 }
    );
  }

  // Prevent duplicate evaluation for same questionId (simple guard)
  const alreadyEval = session.evaluations.some(
    (e) => e.questionId === currentQuestion.id
  );
  if (alreadyEval) {
    return NextResponse.json(
      { error: "This question is already answered/evaluated." },
      { status: 409 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY missing" },
      { status: 500 }
    );
  }

  const prompt = buildAnswerEvalPrompt({
    mode: session.mode,
    role: session.role,
    level: session.level,
    resumeText: session.resumeText,
    jdText: session.jdText,
    question: currentQuestion,
    answerText,
  });

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    // If your SDK/model supports JSON mode, this improves reliability:
    response_format: { type: "json_object" } as any,
    messages: [
      { role: "system", content: "Return JSON only. No markdown." },
      { role: "user", content: prompt },
    ],
  });

  const raw = resp.choices[0]?.message?.content ?? "";
  let parsed: any;
  try {
    parsed = safeJsonParse(raw);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse model JSON", raw },
      { status: 500 }
    );
  }

  // Normalize + validate
  const evaluation: InterviewEvaluation = {
    questionId: currentQuestion.id,
    scores: {
      technical: clampInt(parsed?.scores?.technical, 0, 10),
      communication: clampInt(parsed?.scores?.communication, 0, 10),
      problemSolving: clampInt(parsed?.scores?.problemSolving, 0, 10),
    },
    overall: clampInt(parsed?.overall, 0, 10),
    strengths: Array.isArray(parsed?.strengths)
      ? parsed.strengths.map((s: any) => String(s).slice(0, 140)).slice(0, 4)
      : [],
    gaps: Array.isArray(parsed?.gaps)
      ? parsed.gaps.map((s: any) => String(s).slice(0, 140)).slice(0, 4)
      : [],
    followUpQuestion: String(parsed?.followUpQuestion ?? "").slice(0, 180),
  };

  if (!evaluation.followUpQuestion) {
    evaluation.followUpQuestion =
      "Can you give one concrete example with steps and outcome?";
  }
  if (evaluation.strengths.length === 0)
    evaluation.strengths = ["Clear attempt to address the question."];
  if (evaluation.gaps.length === 0)
    evaluation.gaps = ["Needs more specifics and structured detail."];

  const updated = updateSession(sessionId, (s) => {
    const answers = [
      ...s.answers,
      {
        questionId: currentQuestion.id,
        text: answerText,
        submittedAt: Date.now(),
      },
    ];
    const evaluations = [...s.evaluations, evaluation];
    const scoreSummary = computeSummary(evaluations);

    // Auto-advance (until last question)
    const isLast = s.currentQuestionIndex >= s.questions.length - 1;
    const nextIndex = isLast ? s.currentQuestionIndex : s.currentQuestionIndex + 1;

    return {
      ...s,
      answers,
      evaluations,
      scoreSummary,
      currentQuestionIndex: nextIndex,
      status: isLast ? "completed" : s.status,
    };
  });

  return NextResponse.json({
    ok: true,
    evaluation,
    scoreSummary: updated?.scoreSummary,
    advancedToIndex: updated?.currentQuestionIndex,
    status: updated?.status,
  });
}

