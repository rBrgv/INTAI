"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Users, CheckCircle2, Clock, FileText, TrendingUp, ExternalLink } from "lucide-react";
import Card from "@/components/Card";
import Container from "@/components/Container";
import { clientLogger } from "@/lib/clientLogger";

type Batch = {
  id: string;
  jobTemplateId: string;
  createdAt: number;
  candidates: Array<{
    email: string;
    name: string;
    studentId?: string;
    sessionId?: string;
    status?: "pending" | "in_progress" | "completed";
    score?: number;
    completedAt?: number;
    hasReport?: boolean;
    shareToken?: string;
  }>;
};

type BatchStats = {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  averageScore: number;
};

export default function CollegeDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchIdParam = searchParams.get('batch');

  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [batchStats, setBatchStats] = useState<BatchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (batchIdParam) {
      loadBatch(batchIdParam);
    } else {
      // Load all batches (for now, we'll show a message to create a batch)
      setLoading(false);
    }
  }, [batchIdParam]);

  const loadBatch = async (batchId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/college/batch/${batchId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to load batch");
      }

      const batchData = data.data?.batch || data.batch;
      const stats = data.data?.stats || data.stats;

      setSelectedBatch(batchData);
      setBatchStats(stats);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load batch";
      setError(errorMessage);
      clientLogger.error("Failed to load batch", err instanceof Error ? err : new Error(String(err)), { batchId });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
      case 'created':
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Container className="py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
            <p className="text-[var(--muted)]">Loading batch...</p>
          </div>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/college" className="inline-flex items-center gap-2 text-[var(--muted)] hover:text-[var(--text)] mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to Setup
          </Link>
          <Card>
            <div className="p-6 text-center">
              <p className="text-[var(--danger)] mb-4">{error}</p>
              <Link href="/college" className="app-btn-primary">
                Create New Batch
              </Link>
            </div>
          </Card>
        </div>
      </Container>
    );
  }

  if (!selectedBatch) {
    return (
      <Container className="py-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/college" className="inline-flex items-center gap-2 text-[var(--muted)] hover:text-[var(--text)] mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to Setup
          </Link>
          <Card>
            <div className="p-6 text-center">
              <p className="text-[var(--muted)] mb-4">
                No batch selected. Create a new batch to get started.
              </p>
              <Link href="/college" className="app-btn-primary">
                Create New Batch
              </Link>
            </div>
          </Card>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/college" className="inline-flex items-center gap-2 text-[var(--muted)] hover:text-[var(--text)] mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Setup
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--text)] mb-2">Batch Dashboard</h1>
          <p className="text-[var(--muted)]">
            Created {formatDate(selectedBatch.createdAt)} • {selectedBatch.candidates.length} candidates
          </p>
        </div>

        {batchStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--muted)] mb-1">Total</p>
                  <p className="text-2xl font-bold text-[var(--text)]">{batchStats.total}</p>
                </div>
                <Users className="w-8 h-8 text-[var(--muted)]" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--muted)] mb-1">Pending</p>
                  <p className="text-2xl font-bold text-[var(--text)]">{batchStats.pending}</p>
                </div>
                <Clock className="w-8 h-8 text-[var(--muted)]" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--muted)] mb-1">In Progress</p>
                  <p className="text-2xl font-bold text-[var(--text)]">{batchStats.inProgress}</p>
                </div>
                <FileText className="w-8 h-8 text-[var(--muted)]" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--muted)] mb-1">Completed</p>
                  <p className="text-2xl font-bold text-[var(--text)]">{batchStats.completed}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
            </Card>
          </div>
        )}

        {batchStats && batchStats.completed > 0 && (
          <Card className="p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--muted)] mb-1">Average Score</p>
                <p className="text-2xl font-bold text-[var(--text)]">
                  {batchStats.averageScore.toFixed(1)}/10
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-[var(--primary)]" />
            </div>
          </Card>
        )}

        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Candidates</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)]">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)]">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)]">Student ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)]">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)]">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBatch.candidates.map((candidate, index) => (
                    <tr key={index} className="border-b border-[var(--border)] hover:bg-[var(--bg)]">
                      <td className="px-4 py-3 text-sm text-[var(--text)]">{candidate.name}</td>
                      <td className="px-4 py-3 text-sm text-[var(--muted)]">{candidate.email}</td>
                      <td className="px-4 py-3 text-sm text-[var(--muted)]">{candidate.studentId || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(candidate.status)}`}>
                          {candidate.status === 'completed' ? 'Completed' :
                           candidate.status === 'in_progress' ? 'In Progress' :
                           'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text)]">
                        {candidate.score !== undefined ? (
                          <span className="font-medium">{candidate.score.toFixed(1)}/10</span>
                        ) : (
                          <span className="text-[var(--muted)]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {candidate.sessionId && (
                            <Link
                              href={`/interview/${candidate.sessionId}`}
                              target="_blank"
                              className="p-1.5 hover:bg-[var(--bg)] rounded transition-colors"
                              title="View interview"
                            >
                              <ExternalLink className="w-4 h-4 text-[var(--muted)]" />
                            </Link>
                          )}
                          {candidate.hasReport && candidate.shareToken && (
                            <Link
                              href={`/share/${candidate.shareToken}`}
                              target="_blank"
                              className="p-1.5 hover:bg-[var(--bg)] rounded transition-colors"
                              title="View report"
                            >
                              <FileText className="w-4 h-4 text-[var(--primary)]" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </Container>
  );
}

