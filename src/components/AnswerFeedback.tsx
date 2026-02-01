"use client";

import { CheckCircle2, AlertCircle, TrendingUp, Lightbulb } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";

type AnswerFeedbackProps = {
  evaluation: {
    scores: { technical: number; communication: number; problemSolving: number };
    overall: number;
    strengths: string[];
    gaps: string[];
    followUpQuestion?: string;
  };
  questionCategory: string;
};

export default function AnswerFeedback({ evaluation, questionCategory }: AnswerFeedbackProps) {
  const { scores, overall, strengths, gaps } = evaluation;

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 6) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return "Excellent";
    if (score >= 6) return "Good";
    if (score >= 4) return "Needs Improvement";
    return "Poor";
  };

  const improvementTips: Record<string, string[]> = {
    technical: [
      "Provide more technical depth in your explanations",
      "Include code examples or pseudocode when relevant",
      "Discuss time/space complexity for algorithms",
      "Mention relevant technologies and frameworks",
    ],
    communication: [
      "Structure your answer more clearly",
      "Use transitions between ideas",
      "Be more concise and avoid rambling",
      "Proofread for clarity and grammar",
    ],
    problemSolving: [
      "Show your thinking process step-by-step",
      "Consider edge cases and alternatives",
      "Break down complex problems into smaller parts",
      "Explain your reasoning, not just the answer",
    ],
  };

  const categoryTips = improvementTips[questionCategory] || improvementTips.communication;

  return (
    <Card className="app-card border-2 border-blue-200 bg-blue-50/50">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--text)] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Your Answer Feedback
          </h3>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${getScoreColor(overall)}`}>
              {overall.toFixed(1)}/10
            </span>
            <Badge variant={overall >= 8 ? "success" : overall >= 6 ? "info" : "warning"}>
              {getScoreLabel(overall)}
            </Badge>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-white rounded-lg border border-[var(--border)]">
            <p className="text-xs text-[var(--muted)] mb-1">Technical</p>
            <p className={`text-lg font-semibold ${getScoreColor(scores.technical)}`}>
              {scores.technical.toFixed(1)}
            </p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-[var(--border)]">
            <p className="text-xs text-[var(--muted)] mb-1">Communication</p>
            <p className={`text-lg font-semibold ${getScoreColor(scores.communication)}`}>
              {scores.communication.toFixed(1)}
            </p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-[var(--border)]">
            <p className="text-xs text-[var(--muted)] mb-1">Problem Solving</p>
            <p className={`text-lg font-semibold ${getScoreColor(scores.problemSolving)}`}>
              {scores.problemSolving.toFixed(1)}
            </p>
          </div>
        </div>

        {/* Strengths */}
        {strengths.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              What You Did Well
            </h4>
            <ul className="space-y-1">
              {strengths.map((strength, idx) => (
                <li key={idx} className="text-sm text-[var(--text)] flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Areas for Improvement */}
        {gaps.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-orange-700 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Areas to Improve
            </h4>
            <ul className="space-y-1">
              {gaps.map((gap, idx) => (
                <li key={idx} className="text-sm text-[var(--text)] flex items-start gap-2">
                  <span className="text-orange-600 mt-1">•</span>
                  <span>{gap}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Improvement Tips */}
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="text-sm font-semibold text-yellow-800 mb-2 flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            Tips for Next Time
          </h4>
          <ul className="space-y-1">
            {categoryTips.slice(0, 3).map((tip, idx) => (
              <li key={idx} className="text-xs text-yellow-700 flex items-start gap-2">
                <span>💡</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

