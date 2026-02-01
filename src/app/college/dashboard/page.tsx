"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, ExternalLink, Users, FileText, LogOut, User, Copy, CheckCircle2, Clock, Edit, Trash2, Send, ChevronDown, ChevronUp } from "lucide-react";
import Card from "@/components/Card";
import Container from "@/components/Container";
import Badge from "@/components/Badge";
import Skeleton from "@/components/Skeleton";
import QuickStats from "@/components/QuickStats";

type Template = {
  id: string;
  jdText: string;
  topSkills: string[];
  config: {
    questionCount: number;
    difficultyCurve: string;
  };
  createdAt: number;
};

type Session = {
  collegeId: string;
  collegeName: string;
  userEmail: string;
  userId: string;
  role: 'admin' | 'viewer';
};

export default function CollegeDashboardPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({
    totalCandidates: 0,
    completedCandidates: 0,
    inProgressCandidates: 0,
    pendingCandidates: 0,
  });

  // Extract job title from JD text (first line or first 60 chars)
  const extractJobTitle = (jdText: string): string => {
    const firstLine = jdText.split('\n')[0].trim();
    if (firstLine.length > 0 && firstLine.length < 100) {
      return firstLine;
    }
    return jdText.substring(0, 60).trim() + '...';
  };

  // Group templates by job title
  const groupedTemplates = templates.reduce((acc, template) => {
    const jobTitle = extractJobTitle(template.jdText);
    if (!acc[jobTitle]) {
      acc[jobTitle] = [];
    }
    acc[jobTitle].push(template);
    return acc;
  }, {} as Record<string, Template[]>);

  const toggleGroup = (jobTitle: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(jobTitle)) {
      newExpanded.delete(jobTitle);
    } else {
      newExpanded.add(jobTitle);
    }
    setExpandedGroups(newExpanded);
  };

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/college/auth/session");
        const data = await res.json();
        if (!res.ok || !data.data?.session) {
          router.push("/college/login?redirect=/college/dashboard");
          return;
        }
        setSession(data.data.session);
      } catch (err) {
        router.push("/college/login?redirect=/college/dashboard");
      }
    }
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!session) return;

    async function fetchTemplates() {
      try {
        const res = await fetch("/api/college/templates");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || data.message || "Failed to fetch templates");
        }
        const templatesData = data.data?.templates || data.templates || [];
        setTemplates(templatesData);

        // Fetch stats for all templates
        let totalCandidates = 0;
        let completedCandidates = 0;
        let inProgressCandidates = 0;
        let pendingCandidates = 0;

        for (const template of templatesData) {
          try {
            const batchesRes = await fetch(`/api/college/batch?templateId=${template.id}`);
            const batchesData = await batchesRes.json();
            if (batchesRes.ok) {
              const batches = batchesData.data?.batches || batchesData.batches || [];
              batches.forEach((batch: any) => {
                if (batch.candidates) {
                  batch.candidates.forEach((c: any) => {
                    totalCandidates++;
                    const status = c.status || "pending";
                    if (status === "completed") completedCandidates++;
                    else if (status === "in_progress") inProgressCandidates++;
                    else pendingCandidates++;
                  });
                }
              });
            }
          } catch (err) {
            // Skip failed template stats
          }
        }

        setStats({
          totalCandidates,
          completedCandidates,
          inProgressCandidates,
          pendingCandidates,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load templates");
      } finally {
        setLoading(false);
      }
    }
    fetchTemplates();
  }, [session]);

  const handleLogout = async () => {
    try {
      await fetch("/api/college/auth/logout", { method: "POST" });
      router.push("/college/login");
      router.refresh();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (!session || loading) {
    return (
      <Container className="py-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32" variant="rectangular" />
          <Skeleton className="h-32" variant="rectangular" />
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] shadow-lg shadow-[var(--primary-glow)]">
            <User className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[var(--text)] to-[var(--text-secondary)] bg-clip-text text-transparent">
              College Dashboard
            </h1>
            <p className="text-sm text-[var(--muted)] mt-1 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-[var(--success)] rounded-full animate-pulse"></span>
              {session?.collegeName || "Loading..."}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link
            href="/college"
            className="app-btn-primary px-5 py-2.5 flex items-center gap-2 hover:scale-105 transition-transform"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </Link>
          <Link
            href="/college/students"
            className="app-btn-secondary px-5 py-2.5 flex items-center gap-2 hover:scale-105 transition-transform"
          >
            <Users className="w-4 h-4" />
            Manage Students
          </Link>
          <button
            onClick={handleLogout}
            className="app-btn-secondary px-4 py-2.5 hover:scale-105 transition-transform"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <Card className="app-card mb-6">
          <div className="rounded-lg bg-[var(--danger-bg)] border border-[var(--danger)] p-4">
            <p className="text-sm text-[var(--danger)]">{error}</p>
          </div>
        </Card>
      )}

      {/* Quick Stats */}
      {templates.length > 0 && !loading && (
        <QuickStats
          stats={[
            {
              label: "Total Templates",
              value: templates.length,
              icon: <FileText className="w-6 h-6" />,
              color: "blue",
            },
            {
              label: "Total Candidates",
              value: stats.totalCandidates,
              icon: <Users className="w-6 h-6" />,
              color: "purple",
            },
            {
              label: "Completed",
              value: stats.completedCandidates,
              icon: <CheckCircle2 className="w-6 h-6" />,
              color: "green",
              trend: stats.totalCandidates > 0
                ? `${Math.round((stats.completedCandidates / stats.totalCandidates) * 100)}% completion rate`
                : undefined,
            },
            {
              label: "In Progress",
              value: stats.inProgressCandidates,
              icon: <Clock className="w-6 h-6" />,
              color: "yellow",
            },
          ]}
        />
      )}

      {templates.length === 0 ? (
        <Card className="app-card">
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-[var(--muted)] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[var(--text)] mb-2">No templates yet</h3>
            <p className="text-sm text-[var(--muted)] mb-6">
              Create your first job template to start managing candidate interviews
            </p>
            <Link href="/college" className="app-btn-primary px-6 py-2.5 inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Template
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-8">
          {Object.entries(groupedTemplates).map(([jobTitle, groupTemplates]) => {
            const isExpanded = expandedGroups.has(jobTitle);
            const primaryTemplate = groupTemplates[0];
            const variationCount = groupTemplates.length;

            return (
              <Card key={jobTitle} className="app-card hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border border-[var(--border)] hover:border-[var(--primary)] p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-[var(--text)] mb-2 line-clamp-2">
                      {jobTitle}
                    </h3>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-[var(--muted)]">
                        Created {formatDate(primaryTemplate.createdAt)}
                      </p>
                      {variationCount > 1 && (
                        <Badge variant="info" className="text-xs">
                          {variationCount} variations
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div>
                    <p className="text-xs font-medium text-[var(--muted)] mb-1">Skills</p>
                    <div className="flex flex-wrap gap-1">
                      {primaryTemplate.topSkills.slice(0, 3).map((skill, i) => (
                        <Badge key={i} variant="default" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {primaryTemplate.topSkills.length > 3 && (
                        <Badge variant="default" className="text-xs">
                          +{primaryTemplate.topSkills.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      <span>{primaryTemplate.config.questionCount} questions</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{primaryTemplate.config.difficultyCurve.replace("_", " ")}</span>
                    </div>
                  </div>
                </div>

                {/* Expandable Variations Table */}
                {variationCount > 1 && (
                  <div className="mb-4">
                    <button
                      onClick={() => toggleGroup(jobTitle)}
                      className="w-full flex items-center justify-between text-sm text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors py-2"
                    >
                      <span className="font-medium">
                        {isExpanded ? 'Hide' : 'View'} {variationCount} variations
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-3 rounded-lg border border-[var(--border)] overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-[var(--bg)] border-b border-[var(--border)]">
                            <tr>
                              <th className="px-3 py-2.5 text-left text-[var(--muted)] font-medium whitespace-nowrap">Questions</th>
                              <th className="px-3 py-2.5 text-left text-[var(--muted)] font-medium whitespace-nowrap">Difficulty</th>
                              <th className="px-3 py-2.5 text-left text-[var(--muted)] font-medium whitespace-nowrap">Created</th>
                              <th className="px-3 py-2.5 text-center text-[var(--muted)] font-medium whitespace-nowrap">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupTemplates.map((template, idx) => (
                              <tr key={template.id} className={`border-b border-[var(--border)] hover:bg-[var(--card-hover)] transition-colors ${idx % 2 === 0 ? 'bg-[var(--card)]' : 'bg-[var(--bg)]'}`}>
                                <td className="px-3 py-2.5 text-[var(--text)] whitespace-nowrap">{template.config.questionCount}</td>
                                <td className="px-3 py-2.5 text-[var(--text)] whitespace-nowrap">
                                  <Badge variant="default" className="text-xs">
                                    {template.config.difficultyCurve.replace("_", " ")}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2.5 text-[var(--muted)] whitespace-nowrap text-xs">
                                  {formatDate(template.createdAt)}
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="flex gap-2 justify-center">
                                    <Link
                                      href={`/college/dashboard/${template.id}`}
                                      className="p-1.5 rounded hover:bg-[var(--primary-bg)] text-[var(--primary)] hover:text-[var(--primary-hover)] transition-all"
                                      title="View Dashboard"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </Link>
                                    <Link
                                      href={`/college/templates/${template.id}/edit`}
                                      className="p-1.5 rounded hover:bg-[var(--card-hover)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-all"
                                      title="Edit"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </Link>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Primary Actions */}
                <div className="space-y-3">
                  {/* Primary Action */}
                  <Link
                    href={`/college/dashboard/${primaryTemplate.id}`}
                    className="app-btn-primary w-full px-4 py-2.5 text-sm flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Dashboard
                  </Link>

                  {/* Secondary Actions Grid */}
                  <div className="grid grid-cols-4 gap-2">
                    <Link
                      href={`/college/dashboard/${primaryTemplate.id}?tab=send`}
                      className="app-btn-secondary px-3 py-2.5 flex flex-col items-center justify-center gap-1 hover:scale-105 transition-transform"
                      title="Send Links"
                    >
                      <Send className="w-4 h-4" />
                      <span className="text-[10px]">Send</span>
                    </Link>
                    <Link
                      href={`/college/templates/${primaryTemplate.id}/edit`}
                      className="app-btn-secondary px-3 py-2.5 flex flex-col items-center justify-center gap-1 hover:scale-105 transition-transform"
                      title="Edit template"
                    >
                      <Edit className="w-4 h-4" />
                      <span className="text-[10px]">Edit</span>
                    </Link>
                    <button
                      onClick={async () => {
                        if (duplicating) return;
                        setDuplicating(primaryTemplate.id);
                        try {
                          const res = await fetch(`/api/college/templates/${primaryTemplate.id}/duplicate`, {
                            method: "POST",
                          });
                          const data = await res.json();
                          if (res.ok) {
                            // Refresh templates
                            const templatesRes = await fetch("/api/college/templates");
                            const templatesData = await templatesRes.json();
                            if (templatesRes.ok) {
                              const responseData = templatesData.data || templatesData;
                              setTemplates(responseData.templates || []);
                            }
                          } else {
                            setError(data.error || "Failed to duplicate template");
                          }
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Failed to duplicate template");
                        } finally {
                          setDuplicating(null);
                        }
                      }}
                      disabled={duplicating === primaryTemplate.id}
                      className="app-btn-secondary px-3 py-2.5 flex flex-col items-center justify-center gap-1 disabled:opacity-60 hover:scale-105 transition-transform"
                      title="Duplicate template"
                    >
                      <Copy className="w-4 h-4" />
                      <span className="text-[10px]">Copy</span>
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Are you sure you want to delete this template${variationCount > 1 ? ` (${variationCount} variations)` : ''}? This action cannot be undone.`)) {
                          return;
                        }
                        try {
                          // Delete all templates in the group
                          await Promise.all(groupTemplates.map(async (template) => {
                            const res = await fetch(`/api/college/templates/${template.id}`, {
                              method: "DELETE",
                            });
                            if (!res.ok) {
                              throw new Error("Failed to delete template");
                            }
                          }));
                          // Refresh templates
                          const templatesRes = await fetch("/api/college/templates");
                          const templatesData = await templatesRes.json();
                          if (templatesRes.ok) {
                            const responseData = templatesData.data || templatesData;
                            setTemplates(responseData.templates || []);
                          }
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Failed to delete template");
                        }
                      }}
                      className="app-btn-secondary px-3 py-2.5 flex flex-col items-center justify-center gap-1 text-[var(--danger)] hover:bg-[var(--danger-bg)] hover:scale-105 transition-all"
                      title={`Delete ${variationCount > 1 ? 'all variations' : 'template'}`}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-[10px]">Delete</span>
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Container>
  );
}

