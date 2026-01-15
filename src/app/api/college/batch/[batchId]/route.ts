import { NextResponse } from "next/server";
import { getBatch, getSessionsByIds } from "@/lib/unifiedStore";
import { apiSuccess, apiError } from "@/lib/apiResponse";

// Configure for production
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30; // Batch retrieval should be fast

export async function GET(
  _req: Request,
  { params }: { params: { batchId: string } }
) {
  try {
    const batch = await getBatch(params.batchId);
    
    if (!batch) {
      return apiError("Batch not found", "The requested batch does not exist", 404);
    }

    // Get live session statuses for all candidates
    const sessionIds = batch.candidates
      .map(c => c.sessionId)
      .filter((id): id is string => !!id);

    const sessions = await getSessionsByIds(sessionIds);

    // Create a map of sessionId -> session for quick lookup
    const sessionMap = new Map(sessions.map(s => [s.id, s]));

    // Enrich candidates with live status from sessions
    const enrichedCandidates = batch.candidates.map(candidate => {
      const session = candidate.sessionId ? sessionMap.get(candidate.sessionId) : null;
      
      // Get completion time from last answer if session is completed
      const completedAt = session?.status === 'completed' && session.answers.length > 0
        ? session.answers[session.answers.length - 1]?.submittedAt
        : candidate.completedAt;
      
      return {
        ...candidate,
        // Use live status from session if available, otherwise use batch status
        status: session?.status || candidate.status || 'pending',
        // Get score if session is completed
        score: session?.status === 'completed' ? session.scoreSummary?.avg?.overall : undefined,
        // Get completion time from last answer or candidate data
        completedAt,
        // Get report if available
        hasReport: !!session?.report,
        shareToken: session?.shareToken,
      };
    });

    // Calculate statistics
    const stats = {
      total: enrichedCandidates.length,
      pending: enrichedCandidates.filter(c => c.status === 'created' || c.status === 'pending').length,
      inProgress: enrichedCandidates.filter(c => c.status === 'in_progress').length,
      completed: enrichedCandidates.filter(c => c.status === 'completed').length,
      averageScore: enrichedCandidates
        .filter(c => c.score !== undefined)
        .reduce((sum, c) => sum + (c.score || 0), 0) / enrichedCandidates.filter(c => c.score !== undefined).length || 0,
    };

    return apiSuccess({
      batch: {
        ...batch,
        candidates: enrichedCandidates,
      },
      stats,
    });
  } catch (error) {
    return apiError(
      "Internal server error",
      error instanceof Error ? error.message : "An unexpected error occurred",
      500
    );
  }
}

