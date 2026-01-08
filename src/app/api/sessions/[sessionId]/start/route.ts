import { NextResponse } from "next/server";
import { getSession, updateSession, logAudit } from "@/lib/unifiedStore";
import { getOpenAI } from "@/lib/openai";
import { buildQuestionGenPrompt } from "@/lib/prompts";
import { InterviewQuestion } from "@/lib/types";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

export async function POST(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  const sessionId = params.sessionId;
  // Use console.log here to ensure we see this even if logger level is wrong
  console.log(`[START ENDPOINT] POST /api/sessions/${sessionId}/start called`);
  logger.info("Start interview request received", { sessionId });
  
  try {
    const existing = await getSession(sessionId);
    logger.debug("Session retrieved", { sessionId, status: existing?.status, hasQuestions: !!existing?.questions?.length });
    if (!existing) {
      logger.warn("Session not found", { sessionId, isSupabaseConfigured: process.env.NEXT_PUBLIC_SUPABASE_URL ? true : false });
      
      // Provide helpful error message if Supabase is not configured
      const isSupabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!isSupabaseConfigured) {
        return apiError(
          "Database not configured",
          "Supabase is required for production use. Sessions cannot persist in serverless environments without a database. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.",
          503
        );
      }
      
      return apiError("Session not found", "The requested session does not exist. It may have expired or been deleted.", 404);
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
      logger.info("Interview already started", { sessionId, questionCount: existing.questions.length });
      const response = apiSuccess(
        { 
          alreadyStarted: true,
          total: existing.questions.length 
        },
        "Interview already started"
      );
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      return response;
    }

    // Validate required fields
    if (!existing.resumeText || existing.resumeText.length < 50) {
      logger.warn("Resume text validation failed", { sessionId, resumeLength: existing.resumeText?.length || 0 });
      return apiError(
        "Validation failed",
        "Resume text is required and must be at least 50 characters",
        400
      );
    }

    // Get question count from jobSetup config if available
    const questionCount = existing.jobSetup?.config?.questionCount || 8;
    const jdText = existing.jdText || existing.jobSetup?.jdText;

    logger.info("Generating interview questions", { sessionId, questionCount, mode: existing.mode, hasJdText: !!jdText });

    // Generate questions
    const prompt = buildQuestionGenPrompt({
      mode: existing.mode,
      role: existing.role,
      level: existing.level,
      resumeText: existing.resumeText,
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

    // Normalize questions
    const questions = parsed.questions.map((q, i) => ({
      id: q.id || `q${i + 1}`,
      text: q.text || `Question ${i + 1}`,
      category: q.category || "technical",
      difficulty: q.difficulty || "medium",
    }));

    logger.info("Questions generated successfully", { sessionId, questionCount: questions.length });

    // Update session with questions
    logger.info("Updating session with questions", { sessionId, questionCount: questions.length });
    const updated = await updateSession(sessionId, (s) => ({
      ...s,
      status: "in_progress",
      questions: questions,
      currentQuestionIndex: 0,
    }));

    if (!updated) {
      logger.error("updateSession returned null", undefined, { sessionId });
      return apiError(
        "Failed to update session",
        "Could not save questions to session",
        500
      );
    }

    logger.info("Session updated, verifying questions were saved", { 
      sessionId, 
      updatedQuestionCount: updated.questions?.length || 0,
      updatedStatus: updated.status 
    });

    // Verify questions were saved
    if (!updated.questions || updated.questions.length === 0) {
      logger.error("Questions not found in updated session", undefined, { 
        sessionId,
        hasQuestions: !!updated.questions,
        questionsLength: updated.questions?.length
      });
      return apiError(
        "Questions not saved",
        "Questions were not saved correctly to the session",
        500
      );
    }

    // Double-check by fetching the session again to verify it was persisted
    // The getSession function will retry if it gets stale data (handles read replica lag)
    logger.info("Verifying session was persisted to database", { sessionId });
    const verified = await getSession(sessionId);
    if (!verified) {
      logger.error("Session not found after update", undefined, { sessionId });
      return apiError(
        "Session verification failed",
        "Session was not found after update",
        500
      );
    }
    
    if (!verified.questions || verified.questions.length === 0) {
      logger.error("Questions not found in verified session", undefined, { 
        sessionId,
        verifiedStatus: verified.status,
        hasQuestions: !!verified.questions,
        questionsLength: verified.questions?.length
      });
      return apiError(
        "Questions not persisted",
        "Questions were not persisted to the database",
        500
      );
    }

    logger.info("Session verified successfully", { 
      sessionId, 
      verifiedQuestionCount: verified.questions.length,
      verifiedStatus: verified.status 
    });

    await logAudit('interview_started', 'session', sessionId, {
      question_count: questions.length,
    });

    logger.info("Interview started successfully", { sessionId, questionCount: questions.length });

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
    logger.error("Error in start route", error instanceof Error ? error : new Error(String(error)), { sessionId });
    return apiError(
      "Internal server error",
      error instanceof Error ? error.message : "An unexpected error occurred",
      500
    );
  }
}
