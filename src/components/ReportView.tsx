"use client";

import { ArrowRight, CheckCircle2, FileDown, AlertTriangle, Lock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import Card from "./Card";
import Badge from "./Badge";
import { sanitizeForDisplaySync } from "@/lib/sanitize";

type ReportViewProps = {
  report: {
    recommendation: "strong_hire" | "hire" | "borderline" | "no_hire";
    confidence: number;
    executiveSummary: string;
    strengths: string[];
    gapsAndRisks: string[];
    evidence: Array<{
      claim: string;
      supportingAnswerSnippet: string;
      relatedQuestionId: string;
      evidenceType?: "technical" | "leadership" | "communication" | "problem_solving";
    }>;
    nextRoundFocus: string[];
    securitySummary?: {
      tabSwitchCount: number;
      securityEventCount: number;
      criticalEvents: string[];
      summary: string;
    };
  };
  scoreSummary?: {
    countEvaluated: number;
    avg: {
      technical: number;
      communication: number;
      problemSolving: number;
      overall: number;
    };
  };
  context?: {
    mode?: string;
    role?: string;
    level?: string;
  };
  readOnly?: boolean;
  viewType?: "candidate" | "recruiter"; // Default to "recruiter" for backward compatibility
};

export default function ReportView({
  report,
  scoreSummary,
  context,
  readOnly = false,
  viewType = "recruiter",
}: ReportViewProps) {
  const router = useRouter();
  
  // For candidate view, hide "no_hire" recommendation and show "borderline" instead
  const displayRecommendation = viewType === "candidate" && report.recommendation === "no_hire" 
    ? "borderline" 
    : report.recommendation;

  const handleExit = () => {
    router.push("/");
  };

  const handleExportPDF = () => {
    // Add metadata to document before printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const printContent = document.querySelector('[data-report-content]')?.innerHTML || document.body.innerHTML;
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Interview Report - ${new Date().toLocaleDateString()}</title>
            <style>
              @media print {
                @page {
                  size: A4;
                  margin: 1cm;
                }
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  font-size: 12pt;
                  line-height: 1.6;
                  color: #000;
                }
                .no-print {
                  display: none !important;
                }
                h1, h2, h3, h4, h5, h6 {
                  page-break-after: avoid;
                }
                .page-break {
                  page-break-before: always;
                }
                .header {
                  border-bottom: 2px solid #000;
                  padding-bottom: 10px;
                  margin-bottom: 20px;
                }
                .footer {
                  border-top: 1px solid #ccc;
                  padding-top: 10px;
                  margin-top: 20px;
                  font-size: 10pt;
                  color: #666;
                }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Interview Report</h1>
              <p>Generated: ${new Date().toLocaleString()}</p>
            </div>
            ${printContent}
            <div class="footer">
              <p>Report ID: ${context?.mode || 'N/A'} - ${new Date().toISOString()}</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    } else {
      // Fallback to standard print
      window.print();
    }
  };

  return (
    <div className="space-y-6" data-report-content>
      {/* Action Buttons - At the top */}
      {!readOnly && (
        <div className="flex justify-between items-center no-print mb-2">
          <button
            onClick={handleExit}
            className="app-btn-secondary px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
            Exit
          </button>
          <button
            onClick={handleExportPDF}
            className="app-btn-primary px-4 py-2 text-sm flex items-center gap-2"
          >
            <FileDown className="w-4 h-4" />
            Export as PDF
          </button>
        </div>
      )}
      {/* Hero Header */}
      <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-lg font-semibold text-slate-900">Recommendation</h4>
          <Badge
            variant={
              displayRecommendation === "strong_hire"
                ? "success"
                : displayRecommendation === "hire"
                ? "info"
                : displayRecommendation === "borderline"
                ? "warning"
                : "error"
            }
          >
            {displayRecommendation.replace("_", " ").toUpperCase()}
          </Badge>
        </div>
        <p className="text-sm text-slate-600 mb-2">
          Confidence: <span className="font-semibold">{report.confidence}%</span>
        </p>
        <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
          {sanitizeForDisplaySync(report.executiveSummary)}
        </p>
      </div>

      {/* Context Info */}
      {context && (context.mode || context.role || context.level) && (
        <Card variant="outlined">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {context.mode && (
              <div>
                <span className="text-slate-500">Mode:</span>{" "}
                <span className="font-medium">
                  {context.mode === "company" 
                    ? "Company" 
                    : context.mode === "college"
                    ? "College"
                    : "Individual"}
                </span>
              </div>
            )}
            {context.role && (
              <div>
                <span className="text-slate-500">Role:</span>{" "}
                <span className="font-medium">{context.role}</span>
              </div>
            )}
            {context.level && (
              <div>
                <span className="text-slate-500">Level:</span>{" "}
                <span className="font-medium">{context.level}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Score Summary Chips */}
      {scoreSummary && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="info">
            Overall: {scoreSummary.avg.overall.toFixed(1)}
          </Badge>
          <Badge>Tech: {scoreSummary.avg.technical.toFixed(1)}</Badge>
          <Badge>Comms: {scoreSummary.avg.communication.toFixed(1)}</Badge>
          <Badge>PS: {scoreSummary.avg.problemSolving.toFixed(1)}</Badge>
          <Badge variant="default">Evaluated: {scoreSummary.countEvaluated}</Badge>
        </div>
      )}

      {/* Strengths vs Gaps */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card variant="outlined">
          <h5 className="text-sm font-semibold text-slate-900 mb-3">Strengths</h5>
          <ul className="space-y-2 text-sm text-slate-700">
            {report.strengths.map((s, i) => (
              <li key={i} className="flex items-start">
                <CheckCircle2 className="w-3 h-3 text-green-600 mr-2 mt-0.5 inline" />
                {s}
              </li>
            ))}
          </ul>
        </Card>

        <Card variant="outlined">
          <h5 className="text-sm font-semibold text-slate-900 mb-3">Gaps / Risks</h5>
          <ul className="space-y-2 text-sm text-slate-700">
            {report.gapsAndRisks.map((g, i) => (
              <li key={i} className="flex items-start">
                <ArrowRight className="w-3 h-3 text-yellow-600 mr-2 mt-0.5 inline" />
                {sanitizeForDisplaySync(g)}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Evidence Highlights */}
      <Card>
        <h5 className="text-sm font-semibold text-slate-900 mb-4">Evidence Highlights</h5>
        <div className="space-y-3">
          {report.evidence.map((e, i) => (
            <div key={i} className="rounded-md bg-slate-50 border border-slate-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-medium text-slate-900 flex-1">{sanitizeForDisplaySync(e.claim)}</p>
                <Badge variant="info" className="ml-2">
                  {(e.evidenceType || "technical").replace("_", " ")}
                </Badge>
              </div>
              <p className="text-sm text-slate-600 italic mb-1">
                "{sanitizeForDisplaySync(e.supportingAnswerSnippet)}"
              </p>
              <p className="text-xs text-slate-500">Question: {e.relatedQuestionId}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Next Round Focus */}
      <Card variant="outlined">
        <h5 className="text-sm font-semibold text-slate-900 mb-3">Next Round Focus</h5>
        <ul className="space-y-2 text-sm text-slate-700">
            {report.nextRoundFocus.map((n, i) => (
              <li key={i} className="flex items-start">
                <span className="text-blue-600 mr-2 mt-0.5">•</span>
                {sanitizeForDisplaySync(n)}
              </li>
            ))}
        </ul>
      </Card>

      {/* Security Summary */}
      {report.securitySummary && (report.securitySummary.tabSwitchCount > 0 || report.securitySummary.securityEventCount > 0) && (
        <Card variant="outlined" className="border-red-200 bg-red-50/50">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-red-600" />
            <h5 className="text-sm font-semibold text-slate-900">Security Monitoring Summary</h5>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-slate-600 mb-1">Tab Switches</p>
              <p className="text-lg font-bold text-red-700">
                {report.securitySummary.tabSwitchCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-600 mb-1">Security Events</p>
              <p className="text-lg font-bold text-red-700">
                {report.securitySummary.securityEventCount}
              </p>
            </div>
          </div>

          {report.securitySummary.criticalEvents && report.securitySummary.criticalEvents.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-slate-900 mb-2">Critical Events Detected</p>
              <ul className="space-y-1">
                {report.securitySummary.criticalEvents.map((event, i) => (
                  <li key={i} className="flex items-start text-xs text-slate-700">
                    <AlertTriangle className="w-3 h-3 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span>{event.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.securitySummary.summary && (
            <div className="pt-3 border-t border-red-200">
              <p className="text-xs font-medium text-slate-900 mb-1">Security Assessment</p>
              <p className="text-xs text-slate-700 leading-relaxed">
                {sanitizeForDisplaySync(report.securitySummary.summary)}
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}


