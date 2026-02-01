"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, BarChart3, Send, Copy, Check, Download, Search, Filter, ExternalLink, Eye, ArrowUpDown, CheckSquare, Square, Mail, Plus, X, FileText, Upload } from "lucide-react";
import Card from "@/components/Card";
import Container from "@/components/Container";
import Badge from "@/components/Badge";
import Skeleton from "@/components/Skeleton";
import CohortAnalytics from "@/components/CohortAnalytics";
import Breadcrumbs from "@/components/Breadcrumbs";
import StudentSelector from "@/components/StudentSelector";

type Candidate = {
  email: string;
  name: string;
  studentId?: string;
  sessionId?: string;
  status?: "pending" | "in_progress" | "completed";
  completedAt?: number;
  linkSentAt?: number;
};

type Session = {
  id: string;
  status: string;
  scoreSummary?: {
    avg: {
      overall: number;
      technical: number;
      communication: number;
      problemSolving: number;
    };
  };
  tabSwitchCount?: number;
  shareToken?: string;
  answers?: Array<{
    questionId: string;
    text: string;
    submittedAt: number;
    timeSpent?: number;
    isSuspiciouslyFast?: boolean;
  }>;
  questionTimings?: Array<{
    questionId: string;
    displayedAt: number;
    answeredAt?: number;
    timeSpent?: number;
  }>;
};

type Tab = "candidates" | "results" | "send";

type AuthSession = {
  userId: string;
  collegeId: string;
  collegeName: string;
  email: string;
  role: 'admin' | 'viewer';
};

