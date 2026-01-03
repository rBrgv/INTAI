import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import Container from "@/components/Container";
import Card from "@/components/Card";
import SectionTitle from "@/components/SectionTitle";
import Badge from "@/components/Badge";
import { getAllTemplates, getBatchesByTemplate } from "@/lib/unifiedStore";

export default async function CollegeDashboardPage() {
  const templates = await getAllTemplates();

  // Get stats for each template
  const templatesWithStats = await Promise.all(
    templates.map(async (template) => {
      const batches = await getBatchesByTemplate(template.id);
      const totalCandidates = batches.reduce((sum, batch) => sum + batch.candidates.length, 0);
      const completedCandidates = batches.reduce(
        (sum, batch) => sum + batch.candidates.filter(c => c.status === "completed").length,
        0
      );
      return {
        ...template,
        totalCandidates,
        completedCandidates,
        pendingCandidates: totalCandidates - completedCandidates,
      };
    })
  );

  return (
    <Container className="py-8">
      <div className="flex items-center justify-between mb-6">
        <SectionTitle title="College Dashboard" />
        <Link
          href="/college"
          className="app-btn-primary px-4 py-2 text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create New Template
        </Link>
      </div>

      {templatesWithStats.length === 0 ? (
        <Card className="app-card">
          <div className="text-center py-12">
            <p className="text-lg text-[var(--muted)] mb-4">No templates yet</p>
            <p className="text-sm text-[var(--muted)] mb-6">
              Create your first job template to start sending interview links to candidates.
            </p>
            <Link
              href="/college"
              className="app-btn-primary px-6 py-2.5 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Template
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templatesWithStats.map((template) => (
            <Link
              key={template.id}
              href={`/college/dashboard/${template.id}`}
              className="group block"
            >
              <Card className="h-full flex flex-col transition-all duration-200 group-hover:shadow-lg group-hover:border-[var(--primary)]">
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-[var(--text)] line-clamp-2">
                      {template.topSkills.slice(0, 3).join(", ")}
                      {template.topSkills.length > 3 && "..."}
                    </h3>
                    <Badge variant="info" className="ml-2 flex-shrink-0">
                      {template.config.questionCount} Q
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted)]">Total Candidates:</span>
                      <span className="font-medium text-[var(--text)]">{template.totalCandidates}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted)]">Completed:</span>
                      <span className="font-medium text-[var(--success)]">{template.completedCandidates}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted)]">Pending:</span>
                      <span className="font-medium text-[var(--warning)]">{template.pendingCandidates}</span>
                    </div>
                  </div>

                  <div className="text-xs text-[var(--muted)] mb-4">
                    <div>
                      <span className="font-medium">Skills:</span> {template.topSkills.slice(0, 3).join(", ")}
                      {template.topSkills.length > 3 && ` +${template.topSkills.length - 3} more`}
                    </div>
                    <div className="mt-1">
                      <span className="font-medium">Difficulty:</span> {template.config.difficultyCurve.replace("_", " ")}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
                  <span className="text-xs text-[var(--muted)]">
                    {new Date(template.createdAt).toLocaleDateString()}
                  </span>
                  <span className="inline-flex items-center text-[var(--primary)] font-medium text-sm gap-1">
                    View Dashboard <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}

