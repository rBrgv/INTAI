import { NextRequest } from "next/server";
import { createBatch, getTemplate, createSession, logAudit, getBatchesByTemplate } from "@/lib/unifiedStore";
import { CandidateBatch, InterviewSession } from "@/lib/types";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { sanitizeForStorage } from "@/lib/sanitize";
import { requireAuthAPI } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { logger } from "@/lib/logger";

function randomId() {
  return crypto.randomUUID();
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuthAPI(req);

    const body = await req.json().catch(() => null);
    if (!body) {
      return apiError("Invalid JSON", "Request body must be valid JSON", 400);
    }

    const jobTemplateId = String(body.jobTemplateId ?? "");
    const template = await getTemplate(jobTemplateId);
    if (!template) {
      return apiError("Template not found", "The requested job template does not exist", 404);
    }

    // Verify template belongs to college
    if (template.collegeId && template.collegeId !== session.collegeId) {
      // Fallback: Allow if created by the same user (handles potential ID synch issues)
      if (template.createdBy !== session.userEmail) {
        return apiError("Forbidden", "You don't have access to this template", 403);
      }
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
      candidate.email = sanitizeForStorage(candidate.email);
      candidate.name = sanitizeForStorage(candidate.name);
      if (candidate.studentId) {
        candidate.studentId = sanitizeForStorage(candidate.studentId);
      }
    }

    const batchId = randomId();
    const sessionIds: string[] = [];

    // Create interview session for each candidate
    for (const candidate of candidates) {
      const sessionId = randomId();
      sessionIds.push(sessionId);

      const newSession: InterviewSession = {
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
        collegeName: session.collegeName,
      };

      createSession(newSession);
    }

    const batch: CandidateBatch = {
      id: batchId,
      jobTemplateId,
      collegeId: session.collegeId,
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
      college_id: session.collegeId,
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
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return apiError("Unauthorized", "Please log in to access this resource", 401);
    }
    return apiError("Internal server error", error instanceof Error ? error.message : "An unexpected error occurred", 500);
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = requireAuthAPI(req);

    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get("templateId");

    if (!templateId) {
      return apiError("Missing parameter", "templateId is required", 400);
    }

    // Verify template belongs to college
    const template = await getTemplate(templateId);
    if (!template) {
      return apiError("Template not found", "The requested template does not exist", 404);
    }
    if (template.collegeId && template.collegeId !== session.collegeId) {
      return apiError("Forbidden", "You don't have access to this template", 403);
    }

    // Fetch batches filtered by college_id
    if (isSupabaseConfigured() && supabase) {
      const { data: batchesData, error: batchesError } = await supabase
        .from('candidate_batches')
        .select('*')
        .eq('job_template_id', templateId)
        .eq('college_id', session.collegeId)
        .order('created_at', { ascending: false });

      if (batchesError) {
        // Fallback to unified store
        const allBatches = await getBatchesByTemplate(templateId);
        const filtered = allBatches.filter(b => b.collegeId === session.collegeId);
        return apiSuccess({ batches: filtered });
      }

      // Get candidates for each batch from batch_candidates table
      const mappedBatches: CandidateBatch[] = [];
      for (const batch of batchesData || []) {
        const { data: candidatesData, error: candidatesError } = await supabase
          .from('batch_candidates')
          .select('*')
          .eq('batch_id', batch.id);

        if (candidatesError) {
          logger.error('Error fetching batch candidates', candidatesError instanceof Error ? candidatesError : new Error(String(candidatesError)), { batchId: batch.id });
          // Continue with empty candidates array
        }

        mappedBatches.push({
          id: batch.id,
          jobTemplateId: batch.job_template_id,
          collegeId: batch.college_id,
          candidates: (candidatesData || []).map((c: any) => ({
            email: c.email,
            name: c.name,
            studentId: c.student_id || undefined,
            sessionId: c.session_id || undefined,
            status: c.status || 'pending',
            completedAt: c.completed_at ? new Date(c.completed_at).getTime() : undefined,
            linkSentAt: c.link_sent_at ? new Date(c.link_sent_at).getTime() : undefined,
          })),
          createdAt: new Date(batch.created_at).getTime(),
        });
      }

      return apiSuccess({ batches: mappedBatches, template });
    }

    // Fallback to unified store
    const allBatches = await getBatchesByTemplate(templateId);
    const filtered = allBatches.filter(b => b.collegeId === session.collegeId);
    return apiSuccess({ batches: filtered, template });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return apiError("Unauthorized", "Please log in to access this resource", 401);
    }
    return apiError(
      "Failed to fetch batches",
      error instanceof Error ? error.message : "An unexpected error occurred",
      500
    );
  }
}

