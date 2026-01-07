import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import Container from "@/components/Container";
import Card from "@/components/Card";
import SectionTitle from "@/components/SectionTitle";
import Badge from "@/components/Badge";
import CohortAnalytics from "@/components/CohortAnalytics";
import { getTemplate, getBatchesByTemplate, getSessionsByIds, getSessionsByTemplate } from "@/lib/unifiedStore";

export default async function CollegeDashboardPage({
  params,
}: {
  params: { templateId: string };
}) {
  const template = await getTemplate(params.templateId);
  if (!template) {
    notFound();
  }

  const batches = await getBatchesByTemplate(params.templateId);
  const totalCandidates = batches.reduce((sum, batch) => sum + batch.candidates.length, 0);
  const completedCandidates = batches.reduce(
    (sum, batch) => sum + batch.candidates.filter(c => c.status === "completed").length,
    0
  );
  
  // Get all interview sessions for this template
  const allSessions = await getSessionsByTemplate(params.templateId);
  const sortedSessions = allSessions.sort((a, b) => b.createdAt - a.createdAt);

  return (
    <Container className="py-8">
      <div className="mb-6">
        <Link
          href="/college/dashboard"
          className="inline-flex items-center gap-2 text-[var(--muted)] hover:text-[var(--text)] transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Templates</span>
        </Link>
      </div>
      <SectionTitle title="Template Dashboard" />
      <p className="mt-2 text-[var(--muted)] mb-6">
        Template ID: {params.templateId}
      </p>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card className="app-card">
          <h3 className="text-lg font-semibold text-[var(--text)] mb-2">Total Candidates</h3>
          <p className="text-3xl font-bold text-[var(--primary)]">{totalCandidates}</p>
        </Card>
        <Card className="app-card">
          <h3 className="text-lg font-semibold text-[var(--text)] mb-2">Completed</h3>
          <p className="text-3xl font-bold text-[var(--success)]">{completedCandidates}</p>
        </Card>
        <Card className="app-card">
          <h3 className="text-lg font-semibold text-[var(--text)] mb-2">Pending</h3>
          <p className="text-3xl font-bold text-[var(--warning)]">{totalCandidates - completedCandidates}</p>
        </Card>
      </div>

      <Card className="app-card">
        <h3 className="text-lg font-semibold text-[var(--text)] mb-4">Job Template Details</h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium text-[var(--text)]">Questions:</span>{" "}
            <span className="text-[var(--muted)]">{template.config.questionCount}</span>
          </div>
          <div>
            <span className="font-medium text-[var(--text)]">Skills:</span>{" "}
            <span className="text-[var(--muted)]">{template.topSkills.join(", ")}</span>
          </div>
          <div>
            <span className="font-medium text-[var(--text)]">Difficulty:</span>{" "}
            <span className="text-[var(--muted)]">{template.config.difficultyCurve.replace("_", " ")}</span>
          </div>
        </div>
      </Card>

      <Card className="app-card mt-6">
        <h3 className="text-lg font-semibold text-[var(--text)] mb-4">All Candidates</h3>
        {batches.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No candidates yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-3 px-4 font-semibold text-[var(--text)]">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--text)]">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--text)]">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--text)]">Score</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--text)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(await Promise.all(
                  batches.map(async (batch) => {
                    const sessionIds = batch.candidates
                      .map(c => c.sessionId)
                      .filter((id): id is string => !!id);
                    const sessions = await getSessionsByIds(sessionIds);
                    const sessionMap = new Map(sessions.map(s => [s.id, s]));
                    
                    return batch.candidates.map((candidate) => {
                      const session = candidate.sessionId ? sessionMap.get(candidate.sessionId) : null;
                      const hasReport = session?.report !== undefined;
                      const overallScore = session?.scoreSummary?.avg?.overall ?? 0;
                      
                      return (
                        <tr key={candidate.email} className="border-b border-[var(--border)] hover:bg-[var(--card)]">
                          <td className="py-3 px-4">{candidate.name}</td>
                          <td className="py-3 px-4 text-[var(--muted)]">{candidate.email}</td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={
                                candidate.status === "completed"
                                  ? "success"
                                  : candidate.status === "in_progress"
                                  ? "info"
                                  : "default"
                              }
                            >
                              {candidate.status || "pending"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {hasReport ? (
                              <span className="font-medium">{overallScore.toFixed(1)}</span>
                            ) : (
                              <span className="text-[var(--muted)]">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {session?.tabSwitchCount !== undefined ? (
                              <div className="flex items-center gap-2">
                                <span className={session.tabSwitchCount > 3 ? "text-[var(--danger)] font-medium" : ""}>
                                  {session.tabSwitchCount}
                                </span>
                                {session.tabSwitchCount > 3 && (
                                  <Badge variant="error" className="text-xs">Flagged</Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-[var(--muted)]">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              {candidate.sessionId && (
                                <>
                                  <Link
                                    href={`/interview/${candidate.sessionId}?view=recruiter`}
                                    className="text-xs text-[var(--primary)] hover:underline"
                                  >
                                    {hasReport ? "View Report" : "View Session"}
                                  </Link>
                                  {session?.shareToken && (
                                    <Link
                                      href={`/share/${session.shareToken}`}
                                      className="text-xs text-[var(--muted)] hover:underline"
                                      target="_blank"
                                    >
                                      Share Link
                                    </Link>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })
                )).flat()}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* All Interview Sessions */}
      <Card className="app-card mt-6">
        <h3 className="text-lg font-semibold text-[var(--text)] mb-4">All Interview Sessions</h3>
        {sortedSessions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No interview sessions yet.</p>
        ) : (
          <div className="space-y-3">
            {sortedSessions.map((session) => (
              <div key={session.id} className="flex items-start justify-between gap-4 p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--card)] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h4 className="font-medium text-[var(--text)]">
                      {session.candidateName || session.candidateEmail || "Unknown Candidate"}
                    </h4>
                    <Badge variant={session.status === "completed" ? "success" : session.status === "in_progress" ? "info" : "default"}>
                      {session.status.replace("_", " ")}
                    </Badge>
                    {session.report && (
                      <Badge variant="info" className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        Report
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-[var(--muted)] space-y-1">
                    {session.candidateEmail && <p>Email: {session.candidateEmail}</p>}
                    {session.studentId && <p>Student ID: {session.studentId}</p>}
                    <p>Created: {new Date(session.createdAt).toLocaleString()}</p>
                    {session.scoreSummary && session.scoreSummary.countEvaluated > 0 && (
                      <p>
                        Score: <span className="font-semibold text-[var(--text)]">{session.scoreSummary.avg.overall.toFixed(1)}/10</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Link
                    href={`/interview/${session.id}?view=recruiter`}
                    className="app-btn-primary px-3 py-1.5 text-sm flex items-center gap-1"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </Link>
                  {session.shareToken && (
                    <Link
                      href={`/share/${session.shareToken}`}
                      className="app-btn-secondary px-3 py-1.5 text-sm"
                      target="_blank"
                    >
                      Share
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Cohort Analytics */}
      <div className="mt-8">
        <SectionTitle title="Cohort Analytics" />
        <CohortAnalytics templateId={params.templateId} />
      </div>
    </Container>
  );
}

