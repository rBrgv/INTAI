import { notFound } from "next/navigation";
import Container from "@/components/Container";
import Card from "@/components/Card";
import ReportView from "@/components/ReportView";
import { findSessionByShareToken } from "@/lib/sessionStore";

export default async function SharePage({
  params,
}: {
  params: { token: string };
}) {
  const session = findSessionByShareToken(params.token);

  if (!session || !session.report) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <Container>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Interview Report</h1>
          <p className="mt-1 text-sm text-slate-600">
            Shared interview evaluation report
          </p>
        </div>

        <Card variant="elevated">
          <ReportView
            report={session.report}
            scoreSummary={session.scoreSummary}
            context={{
              mode: session.mode,
              role: session.role,
              level: session.level,
            }}
            readOnly={true}
          />
        </Card>
      </Container>
    </main>
  );
}

