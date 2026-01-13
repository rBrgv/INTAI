import { NextResponse } from "next/server";
import { getSession, updateSession, logAudit } from "@/lib/unifiedStore";
import { getOpenAI } from "@/lib/openai";
import { buildAnswerEvalPrompt } from "@/lib/prompts";
import { rateLimit } from "@/lib/rateLimit";
import { InterviewEvaluation } from "@/lib/types";
import { AnswerSubmitSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { sanitizeForStorage } from "@/lib/sanitize";
import { logger } from "@/lib/logger";

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
  logger.info("Answer submission request received", { sessionId });
  
  const session = await getSession(sessionId);
  if (!session) {
    logger.warn("Session not found for answer submission", { sessionId });
    return apiError("Session not found", "The requested session does not exist", 404);
  }

  // Basic rate limit by IP (best-effort)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rl = rateLimit({ key: `answer:${ip}`, limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return apiError(
      "Rate limit exceeded",
      "Too many requests. Please try again later.",
      429
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    logger.warn("Invalid JSON in answer submission", { sessionId });
    return apiError("Invalid JSON", "Request body must be valid JSON", 400);
  }

  logger.debug("Answer submission body received", { 
    sessionId, 
    hasAnswerText: !!body.answerText,
    answerTextLength: body.answerText?.length || 0
  });

  const validationResult = AnswerSubmitSchema.safeParse(body);
  if (!validationResult.success) {
    const errors = validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    const answerLength = body.answerText?.length || 0;
    const trimmedLength = body.answerText?.trim().length || 0;
    logger.warn("Answer validation failed", { 
      sessionId, 
      errors, 
      answerTextLength: answerLength,
      trimmedLength: trimmedLength
    });
    
    // Provide more helpful error message
    let errorMessage = errors;
    if (answerLength < 10) {
      errorMessage = `Answer must be at least 10 characters (currently ${answerLength}${trimmedLength !== answerLength ? `, ${trimmedLength} after trimming` : ''})`;
    }
    
    return apiError("Validation failed", errorMessage, 400);
  }

  const { answerText: rawAnswerText } = validationResult.data;
  
  // Sanitize answer text before storing
  let answerText: string;
  try {
    answerText = await sanitizeForStorage(rawAnswerText);
  } catch (sanitizeError) {
    logger.warn("Sanitization failed, using trimmed text", { 
      sessionId,
      error: sanitizeError instanceof Error ? sanitizeError.message : String(sanitizeError)
    });
    // Fallback to just trimming if sanitization fails
    answerText = rawAnswerText.trim();
  }
  
  logger.info("Answer validated and sanitized", { 
    sessionId, 
    originalLength: rawAnswerText.length, 
    sanitizedLength: answerText.length 
  });

  const currentQuestion = session.questions[session.currentQuestionIndex];
  if (!currentQuestion) {
    return apiError(
      "No current question",
      "Please start the interview first",
      400
    );
  }

  // Prevent duplicate evaluation for same questionId (simple guard)
  const alreadyEval = session.evaluations.some(
    (e) => e.questionId === currentQuestion.id
  );
  if (alreadyEval) {
    return apiError(
      "Question already answered",
      "This question has already been answered and evaluated",
      409
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return apiError(
      "Configuration error",
      "OPENAI_API_KEY is not configured",
      500
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

  const openai = getOpenAI();
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
    return apiError(
      "Failed to parse model response",
      "The AI model returned invalid JSON",
      500,
      { raw: raw.substring(0, 200) }
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

  const updated = await updateSession(sessionId, (s) => {
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

  if (!updated) {
    logger.error("Failed to update session after answer submission", undefined, { sessionId });
    return apiError(
      "Failed to update session",
      "Could not save answer and advance to next question",
      500
    );
  }

  // In production, verify the update was persisted before returning
  // This helps ensure the client gets fresh data
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  if (isProduction) {
    // Wait a bit for the update to propagate, then verify
    await new Promise(resolve => setTimeout(resolve, 500));
    const verified = await getSession(sessionId);
    if (verified && verified.currentQuestionIndex !== updated.currentQuestionIndex) {
      logger.warn("Session update verification failed - index mismatch", { 
        sessionId,
        expectedIndex: updated.currentQuestionIndex,
        actualIndex: verified.currentQuestionIndex
      });
      // Still return success, but log the issue
    }
  }

  await logAudit('answer_evaluated', 'session', sessionId, {
    question_id: currentQuestion.id,
    overall_score: evaluation.overall,
  });

  // Add cache-busting headers to prevent stale responses
  const response = apiSuccess(
    {
      evaluation,
      scoreSummary: updated?.scoreSummary,
      advancedToIndex: updated?.currentQuestionIndex,
      status: updated?.status,
    },
    "Answer submitted and evaluated successfully"
  );
  
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
}


