import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText, User } from "lucide-react";
import Container from "@/components/Container";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import { getSessionsByMode } from "@/lib/unifiedStore";

export default async function CompanyDashboardPage() {
  const sessions = await getSessionsByMode("company");
  
  // Sort by most recent first
  const sortedSessions = sessions.sort((a, b) => b.createdAt - a.createdAt);

  // Group by candidate if they have candidateEmail
  const sessionsByCandidate = sortedSessions.reduce((acc, session) => {
    const key = session.candidateEmail || session.candidateName || "Unknown";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(session);
    return acc;
  }, {} as Record<string, typeof sortedSessions>);

  return (
    <Container className="py-8">
      <div className="mb-6">
        <Link
          href="/mode"
          className="inline-flex items-center gap-2 text-[var(--muted)] hover:text-[var(--text)] transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Mode Selection
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text)]">Company Interview Dashboard</h1>
            <p className="text-[var(--muted)] mt-1">
              View and manage all company interview sessions
            </p>
          </div>
          <Link
            href="/company"
            className="app-btn-primary px-4 py-2 text-sm"
          >
            Create New Interview
          </Link>
        </div>
      </div>

      {sortedSessions.length === 0 ? (
        <Card className="app-card">
          <div className="text-center py-12">
            <p className="text-lg text-[var(--muted)] mb-4">No interviews yet</p>
            <p className="text-sm text-[var(--muted)] mb-6">
              Create your first interview to see it here.
            </p>
            <Link
              href="/company"
              className="app-btn-primary px-6 py-2.5 inline-flex items-center gap-2"
            >
              Create Interview
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="app-card">
              <div className="text-sm text-[var(--muted)] mb-1">Total Interviews</div>
              <div className="text-2xl font-semibold text-[var(--text)]">{sortedSessions.length}</div>
            </Card>
            <Card className="app-card">
              <div className="text-sm text-[var(--muted)] mb-1">Completed</div>
              <div className="text-2xl font-semibold text-[var(--success)]">
                {sortedSessions.filter(s => s.status === "completed").length}
              </div>
            </Card>
            <Card className="app-card">
              <div className="text-sm text-[var(--muted)] mb-1">In Progress</div>
              <div className="text-2xl font-semibold text-[var(--info)]">
                {sortedSessions.filter(s => s.status === "in_progress").length}
              </div>
            </Card>
          </div>

          {/* Sessions List */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--text)]">All Interviews</h2>
            {sortedSessions.map((session) => (
              <Card key={session.id} className="app-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-[var(--text)]">
                        {session.role || "Interview"} - {session.level || "N/A"}
                      </h3>
                      <Badge variant={session.status === "completed" ? "success" : session.status === "in_progress" ? "info" : "default"}>
                        {session.status.replace("_", " ")}
                      </Badge>
                      {session.report && (
                        <Badge variant="info" className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Report Available
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-[var(--muted)] space-y-1">
                      {(session.candidateName || session.candidateEmail) && (
                        <p className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {session.candidateName || session.candidateEmail}
                        </p>
                      )}
                      <p>Created: {new Date(session.createdAt).toLocaleString()}</p>
                      {session.scoreSummary && session.scoreSummary.countEvaluated > 0 && (
                        <p>
                          Overall Score: <span className="font-semibold text-[var(--text)]">{session.scoreSummary.avg.overall.toFixed(1)}/10</span>
                        </p>
                      )}
                      {session.questions && session.questions.length > 0 && (
                        <p>Questions: {session.questions.length}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Link
                      href={`/interview/${session.id}`}
                      className="app-btn-primary px-4 py-2 text-sm flex items-center gap-2"
                    >
                      View <ExternalLink className="w-4 h-4" />
                    </Link>
                    {session.shareToken && (
                      <Link
                        href={`/share/${session.shareToken}`}
                        className="app-btn-secondary px-4 py-2 text-sm"
                        target="_blank"
                      >
                        Share
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </Container>
  );
}

