import { NextResponse } from "next/server";
import { createBatch, getTemplate, createSession, logAudit } from "@/lib/unifiedStore";
import { CandidateBatch, InterviewSession } from "@/lib/types";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { sanitizeForStorage } from "@/lib/sanitize";

// Configure for production
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30; // Batch creation should be fast

function randomId() {
  return crypto.randomUUID();
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return apiError("Invalid JSON", "Request body must be valid JSON", 400);
  }

  const jobTemplateId = String(body.jobTemplateId ?? "");
  const template = await getTemplate(jobTemplateId);
  if (!template) {
    return apiError("Template not found", "The requested job template does not exist", 404);
  }

  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  if (candidates.length === 0) {
    return apiError(
      "Validation failed",
      "At least one candidate is required",
      400
    );
  }

  // Validate and sanitize candidate structure
  for (const candidate of candidates) {
    if (!candidate.email || !candidate.name) {
      return apiError(
        "Validation failed",
        "Each candidate must have email and name",
        400
      );
    }
    // Sanitize candidate data
    candidate.email = await sanitizeForStorage(candidate.email);
    candidate.name = await sanitizeForStorage(candidate.name);
    if (candidate.studentId) {
      candidate.studentId = await sanitizeForStorage(candidate.studentId);
    }
  }

  const batchId = randomId();
  const sessionIds: string[] = [];

  // Create interview session for each candidate
  for (const candidate of candidates) {
    const sessionId = randomId();
    sessionIds.push(sessionId);

    const session: InterviewSession = {
      id: sessionId,
      mode: "college",
      createdAt: Date.now(),
      resumeText: "", // Will be filled when candidate starts
      jdText: template.jdText,
      status: "created",
      questions: [],
      currentQuestionIndex: 0,
      answers: [],
      evaluations: [],
      scoreSummary: {
        countEvaluated: 0,
        avg: { technical: 0, communication: 0, problemSolving: 0, overall: 0 },
      },
      jobSetup: {
        jdText: template.jdText,
        topSkills: template.topSkills,
        config: template.config,
      },
      collegeJobTemplateId: jobTemplateId,
      candidateEmail: candidate.email,
      candidateName: candidate.name,
      studentId: candidate.studentId,
      presence: {
        phrasePrompt: "I confirm this interview response is my own.",
      },
    };

    createSession(session);
  }

  const batch: CandidateBatch = {
    id: batchId,
    jobTemplateId,
    candidates: candidates.map((c: { email: string; name: string; studentId?: string }, i: number) => ({
      email: c.email,
      name: c.name,
      studentId: c.studentId,
      sessionId: sessionIds[i],
      status: "pending",
      linkSentAt: Date.now(),
    })),
    createdAt: Date.now(),
  };

  await createBatch(batch);

  await logAudit('batch_created', 'batch', batchId, {
    job_template_id: jobTemplateId,
    candidate_count: candidates.length,
  });

  return apiSuccess(
    {
      batchId,
      sessionIds,
      candidateLinks: candidates.map((c: { email: string; name: string; studentId?: string }, i: number) => ({
        email: c.email,
        name: c.name,
        link: `/interview/${sessionIds[i]}`,
      })),
    },
    "Batch created successfully",
    201
  );
}

