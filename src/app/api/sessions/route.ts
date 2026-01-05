import { NextResponse } from "next/server";
import { createSession, logAudit } from "@/lib/unifiedStore";
import { InterviewMode, InterviewSession, RoleLevel, JobSetup } from "@/lib/types";
import { isSupabaseConfigured, supabase as supabaseClient } from "@/lib/supabase";
import { SessionCreateSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { sanitizeForStorage } from "@/lib/sanitize";
import { logger } from "@/lib/logger";

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function randomId() {
  return crypto.randomUUID();
}

// Add GET handler for testing/debugging
export async function GET() {
  try {
    return apiSuccess(
      { message: "Sessions API endpoint is working", methods: ["POST", "OPTIONS", "GET"] },
      "Sessions endpoint active",
      200
    );
  } catch (error) {
    return apiError("Internal server error", error instanceof Error ? error.message : "Unknown error", 500);
  }
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

  try {
    await createSession(session);
  } catch (createError) {
    logger.error("Failed to create session", createError instanceof Error ? createError : new Error(String(createError)), { mode, sessionId: session.id });
    return apiError(
      "Failed to create session",
      createError instanceof Error ? createError.message : "Database error occurred",
      500
    );
  }

  // Link resume to session if resumeId provided
  if (resumeId && isSupabaseConfigured() && supabaseClient) {
    try {
      await supabaseClient
        .from("resumes")
        .update({ session_id: session.id })
        .eq("id", resumeId);
    } catch (error) {
      logger.warn("Failed to link resume to session", { resumeId, sessionId: session.id, error: error instanceof Error ? error.message : String(error) });
      // Don't fail the request if resume linking fails
    }
  }

  // Log audit (don't fail if audit logging fails)
  try {
    await logAudit('session_created', 'session', session.id, {
      mode: session.mode,
      status: session.status,
      resume_id: resumeId || null,
    });
  } catch (auditError) {
    logger.warn("Failed to log audit", { error: auditError instanceof Error ? auditError.message : String(auditError) });
    // Don't fail the request if audit logging fails
  }

  const response = apiSuccess(
    { sessionId: session.id },
    "Session created successfully",
    201
  );
  
  // Ensure no caching
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
  } catch (error) {
    logger.error("Error creating session", error instanceof Error ? error : new Error(String(error)), { mode: mode || 'unknown' });
    if (error instanceof Error) {
      return apiError("Internal server error", error.message, 500);
    }
    return apiError("Internal server error", "An unexpected error occurred", 500);
  }
}

