import { ArrowRight, CheckCircle2, FileDown } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import { sanitizeForDisplay } from "@/lib/sanitize";

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
  // For candidate view, hide "no_hire" recommendation and show "borderline" instead
  const displayRecommendation = viewType === "candidate" && report.recommendation === "no_hire" 
    ? "borderline" 
    : report.recommendation;

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
      {/* Export Button - At the top */}
      {!readOnly && (
        <div className="flex justify-end no-print mb-2">
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
          {sanitizeForDisplay(report.executiveSummary)}
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
                {sanitizeForDisplay(g)}
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
                <p className="text-sm font-medium text-slate-900 flex-1">{sanitizeForDisplay(e.claim)}</p>
                <Badge variant="info" className="ml-2">
                  {(e.evidenceType || "technical").replace("_", " ")}
                </Badge>
              </div>
              <p className="text-sm text-slate-600 italic mb-1">
                "{sanitizeForDisplay(e.supportingAnswerSnippet)}"
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
                {sanitizeForDisplay(n)}
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}


