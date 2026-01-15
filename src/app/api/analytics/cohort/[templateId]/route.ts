import { NextResponse } from "next/server";
import { getTemplate, getBatchesByTemplate, getSessionsByIds } from "@/lib/unifiedStore";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// Configure for production
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30; // Analytics should be fast

export async function GET(
  _req: Request,
  { params }: { params: { templateId: string } }
) {
  try {
    const template = await getTemplate(params.templateId);
    if (!template) {
      return apiError("Template not found", "The requested template does not exist", 404);
    }

    const batches = await getBatchesByTemplate(params.templateId);
    const allSessionIds = batches.flatMap(batch => 
      batch.candidates
        .map(c => c.sessionId)
        .filter((id): id is string => !!id)
    );

    const sessions = await getSessionsByIds(allSessionIds);

    // Calculate cohort analytics
    const totalCandidates = batches.reduce((sum, batch) => sum + batch.candidates.length, 0);
    const completedSessions = sessions.filter(s => s.status === "completed");
    const inProgressSessions = sessions.filter(s => s.status === "in_progress");
    const pendingSessions = sessions.filter(s => s.status === "created");

    // Score distribution
    const scores = completedSessions
      .map(s => s.scoreSummary?.avg?.overall ?? 0)
      .filter(score => score > 0);

    const avgScore = scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;

    const scoreDistribution = {
      excellent: scores.filter(s => s >= 8).length,
      good: scores.filter(s => s >= 6 && s < 8).length,
      average: scores.filter(s => s >= 4 && s < 6).length,
      belowAverage: scores.filter(s => s < 4).length,
    };

    // Tab switch analytics
    const tabSwitchData = completedSessions.map(s => ({
      sessionId: s.id,
      tabSwitchCount: s.tabSwitchCount || 0,
      hasMultipleSwitches: (s.tabSwitchCount || 0) > 3,
    }));

    const flaggedSessions = tabSwitchData.filter(d => d.hasMultipleSwitches).length;
    const avgTabSwitches = tabSwitchData.length > 0
      ? tabSwitchData.reduce((sum, d) => sum + d.tabSwitchCount, 0) / tabSwitchData.length
      : 0;

    // Time analytics (if we have completion times)
    const completionTimes = completedSessions
      .map(s => {
        // Estimate completion time from answers
        if (s.answers.length === 0) return null;
        const firstAnswer = s.answers[0];
        const lastAnswer = s.answers[s.answers.length - 1];
        if (!firstAnswer || !lastAnswer) return null;
        return (lastAnswer.submittedAt - firstAnswer.submittedAt) / 1000 / 60; // minutes
      })
      .filter((time): time is number => time !== null);

    const avgCompletionTime = completionTimes.length > 0
      ? completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length
      : 0;

    // Skill-based performance (if available)
    // Note: Skills are extracted from evaluations if available
    const skillPerformance: Record<string, { count: number; avgScore: number }> = {};
    // For now, we'll skip skill performance as it requires evaluation structure
    // This can be enhanced later when evaluation structure is finalized

    // Normalize skill performance
    Object.keys(skillPerformance).forEach(skill => {
      const perf = skillPerformance[skill];
      if (perf.count > 0) {
        perf.avgScore = perf.avgScore / perf.count;
      }
    });

    // Recommendation distribution
    const recommendations = completedSessions
      .map(s => s.report?.recommendation)
      .filter((rec): rec is "strong_hire" | "hire" | "borderline" | "no_hire" => 
        rec === "strong_hire" || rec === "hire" || rec === "borderline" || rec === "no_hire"
      );

    const recommendationDistribution = {
      strong_hire: recommendations.filter(r => r === "strong_hire").length,
      hire: recommendations.filter(r => r === "hire").length,
      borderline: recommendations.filter(r => r === "borderline").length,
      no_hire: recommendations.filter(r => r === "no_hire").length,
    };

    // Timeline data (sessions over time)
    const timelineData = batches.map(batch => ({
      date: new Date(batch.createdAt).toISOString().split('T')[0],
      batchId: batch.id,
      candidates: batch.candidates.length,
      completed: batch.candidates.filter(c => {
        const session = sessions.find(s => s.id === c.sessionId);
        return session?.status === "completed";
      }).length,
    }));

    return NextResponse.json({
      templateId: params.templateId,
      summary: {
        totalCandidates,
        completed: completedSessions.length,
        inProgress: inProgressSessions.length,
        pending: pendingSessions.length,
        completionRate: totalCandidates > 0 
          ? (completedSessions.length / totalCandidates) * 100 
          : 0,
      },
      scores: {
        average: avgScore,
        distribution: scoreDistribution,
        min: scores.length > 0 ? Math.min(...scores) : 0,
        max: scores.length > 0 ? Math.max(...scores) : 0,
      },
      tabSwitches: {
        average: avgTabSwitches,
        flagged: flaggedSessions,
        flaggedPercentage: completedSessions.length > 0
          ? (flaggedSessions / completedSessions.length) * 100
          : 0,
      },
      timing: {
        averageCompletionMinutes: avgCompletionTime,
        totalSessions: completedSessions.length,
      },
      skills: skillPerformance,
      recommendations: recommendationDistribution,
      timeline: timelineData,
    });
  } catch (error) {
    logger.error("Analytics error", error instanceof Error ? error : new Error(String(error)), { templateId: params.templateId });
    return apiError(
      "Failed to generate analytics",
      error instanceof Error ? error.message : "An unexpected error occurred",
      500
    );
  }
}

