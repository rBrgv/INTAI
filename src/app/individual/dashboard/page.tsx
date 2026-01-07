import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import Container from "@/components/Container";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import { getSessionsByMode } from "@/lib/unifiedStore";

export default async function IndividualDashboardPage() {
  const sessions = await getSessionsByMode("individual");
  
  // Sort by most recent first
  const sortedSessions = sessions.sort((a, b) => b.createdAt - a.createdAt);

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
        <h1 className="text-2xl font-semibold text-[var(--text)]">My Interview History</h1>
        <p className="text-[var(--muted)] mt-1">
          View and access your past interview sessions
        </p>
      </div>

      {sortedSessions.length === 0 ? (
        <Card className="app-card">
          <div className="text-center py-12">
            <p className="text-lg text-[var(--muted)] mb-4">No interviews yet</p>
            <p className="text-sm text-[var(--muted)] mb-6">
              Start your first interview to see it here.
            </p>
            <Link
              href="/individual"
              className="app-btn-primary px-6 py-2.5 inline-flex items-center gap-2"
            >
              Start Interview
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
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
      )}
    </Container>
  );
}

