import { NextResponse } from "next/server";
import { createSession, logAudit } from "@/lib/unifiedStore";
import { InterviewMode, InterviewSession, RoleLevel, JobSetup } from "@/lib/types";
import { isSupabaseConfigured, supabase as supabaseClient } from "@/lib/supabase";
import { SessionCreateSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { sanitizeForStorage } from "@/lib/sanitize";
import { logger } from "@/lib/logger";

function randomId() {
  return crypto.randomUUID();
}

export async function POST(req: Request) {
  let mode: InterviewMode | undefined;
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return apiError("Invalid JSON", "Request body must be valid JSON", 400);
    }

    // Validate with Zod
    const validationResult = SessionCreateSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return apiError("Validation failed", errors, 400);
    }

    const validated = validationResult.data;
    mode = validated.mode;
    // Sanitize user inputs before storing
    const resumeText = sanitizeForStorage(validated.resumeText);
    const resumeId = validated.resumeId;
    const jobSetup = validated.jobSetup ? {
      ...validated.jobSetup,
      jdText: validated.jobSetup.jdText ? sanitizeForStorage(validated.jobSetup.jdText) : undefined,
      topSkills: validated.jobSetup.topSkills ? validated.jobSetup.topSkills.map(s => sanitizeForStorage(s)) : undefined,
      resumeText: validated.jobSetup.resumeText ? sanitizeForStorage(validated.jobSetup.resumeText) : undefined,
    } : undefined;

  const session: InterviewSession = {
    id: randomId(),
    mode,
    createdAt: Date.now(),
    resumeText,
    jdText: jobSetup?.jdText,
    role: validated.role,
    level: validated.level,
    status: "created",
    questions: [],
    currentQuestionIndex: 0,
    answers: [],
    evaluations: [],
    scoreSummary: {
      countEvaluated: 0,
      avg: { technical: 0, communication: 0, problemSolving: 0, overall: 0 },
    },
    jobSetup: jobSetup ? {
      ...(jobSetup.jdText && { jdText: jobSetup.jdText }),
      ...(jobSetup.topSkills && { topSkills: jobSetup.topSkills }),
      config: jobSetup.config,
      ...(mode === "company" && resumeText && { resumeText }),
    } : undefined,
    presence: {
      phrasePrompt: "I confirm this interview response is my own.",
    },
  };

  await createSession(session);

  // Link resume to session if resumeId provided
  if (resumeId && isSupabaseConfigured() && supabaseClient) {
    try {
      await supabaseClient
        .from("resumes")
        .update({ session_id: session.id })
        .eq("id", resumeId);
             } catch (error) {
               logger.warn("Failed to link resume to session", { resumeId, sessionId: session.id, error: error instanceof Error ? error.message : String(error) });
             }
  }

  // Log audit
  await logAudit('session_created', 'session', session.id, {
    mode: session.mode,
    status: session.status,
    resume_id: resumeId || null,
  });

  return apiSuccess(
    { sessionId: session.id },
    "Session created successfully",
    201
  );
  } catch (error) {
    logger.error("Error creating session", error instanceof Error ? error : new Error(String(error)), { mode: mode || 'unknown' });
    if (error instanceof Error) {
      return apiError("Internal server error", error.message, 500);
    }
    return apiError("Internal server error", "An unexpected error occurred", 500);
  }
}

