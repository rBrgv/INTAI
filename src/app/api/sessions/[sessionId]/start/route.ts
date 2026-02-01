import { NextResponse } from "next/server";
import { getSession, updateSession, logAudit } from "@/lib/unifiedStore";
import { getOpenAI } from "@/lib/openai";
import { buildQuestionGenPrompt } from "@/lib/prompts";
import { InterviewQuestion } from "@/lib/types";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// Vercel serverless function configuration
export const maxDuration = 60; // 60 seconds for OpenAI API calls
export const dynamic = 'force-dynamic'; // Disable caching


export async function POST(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const existing = await getSession(params.sessionId);
    if (!existing) {
      return apiError("Session not found", "The requested session does not exist", 404);
    }

    if (!process.env.OPENAI_API_KEY) {
      return apiError(
        "Configuration error",
        "OPENAI_API_KEY is not configured",
        500
      );
    }

    // If already started and has questions, return success
    if (existing.questions && existing.questions.length > 0) {
      // Ensure status is consistent. If questions exist but status is 'created', force update to 'in_progress'.
      if (existing.status === 'created') {
        await updateSession(params.sessionId, (s) => ({ ...s, status: 'in_progress' }));
      }

      const response = apiSuccess(
        {
          alreadyStarted: true,
          total: existing.questions.length,
          questions: existing.questions // Critical: Return questions so frontend can render immediately
        },
        "Interview already started"
      );
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      return response;
    }

    // Validate required fields
    // For college mode, resume text can be empty initially (candidate will upload it)
    // For other modes, resume text is required
    if (existing.mode !== "college") {
      if (!existing.resumeText || existing.resumeText.length < 50) {
        return apiError(
          "Validation failed",
          "Resume text is required and must be at least 50 characters",
          400
        );
      }
    } else {
      // College mode: resume text is optional, but if provided must be at least 50 chars
      if (existing.resumeText && existing.resumeText.length > 0 && existing.resumeText.length < 50) {
        return apiError(
          "Validation failed",
          "Resume text must be at least 50 characters if provided",
          400
        );
      }
    }

    // Get question count from jobSetup config if available
    const questionCount = existing.jobSetup?.config?.questionCount || 8;
    const jdText = existing.jdText || existing.jobSetup?.jdText;

    // For college mode, use a placeholder resume text if not provided
    // This allows the interview to start, and the candidate can provide resume later
    const resumeText = existing.resumeText || (existing.mode === "college"
      ? `Candidate: ${existing.candidateName || "Student"} (${existing.candidateEmail || "student"})`
      : "");

    // Generate questions
    const prompt = buildQuestionGenPrompt({
      mode: existing.mode,
      role: existing.role,
      level: existing.level,
      resumeText: resumeText,
      jdText: jdText,
      count: questionCount,
    });

    const resp = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" } as any,
      messages: [
        { role: "system", content: "Return JSON only. No markdown. Use this exact format: {\"questions\":[{\"id\":\"q1\",\"text\":\"...\",\"category\":\"technical\",\"difficulty\":\"medium\"}]}" },
        { role: "user", content: prompt },
      ],
    });

    const raw = resp.choices[0]?.message?.content ?? "";
    if (!raw) {
      return apiError(
        "OpenAI API error",
        "OpenAI returned empty response",
        500
      );
    }

    // Parse JSON response
    let parsed: { questions: InterviewQuestion[] };
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      logger.error("JSON parse error", parseError instanceof Error ? parseError : new Error(String(parseError)), { raw: raw.substring(0, 200) });
      return apiError(
        "Failed to parse model response",
        "The AI model returned invalid JSON",
        500,
        { raw: raw.substring(0, 500) }
      );
    }

    if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return apiError(
        "Model returned no questions",
        "The AI model did not generate any questions",
        500,
        { raw: raw.substring(0, 200) }
      );
    }

    // Normalize questions and enforce count
    const questions = parsed.questions.slice(0, questionCount).map((q, i) => ({
      id: q.id || `q${i + 1}`,
      text: q.text || `Question ${i + 1}`,
      category: q.category || "technical",
      difficulty: q.difficulty || "medium",
    }));

    // Update session with questions
    const now = Date.now();
    const updated = await updateSession(params.sessionId, (s) => ({
      ...s,
      status: "in_progress",
      questions: questions,
      currentQuestionIndex: 0,
      startedAt: now,
      lastActivityAt: now,
      questionTimings: questions.map(q => ({
        questionId: q.id,
        displayedAt: 0, // Will be set when question is actually displayed
        answeredAt: undefined,
        timeSpent: undefined,
      })),
    }));

    if (!updated) {
      return apiError(
        "Failed to update session",
        "Could not save questions to session",
        500
      );
    }

    // Verify questions were saved
    if (!updated.questions || updated.questions.length === 0) {
      return apiError(
        "Questions not saved",
        "Questions were not saved correctly to the session",
        500
      );
    }

    await logAudit('interview_started', 'session', params.sessionId, {
      question_count: questions.length,
    });

    const response = apiSuccess(
      {
        total: updated.questions.length,
        questions: updated.questions,
      },
      "Interview started successfully"
    );

    // Disable caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    logger.error("Error in start route", error instanceof Error ? error : new Error(String(error)), { sessionId: params.sessionId });
    return apiError(
      "Internal server error",
      error instanceof Error ? error.message : "An unexpected error occurred",
      500
    );
  }
}