export default function TemplateDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = params.templateId as string;

  const [session, setSession] = useState<AuthSession | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>((searchParams.get("tab") as Tab) || "candidates");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [template, setTemplate] = useState<any>(null);
  const [sessions, setSessions] = useState<Record<string, Session>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "in_progress" | "completed">("all");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"name" | "email" | "status" | "score">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);
  const [studentFormData, setStudentFormData] = useState({
    email: "",
    name: "",
    studentId: "",
    phone: "",
    department: "",
    year: "",
    batch: "",
  });
  const [showAddCandidatesModal, setShowAddCandidatesModal] = useState(false);
  const [addingCandidates, setAddingCandidates] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Array<{ email: string; name: string; student_id?: string }>>([]);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/college/auth/session");
        const data = await res.json();
        if (!res.ok || !data.data?.session) {
          router.push(`/college/login?redirect=/college/dashboard/${templateId}`);
          return;
        }
        setSession(data.data.session);
      } catch (err) {
        router.push(`/college/login?redirect=/college/dashboard/${templateId}`);
      }
    }
    checkAuth();
  }, [router, templateId]);

  useEffect(() => {
    if (!session) return;

    async function fetchData() {
      try {
        // Fetch batches for this template
        const batchesRes = await fetch(`/api/college/batch?templateId=${templateId}`);
        const batchesData = await batchesRes.json();

        if (!batchesRes.ok) {
          throw new Error(batchesData.error || batchesData.message || "Failed to fetch batches");
        }

        // Handle standardized API response format
        const responseData = batchesData.data || batchesData;
        const batches = responseData.batches || [];
        if (responseData.template) {
          setTemplate(responseData.template);
        }
        const allCandidates: Candidate[] = [];
        const sessionIds: string[] = [];

        batches.forEach((batch: any) => {
          if (batch.candidates && Array.isArray(batch.candidates)) {
            batch.candidates.forEach((c: Candidate) => {
              allCandidates.push(c);
              if (c.sessionId) {
                sessionIds.push(c.sessionId);
              }
            });
          }
        });

        setCandidates(allCandidates);

        // Fetch session details for all candidates
        if (sessionIds.length > 0) {
          const sessionsData: Record<string, Session> = {};

          // Chunk IDs to avoid URL length limits and API limits
          const chunkSize = 50;
          for (let i = 0; i < sessionIds.length; i += chunkSize) {
            const chunk = sessionIds.slice(i, i + chunkSize);
            try {
              const res = await fetch(`/api/sessions?ids=${chunk.join(",")}`);
              const json = await res.json();

              if (res.ok && json.data?.sessions) {
                json.data.sessions.forEach((s: any) => {
                  sessionsData[s.id] = {
                    id: s.id,
                    status: s.status,
                    scoreSummary: s.scoreSummary,
                    tabSwitchCount: s.tabSwitchCount,
                    shareToken: s.shareToken,
                    answers: s.answers,
                    questionTimings: s.questionTimings,
                  };
                });
              }
            } catch (e) {
              console.error("Failed to fetch session chunk", e);
            }
          }

          setSessions(sessionsData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [templateId, session]);

  const getCandidateStatus = (candidate: Candidate): "pending" | "in_progress" | "completed" => {
    // Check live session status first if available
    const session = candidate.sessionId ? sessions[candidate.sessionId] : null;
    if (session) {
      if (session.status === "completed") return "completed";
      if (session.status === "in_progress") return "in_progress";
      // If session exists but status is unexpected, might fall through
    }
    // Fallback to batch status or default
    return candidate.status || "pending";
  };

  const getCandidateScore = (candidate: Candidate): number | null => {
    const session = candidate.sessionId ? sessions[candidate.sessionId] : null;
    return session?.scoreSummary?.avg?.overall ?? null;
  };

  const filteredCandidates = candidates.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.studentId && c.studentId.toLowerCase().includes(searchQuery.toLowerCase()));

    const status = getCandidateStatus(c);
    const matchesStatus = statusFilter === "all" || status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const copyLink = async (sessionId: string) => {
    const link = `${window.location.origin}/interview/${sessionId}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(sessionId);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (err) {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = link;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedLink(sessionId);
      setTimeout(() => setCopiedLink(null), 2000);
    }
  };

  const toggleSelectCandidate = (email: string) => {
    const newSelected = new Set(selectedCandidates);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelectedCandidates(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedCandidates.size === filteredCandidates.length && filteredCandidates.length > 0) {
      setSelectedCandidates(new Set());
    } else {
      setSelectedCandidates(new Set(filteredCandidates.map(c => c.email)));
    }
  };

  const exportCSV = (candidatesToExport?: Candidate[]) => {
    const candidatesList = candidatesToExport || filteredCandidates;

    if (candidatesList.length === 0) {
      return;
    }

    const headers = ["Name", "Email", "Student ID", "Status", "Score", "Tab Switches", "Interview Link"];
    const rows = candidatesList.map(c => {
      const status = getCandidateStatus(c);
      const score = getCandidateScore(c);
      const session = c.sessionId ? sessions[c.sessionId] : null;
      const link = c.sessionId ? `${window.location.origin}/interview/${c.sessionId}` : "";
      return [
        c.name,
        c.email,
        c.studentId || "",
        status,
        score !== null ? score.toFixed(1) : "",
        session?.tabSwitchCount || 0,
        link,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `candidates-${templateId}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadgeVariant = (status: string) => {
    if (status === "completed") return "success";
    if (status === "in_progress") return "info";
    return "default";
  };

  const statusCounts = {
    all: candidates.length,
    pending: candidates.filter(c => getCandidateStatus(c) === "pending").length,
    in_progress: candidates.filter(c => getCandidateStatus(c) === "in_progress").length,
    completed: candidates.filter(c => getCandidateStatus(c) === "completed").length,
  };

  if (!session || loading) {
    return (
      <Container className="py-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-12" variant="rectangular" />
          <Skeleton className="h-64" variant="rectangular" />
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <Breadcrumbs
        items={[
          { label: "Templates", href: "/college/dashboard" },
          { label: `Template ${templateId.substring(0, 8)}...` },
        ]}
      />
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => router.push("/college/dashboard")}
          className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Templates</span>
        </button>
        <Link
          href="/college"
          className="app-btn-secondary px-4 py-2 text-sm"
        >
          Create New Template
        </Link>
      </div>

      <h1 className="text-2xl font-semibold text-[var(--text)] mb-2">Template Dashboard</h1>
      <p className="text-[var(--muted)] mb-6">Template ID: {templateId}</p>

      {error && (
        <Card className="app-card mb-6">
          <div className="rounded-lg bg-[var(--danger-bg)] border border-[var(--danger)] p-4">
            <p className="text-sm text-[var(--danger)]">{error}</p>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--border)] mb-6">
        <button
          onClick={() => setActiveTab("candidates")}
          className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === "candidates"
            ? "text-[var(--primary)] border-b-2 border-[var(--primary)]"
            : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
        >
          <Users className="w-4 h-4" />
          Candidates ({candidates.length})
        </button>
        <button
          onClick={() => setActiveTab("results")}
          className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === "results"
            ? "text-[var(--primary)] border-b-2 border-[var(--primary)]"
            : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
        >
          <BarChart3 className="w-4 h-4" />
          Results
        </button>
        <button
          onClick={() => setActiveTab("send")}
          className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === "send"
            ? "text-[var(--primary)] border-b-2 border-[var(--primary)]"
            : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
        >
          <Send className="w-4 h-4" />
          Send Links
        </button>
      </div>

      {/* Candidates Tab */}
      {activeTab === "candidates" && (
        <div className="space-y-4">
          {/* Add Student Button */}
          <Card className="app-card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text)] mb-1">Candidates</h3>
                <p className="text-sm text-[var(--muted)]">Manage candidates for this interview template</p>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/college/students"
                  className="app-btn-secondary px-4 py-2 text-sm flex items-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  Manage Students
                </Link>
                <button
                  onClick={() => setShowAddCandidatesModal(true)}
                  className="app-btn-primary px-4 py-2 text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Candidates
                </button>
                <button
                  onClick={() => setShowAddStudentModal(true)}
                  className="app-btn-secondary px-4 py-2 text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add New Student
                </button>
              </div>
            </div>
          </Card>

          {/* Filters and Search */}
          <Card className="app-card">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex-1 w-full md:w-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or student ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 app-input"
                  />
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <Filter className="w-4 h-4 text-[var(--muted)]" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="app-input"
                >
                  <option value="all">All ({statusCounts.all})</option>
                  <option value="pending">Pending ({statusCounts.pending})</option>
                  <option value="in_progress">In Progress ({statusCounts.in_progress})</option>
                  <option value="completed">Completed ({statusCounts.completed})</option>
                </select>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [by, order] = e.target.value.split("-");
                    setSortBy(by as any);
                    setSortOrder(order as any);
                  }}
                  className="app-input"
                >
                  <option value="name-asc">Sort: Name (A-Z)</option>
                  <option value="name-desc">Sort: Name (Z-A)</option>
                  <option value="email-asc">Sort: Email (A-Z)</option>
                  <option value="email-desc">Sort: Email (Z-A)</option>
                  <option value="status-asc">Sort: Status</option>
                  <option value="score-desc">Sort: Score (High-Low)</option>
                  <option value="score-asc">Sort: Score (Low-High)</option>
                </select>
              </div>
              {selectedCandidates.size > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const selected = filteredCandidates.filter(c => selectedCandidates.has(c.email));

                      if (selected.length === 0) {
                        alert("No candidates selected");
                        return;
                      }

                      // Prepare invitation data for Resend
                      const invitations = selected
                        .filter(c => c.sessionId) // Only send to candidates with sessions
                        .map(c => ({
                          candidateName: c.name,
                          candidateEmail: c.email,
                          interviewLink: `${window.location.origin}/interview/${c.sessionId}`,
                          collegeName: session?.collegeName || "Your College",
                          jobTitle: template?.config?.templateName || (template?.jdText ? template.jdText.split('\n')[0].substring(0, 60) : "Interview Position"),
                          questionCount: template?.config?.questionCount || 10,
                          estimatedTime: template?.config?.estimatedTime || 30,
                        }));

                      if (invitations.length === 0) {
                        alert("No valid candidates to send emails to. Make sure they have interview sessions created.");
                        return;
                      }

                      try {
                        const res = await fetch("/api/college/send-emails", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ invitations }),
                        });

                        const data = await res.json();

                        if (res.ok) {
                          alert(`✅ Successfully sent ${data.data.successful} of ${data.data.total} emails!\n\n${data.data.failed > 0 ? `⚠️ ${data.data.failed} emails failed. Check console for details.` : ''}`);
                          if (data.data.failed > 0) {
                            console.error('Failed emails:', data.data.results.filter((r: any) => r.status === 'rejected'));
                          }
                          // Clear selection after sending
                          setSelectedCandidates(new Set());
                        } else {
                          alert(`❌ ${data.error || "Failed to send emails"}\n\n${data.details || ''}`);
                        }
                      } catch (err) {
                        console.error('Email send error:', err);
                        alert("❌ Failed to send emails. Please check your internet connection and try again.");
                      }
                    }}
                    className="app-btn-primary px-4 py-2 text-sm flex items-center gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Send Email Invites ({selectedCandidates.size})
                  </button>
                  <button
                    onClick={() => {
                      const links = filteredCandidates
                        .filter(c => selectedCandidates.has(c.email))
                        .map(c => c.sessionId ? `${window.location.origin}/interview/${c.sessionId}` : null)
                        .filter(Boolean)
                        .join("\n");
                      navigator.clipboard.writeText(links);
                      setCopiedLink("bulk");
                      setTimeout(() => setCopiedLink(null), 2000);
                    }}
                    className="app-btn-secondary px-4 py-2 text-sm flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy {selectedCandidates.size} Links
                  </button>
                  <button
                    onClick={() => {
                      const selected = filteredCandidates.filter(c => selectedCandidates.has(c.email));
                      exportCSV(selected);
                    }}
                    className="app-btn-secondary px-4 py-2 text-sm flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export Selected
                  </button>
                </div>
              )}
              <button
                onClick={() => exportCSV()}
                className="app-btn-secondary px-4 py-2 text-sm flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export All CSV
              </button>
            </div>
          </Card>

          {/* Candidate Table */}
          <Card className="app-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--bg)] border-b border-[var(--border)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text)] w-12">
                      <button
                        onClick={toggleSelectAll}
                        className="hover:opacity-70 transition-opacity"
                        title="Select all"
                      >
                        {selectedCandidates.size === filteredCandidates.length && filteredCandidates.length > 0 ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text)]">
                      <button
                        onClick={() => {
                          setSortBy("name");
                          setSortOrder(sortBy === "name" && sortOrder === "asc" ? "desc" : "asc");
                        }}
                        className="flex items-center gap-1 hover:text-[var(--primary)]"
                      >
                        Name
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text)]">
                      <button
                        onClick={() => {
                          setSortBy("email");
                          setSortOrder(sortBy === "email" && sortOrder === "asc" ? "desc" : "asc");
                        }}
                        className="flex items-center gap-1 hover:text-[var(--primary)]"
                      >
                        Email
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text)]">Student ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text)]">
                      <button
                        onClick={() => {
                          setSortBy("status");
                          setSortOrder(sortBy === "status" && sortOrder === "asc" ? "desc" : "asc");
                        }}
                        className="flex items-center gap-1 hover:text-[var(--primary)]"
                      >
                        Status
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text)]">
                      <button
                        onClick={() => {
                          setSortBy("score");
                          setSortOrder(sortBy === "score" && sortOrder === "desc" ? "asc" : "desc");
                        }}
                        className="flex items-center gap-1 hover:text-[var(--primary)]"
                      >
                        Score
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text)]">Tab Switches</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text)]">Avg Time/Q</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                        No candidates found
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((candidate, idx) => {
                      const status = getCandidateStatus(candidate);
                      const score = getCandidateScore(candidate);
                      const session = candidate.sessionId ? sessions[candidate.sessionId] : null;
                      const interviewLink = candidate.sessionId ? `/interview/${candidate.sessionId}` : null;
                      const reportLink = session?.shareToken ? `/share/${session.shareToken}` : null;
                      const isSelected = selectedCandidates.has(candidate.email);

                      return (
                        <tr key={idx} className={`border-b border-[var(--border)] hover:bg-[var(--card-hover)] transition-colors ${isSelected ? "bg-[var(--primary-bg)]" : ""}`}>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleSelectCandidate(candidate.email)}
                              className="hover:opacity-70 transition-opacity"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-[var(--primary)]" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm text-[var(--text)]">{candidate.name}</td>
                          <td className="px-4 py-3 text-sm text-[var(--muted)]">{candidate.email}</td>
                          <td className="px-4 py-3 text-sm text-[var(--muted)]">{candidate.studentId || "-"}</td>
                          <td className="px-4 py-3">
                            <Badge variant={getStatusBadgeVariant(status)}>
                              {status.replace("_", " ")}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-[var(--text)]">
                            {score !== null ? (
                              <span className="font-semibold">{score.toFixed(1)}/10</span>
                            ) : (
                              <span className="text-[var(--muted)]">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-[var(--text)]">
                            {session?.tabSwitchCount !== undefined ? (
                              <Badge variant={session.tabSwitchCount > 3 ? "error" : "default"}>
                                {session.tabSwitchCount}
                              </Badge>
                            ) : (
                              <span className="text-[var(--muted)]">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-[var(--text)]">
                            {session?.answers && session.answers.length > 0 ? (() => {
                              const times = session.answers
                                .filter(a => a.timeSpent !== undefined)
                                .map(a => a.timeSpent!);
                              if (times.length === 0) return <span className="text-[var(--muted)]">-</span>;
                              const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
                              const suspiciousCount = session.answers.filter(a => a.isSuspiciouslyFast).length;
                              return (
                                <div className="flex items-center gap-2">
                                  <span className={suspiciousCount > 0 ? "font-semibold text-[var(--warning)]" : ""}>
                                    {avgTime}s
                                  </span>
                                  {suspiciousCount > 0 && (
                                    <Badge variant="warning" className="text-xs">
                                      {suspiciousCount} fast
                                    </Badge>
                                  )}
                                </div>
                              );
                            })() : (
                              <span className="text-[var(--muted)]">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              {interviewLink && (
                                <Link
                                  href={interviewLink}
                                  target="_blank"
                                  className="text-[var(--primary)] hover:text-[var(--primary-hover)] p-1 transition-colors"
                                  title="View Interview"
                                >
                                  <Eye className="w-4 h-4" />
                                </Link>
                              )}
                              {reportLink && (
                                <Link
                                  href={reportLink}
                                  target="_blank"
                                  className="text-[var(--success)] hover:brightness-110 p-1 transition-all"
                                  title="View Report"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Results Tab */}
      {activeTab === "results" && (
        <div>
          <CohortAnalytics templateId={templateId} />
        </div>
      )}

      {/* Send Links Tab */}
      {activeTab === "send" && (
        <div className="space-y-4">
          <Card className="app-card">
            <h3 className="text-lg font-semibold text-[var(--text)] mb-4">Interview Links</h3>
            <p className="text-sm text-[var(--muted)] mb-4">
              Copy interview links to send to candidates. Each candidate has a unique link.
            </p>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {candidates.length === 0 ? (
                <p className="text-sm text-[var(--muted)] text-center py-8">No candidates found</p>
              ) : (
                candidates.map((candidate, idx) => {
                  const interviewLink = candidate.sessionId
                    ? `${window.location.origin}/interview/${candidate.sessionId}`
                    : null;
                  const isCopied = copiedLink === candidate.sessionId;

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-[var(--bg)] rounded border border-[var(--border)]"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text)]">{candidate.name}</p>
                        <p className="text-xs text-[var(--muted)] truncate">{candidate.email}</p>
                        {interviewLink && (
                          <p className="text-xs text-[var(--muted)] font-mono truncate mt-1">
                            {interviewLink}
                          </p>
                        )}
                      </div>
                      {interviewLink && (
                        <button
                          onClick={() => copyLink(candidate.sessionId!)}
                          className="app-btn-secondary px-4 py-2 text-sm flex items-center gap-2 ml-4 flex-shrink-0"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-4 h-4" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copy
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddStudentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text)]">Add New Student</h3>
              <button
                onClick={() => {
                  setShowAddStudentModal(false);
                  setStudentFormData({ email: "", name: "", studentId: "", phone: "", department: "", year: "", batch: "" });
                  setError(null);
                }}
                className="text-[var(--muted)] hover:text-[var(--text)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setAddingStudent(true);
                setError(null);

                try {
                  // Create student
                  const res = await fetch("/api/college/students", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      email: studentFormData.email,
                      name: studentFormData.name,
                      studentId: studentFormData.studentId || undefined,
                      phone: studentFormData.phone || undefined,
                      department: studentFormData.department || undefined,
                      year: studentFormData.year || undefined,
                      batch: studentFormData.batch || undefined,
                    }),
                  });

                  const data = await res.json();

                  if (!res.ok) {
                    throw new Error(data.error || data.message || "Failed to create student");
                  }

                  // Success - close modal and refresh
                  setShowAddStudentModal(false);
                  setStudentFormData({ email: "", name: "", studentId: "", phone: "", department: "", year: "", batch: "" });
                  setError(null);

                  // Show success message
                  alert(`Student "${studentFormData.name}" added successfully! You can now add them as a candidate from the student database.`);

                  // Optionally refresh the page to show updated student list
                  window.location.reload();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to add student");
                } finally {
                  setAddingStudent(false);
                }
              }}
              className="space-y-4"
            >
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={studentFormData.name}
                    onChange={(e) => setStudentFormData({ ...studentFormData, name: e.target.value })}
                    required
                    className="w-full app-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={studentFormData.email}
                    onChange={(e) => setStudentFormData({ ...studentFormData, email: e.target.value })}
                    required
                    className="w-full app-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Student ID
                  </label>
                  <input
                    type="text"
                    value={studentFormData.studentId}
                    onChange={(e) => setStudentFormData({ ...studentFormData, studentId: e.target.value })}
                    className="w-full app-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={studentFormData.phone}
                    onChange={(e) => setStudentFormData({ ...studentFormData, phone: e.target.value })}
                    className="w-full app-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Department
                  </label>
                  <input
                    type="text"
                    value={studentFormData.department}
                    onChange={(e) => setStudentFormData({ ...studentFormData, department: e.target.value })}
                    className="w-full app-input"
                    placeholder="e.g., Computer Science"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Year
                  </label>
                  <input
                    type="text"
                    value={studentFormData.year}
                    onChange={(e) => setStudentFormData({ ...studentFormData, year: e.target.value })}
                    className="w-full app-input"
                    placeholder="e.g., 3rd Year"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Batch
                  </label>
                  <input
                    type="text"
                    value={studentFormData.batch}
                    onChange={(e) => setStudentFormData({ ...studentFormData, batch: e.target.value })}
                    className="w-full app-input"
                    placeholder="e.g., 2024"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-[var(--danger-bg)] border border-[var(--danger)] p-3">
                  <p className="text-sm text-[var(--danger)]">{error}</p>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddStudentModal(false);
                    setStudentFormData({ email: "", name: "", studentId: "", phone: "", department: "", year: "", batch: "" });
                    setError(null);
                  }}
                  className="app-btn-secondary px-6 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingStudent}
                  className="app-btn-primary px-6 py-2 disabled:opacity-60"
                >
                  {addingStudent ? "Adding..." : "Add Student"}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Add Candidates Modal */}
      {showAddCandidatesModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text)]">Add Candidates from Student Database</h3>
              <button
                onClick={() => {
                  setShowAddCandidatesModal(false);
                  setSelectedStudents([]);
                  setError(null);
                }}
                className="text-[var(--muted)] hover:text-[var(--text)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* CSV Download & Upload Option */}
              <div className="bg-[var(--info-bg)] border border-[var(--info)] rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-[var(--info-bg)] border border-[var(--info)] rounded-lg">
                    <FileText className="w-5 h-5 text-[var(--info)]" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-[var(--text)] mb-1">Bulk Add via CSV</h4>
                    <p className="text-xs text-[var(--muted)] mb-3">
                      Download the CSV template, fill in details, and upload to bulk add candidates.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => {
                          const csvContent = `name,email,student_id,phone,branch,graduation_year
John Doe,john.doe@example.com,STU001,1234567890,CS,2024
Jane Smith,jane.smith@example.com,STU002,0987654321,IT,2024`;
                          const blob = new Blob([csvContent], { type: 'text/csv' });
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'candidate_template.csv';
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          window.URL.revokeObjectURL(url);
                        }}
                        className="app-btn-secondary px-3 py-2 text-xs flex items-center gap-2"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download Template
                      </button>

                      <label className="app-btn-primary px-3 py-2 text-xs flex items-center gap-2 cursor-pointer hover:bg-[var(--primary-hover)]">
                        <Upload className="w-3.5 h-3.5" />
                        Upload CSV
                        <input
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            const reader = new FileReader();
                            reader.onload = (event) => {
                              try {
                                const text = event.target?.result as string;
                                const lines = text.split('\n');
                                if (lines.length < 2) {
                                  setError("CSV file is empty or has only headers.");
                                  return;
                                }

                                const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
                                const nameIdx = headers.indexOf('name');
                                const emailIdx = headers.indexOf('email');
                                const idIdx = headers.indexOf('student_id');

                                if (nameIdx === -1 || emailIdx === -1) {
                                  setError("CSV must contain 'name' and 'email' columns");
                                  return;
                                }

                                const newStudents: Array<{ email: string; name: string; student_id?: string }> = [];
                                const existingEmails = new Set(selectedStudents.map(s => s.email));

                                for (let i = 1; i < lines.length; i++) {
                                  if (!lines[i].trim()) continue;
                                  const values = lines[i].split(',').map(v => v.trim());

                                  const email = values[emailIdx];
                                  const name = values[nameIdx];
                                  const studentId = idIdx !== -1 ? values[idIdx] : undefined;

                                  if (email && name && !existingEmails.has(email)) {
                                    newStudents.push({
                                      name,
                                      email,
                                      student_id: studentId
                                    });
                                    existingEmails.add(email);
                                  }
                                }

                                if (newStudents.length > 0) {
                                  setSelectedStudents(prev => [...prev, ...newStudents]);
                                  setError(null);
                                  // Clear input
                                  e.target.value = '';
                                } else {
                                  setError("No valid new students found in CSV or all are already selected.");
                                }
                              } catch (err) {
                                setError("Failed to parse CSV file");
                                console.error(err);
                              }
                            };
                            reader.readAsText(file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--border)]"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[var(--card)] px-2 text-[var(--muted)]">OR</span>
                </div>
              </div>

              {/* Manual Selection */}
              <div>
                <p className="text-sm text-[var(--muted)] mb-3">
                  Search and select students to add as candidates for this interview template.
                </p>
                <StudentSelector
                  onSelect={(students) => {
                    setSelectedStudents(students);
                  }}
                  selectedEmails={candidates.map(c => c.email)}
                  multiSelect={true}
                />
              </div>

              {selectedStudents.length > 0 && (
                <div className="border-t border-[var(--border)] pt-4">
                  <p className="text-sm font-medium text-[var(--text)] mb-2">
                    Selected Students ({selectedStudents.length}):
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedStudents.map((student) => (
                      <div
                        key={student.email}
                        className="flex items-center justify-between p-2 bg-[var(--bg)] rounded border border-[var(--border)]"
                      >
                        <div>
                          <p className="text-sm font-medium text-[var(--text)]">{student.name}</p>
                          <p className="text-xs text-[var(--muted)]">{student.email}</p>
                          {student.student_id && (
                            <p className="text-xs text-[var(--muted)]">ID: {student.student_id}</p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setSelectedStudents(selectedStudents.filter(s => s.email !== student.email));
                          }}
                          className="text-red-600 hover:text-[var(--danger)] p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-[var(--danger-bg)] border border-[var(--danger)] p-3">
                  <p className="text-sm text-[var(--danger)]">{error}</p>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCandidatesModal(false);
                    setSelectedStudents([]);
                    setError(null);
                  }}
                  className="app-btn-secondary px-6 py-2"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (selectedStudents.length === 0) {
                      setError("Please select at least one student");
                      return;
                    }

                    if (!templateId) {
                      setError("Template ID is missing");
                      return;
                    }

                    setAddingCandidates(true);
                    setError(null);

                    try {
                      // Check if any selected students are already candidates
                      const existingEmails = new Set(candidates.map(c => c.email));
                      const newCandidates = selectedStudents.filter(s => !existingEmails.has(s.email));

                      if (newCandidates.length === 0) {
                        setError("All selected students are already candidates for this template");
                        setAddingCandidates(false);
                        return;
                      }

                      // Create batch with new candidates - ensure all required fields
                      const candidatesData = newCandidates
                        .filter(s => {
                          // Validate each student has required fields
                          if (!s.email || !s.email.trim()) {
                            console.warn("Skipping student with missing email:", s);
                            return false;
                          }
                          if (!s.name || !s.name.trim()) {
                            console.warn("Skipping student with missing name:", s);
                            return false;
                          }
                          return true;
                        })
                        .map(s => ({
                          email: s.email.trim(),
                          name: s.name.trim(),
                          studentId: s.student_id?.trim() || undefined,
                        }));

                      if (candidatesData.length === 0) {
                        setError("No valid candidates to add. Each student must have an email and name.");
                        setAddingCandidates(false);
                        return;
                      }

                      const requestBody = {
                        jobTemplateId: templateId,
                        candidates: candidatesData,
                      };

                      console.log("Adding candidates:", { templateId, candidateCount: candidatesData.length, requestBody });

                      const res = await fetch("/api/college/batch", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(requestBody),
                      });

                      const data = await res.json();

                      if (!res.ok) {
                        const errorMsg = data.error || data.message || `Failed to add candidates (${res.status})`;
                        console.error("Failed to add candidates:", {
                          status: res.status,
                          statusText: res.statusText,
                          data,
                          requestBody
                        });
                        throw new Error(errorMsg);
                      }

                      console.log("Candidates added successfully:", data);

                      // Success - close modal and refresh
                      setShowAddCandidatesModal(false);
                      setSelectedStudents([]);
                      setError(null);

                      // Refresh candidates data
                      setLoading(true);
                      try {
                        const batchesRes = await fetch(`/api/college/batch?templateId=${templateId}`);
                        const batchesData = await batchesRes.json();

                        if (batchesRes.ok) {
                          const responseData = batchesData.data || batchesData;
                          const batches = responseData.batches || [];
                          const allCandidates: Candidate[] = [];
                          const sessionIds: string[] = [];

                          batches.forEach((batch: any) => {
                            if (batch.candidates && Array.isArray(batch.candidates)) {
                              batch.candidates.forEach((c: Candidate) => {
                                allCandidates.push(c);
                                if (c.sessionId) {
                                  sessionIds.push(c.sessionId);
                                }
                              });
                            }
                          });

                          setCandidates(allCandidates);
                          setLoading(false);
                        } else {
                          setLoading(false);
                        }
                      } catch (err) {
                        setLoading(false);
                        // Fallback to page reload if fetch fails
                        window.location.reload();
                      }
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to add candidates");
                    } finally {
                      setAddingCandidates(false);
                    }
                  }}
                  disabled={addingCandidates || selectedStudents.length === 0}
                  className="app-btn-primary px-6 py-2 disabled:opacity-60"
                >
                  {addingCandidates ? "Adding..." : `Add ${selectedStudents.length} Candidate${selectedStudents.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </Container>
  );
}

