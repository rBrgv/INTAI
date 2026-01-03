"use client";

import { useEffect, useState } from "react";
import Card from "./Card";
import Badge from "./Badge";

type AnalyticsData = {
  templateId: string;
  summary: {
    totalCandidates: number;
    completed: number;
    inProgress: number;
    pending: number;
    completionRate: number;
  };
  scores: {
    average: number;
    distribution: {
      excellent: number;
      good: number;
      average: number;
      belowAverage: number;
    };
    min: number;
    max: number;
  };
  tabSwitches: {
    average: number;
    flagged: number;
    flaggedPercentage: number;
  };
  timing: {
    averageCompletionMinutes: number;
    totalSessions: number;
  };
  skills: Record<string, { count: number; avgScore: number }>;
  recommendations: {
    strong_hire: number;
    hire: number;
    borderline: number;
    no_hire: number;
  };
  timeline: Array<{
    date: string;
    batchId: string;
    candidates: number;
    completed: number;
  }>;
};

type CohortAnalyticsProps = {
  templateId: string;
};

export default function CohortAnalytics({ templateId }: CohortAnalyticsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch(`/api/analytics/cohort/${templateId}`);
        if (!res.ok) {
          throw new Error("Failed to fetch analytics");
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [templateId]);

  if (loading) {
    return (
      <Card className="app-card">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
          <p className="text-sm text-[var(--muted)] mt-2">Loading analytics...</p>
        </div>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="app-card">
        <div className="text-center py-8">
          <p className="text-sm text-[var(--danger)]">{error || "No data available"}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Score Distribution */}
      <Card className="app-card">
        <h3 className="text-lg font-semibold text-[var(--text)] mb-4">Score Distribution</h3>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[var(--text)]">Average Score</span>
              <span className="text-2xl font-bold text-[var(--primary)]">
                {data.scores.average.toFixed(1)}/10
              </span>
            </div>
            <div className="text-xs text-[var(--muted)]">
              Range: {data.scores.min.toFixed(1)} - {data.scores.max.toFixed(1)}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{data.scores.distribution.excellent}</div>
              <div className="text-xs text-[var(--muted)]">Excellent (8+)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{data.scores.distribution.good}</div>
              <div className="text-xs text-[var(--muted)]">Good (6-8)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{data.scores.distribution.average}</div>
              <div className="text-xs text-[var(--muted)]">Average (4-6)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{data.scores.distribution.belowAverage}</div>
              <div className="text-xs text-[var(--muted)]">Below (0-4)</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Anti-Cheating Signals */}
      <Card className="app-card">
        <h3 className="text-lg font-semibold text-[var(--text)] mb-4">Anti-Cheating Signals</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text)]">Average Tab Switches</span>
            <span className="text-lg font-semibold">{data.tabSwitches.average.toFixed(1)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text)]">Flagged Sessions</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-[var(--danger)]">
                {data.tabSwitches.flagged}
              </span>
              <Badge variant={data.tabSwitches.flaggedPercentage > 20 ? "error" : "warning"}>
                {data.tabSwitches.flaggedPercentage.toFixed(1)}%
              </Badge>
            </div>
          </div>
          {data.tabSwitches.flagged > 0 && (
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
              ⚠️ {data.tabSwitches.flagged} session{data.tabSwitches.flagged > 1 ? "s" : ""} flagged for multiple tab switches (&gt;3)
            </div>
          )}
        </div>
      </Card>

      {/* Recommendations */}
      <Card className="app-card">
        <h3 className="text-lg font-semibold text-[var(--text)] mb-4">Hiring Recommendations</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-green-50 rounded">
            <div className="text-2xl font-bold text-green-700">{data.recommendations.strong_hire}</div>
            <div className="text-xs text-green-600 mt-1">Strong Hire</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded">
            <div className="text-2xl font-bold text-blue-700">{data.recommendations.hire}</div>
            <div className="text-xs text-blue-600 mt-1">Hire</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded">
            <div className="text-2xl font-bold text-yellow-700">{data.recommendations.borderline}</div>
            <div className="text-xs text-yellow-600 mt-1">Borderline</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded">
            <div className="text-2xl font-bold text-red-700">{data.recommendations.no_hire}</div>
            <div className="text-xs text-red-600 mt-1">No Hire</div>
          </div>
        </div>
      </Card>

      {/* Performance Metrics */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="app-card">
          <h3 className="text-lg font-semibold text-[var(--text)] mb-4">Completion Metrics</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text)]">Completion Rate</span>
              <span className="text-lg font-semibold text-[var(--primary)]">
                {data.summary.completionRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text)]">Avg Completion Time</span>
              <span className="text-lg font-semibold">
                {data.timing.averageCompletionMinutes > 0
                  ? `${data.timing.averageCompletionMinutes.toFixed(1)} min`
                  : "N/A"}
              </span>
            </div>
          </div>
        </Card>

        {Object.keys(data.skills).length > 0 && (
          <Card className="app-card">
            <h3 className="text-lg font-semibold text-[var(--text)] mb-4">Skill Performance</h3>
            <div className="space-y-2">
              {Object.entries(data.skills)
                .sort((a, b) => b[1].avgScore - a[1].avgScore)
                .slice(0, 5)
                .map(([skill, perf]) => (
                  <div key={skill} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text)]">{skill}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-[var(--primary)] h-2 rounded-full"
                          style={{ width: `${(perf.avgScore / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">
                        {perf.avgScore.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

