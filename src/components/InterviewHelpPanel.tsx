"use client";

import { useState } from "react";
import { HelpCircle, X, Lightbulb, BookOpen, Target, MessageSquare, Code, Zap, CheckCircle2 } from "lucide-react";
import Card from "./Card";

type HelpPanelProps = {
  questionCategory?: string;
  questionDifficulty?: string;
};

export default function InterviewHelpPanel({ questionCategory, questionDifficulty }: HelpPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const generalTips = [
    {
      icon: <MessageSquare className="w-5 h-5" />,
      title: "Be Clear & Structured",
      tip: "Organize your thoughts before answering. Use bullet points or numbered lists to structure your response.",
    },
    {
      icon: <Target className="w-5 h-5" />,
      title: "Be Specific",
      tip: "Provide concrete examples from your experience. Avoid vague statements - use real projects, numbers, and outcomes.",
    },
    {
      icon: <Code className="w-5 h-5" />,
      title: "Show Your Process",
      tip: "For technical questions, explain your thinking process, not just the answer. Show how you approach problems.",
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Stay Focused",
      tip: "Answer the question asked. Stay on topic and avoid rambling. Quality over quantity.",
    },
  ];

  const categoryTips: Record<string, { title: string; tips: string[]; structure: string }> = {
    technical: {
      title: "Technical Questions",
      tips: [
        "Explain your approach step-by-step",
        "Discuss trade-offs and alternatives",
        "Mention relevant technologies or frameworks",
        "Include time/space complexity if applicable",
        "Provide code examples when helpful",
      ],
      structure: "1. Approach 2. Implementation details 3. Trade-offs 4. Example",
    },
    behavioral: {
      title: "Behavioral Questions",
      tips: [
        "Use the STAR method (Situation, Task, Action, Result)",
        "Be specific about your role and contributions",
        "Quantify your impact with numbers or metrics",
        "Show what you learned from the experience",
        "Connect your example to the job requirements",
      ],
      structure: "Situation → Task → Action → Result",
    },
    scenario: {
      title: "Scenario Questions",
      tips: [
        "Clarify assumptions before answering",
        "Consider multiple perspectives",
        "Discuss pros and cons of different approaches",
        "Show your problem-solving process",
        "Explain how you'd handle edge cases",
      ],
      structure: "1. Understand 2. Analyze 3. Propose solution 4. Consider alternatives",
    },
    experience: {
      title: "Experience Questions",
      tips: [
        "Provide concrete examples from your work",
        "Explain challenges you faced and how you overcame them",
        "Show growth and learning over time",
        "Highlight collaboration and teamwork",
        "Connect past experience to future potential",
      ],
      structure: "Context → Challenge → Solution → Impact",
    },
  };

  const difficultyTips: Record<string, string[]> = {
    easy: [
      "These questions test fundamental knowledge",
      "Be clear and concise - don't overcomplicate",
      "Provide straightforward, direct answers",
    ],
    medium: [
      "These require deeper understanding",
      "Show your reasoning process",
      "Consider multiple aspects of the problem",
    ],
    hard: [
      "These test advanced knowledge and problem-solving",
      "Break down complex problems into smaller parts",
      "It's okay to think out loud and show your process",
      "Don't be afraid to ask clarifying questions",
    ],
  };

  const currentCategory = questionCategory ? categoryTips[questionCategory] : null;
  const currentDifficulty = questionDifficulty ? difficultyTips[questionDifficulty] : null;

  return (
    <>
      {/* Help Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-[var(--primary)] text-white p-4 rounded-full shadow-lg hover:bg-[var(--primary-dark)] transition-all hover:scale-110 flex items-center gap-2"
        title="Get Help & Tips"
      >
        <HelpCircle className="w-6 h-6" />
        <span className="hidden sm:inline">Help</span>
      </button>

      {/* Help Panel Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto app-card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Lightbulb className="w-6 h-6 text-yellow-500" />
                <h2 className="text-2xl font-semibold text-[var(--text)]">Interview Tips & Help</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--text)] transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* General Tips */}
              <section>
                <h3 className="text-lg font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  General Best Practices
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {generalTips.map((tip, idx) => (
                    <div key={idx} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="text-blue-600 mt-0.5">{tip.icon}</div>
                        <div>
                          <h4 className="font-semibold text-[var(--text)] mb-1">{tip.title}</h4>
                          <p className="text-sm text-[var(--muted)]">{tip.tip}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Category-Specific Tips */}
              {currentCategory && (
                <section>
                  <h3 className="text-lg font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Tips for {currentCategory.title}
                  </h3>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-3">
                    <p className="text-sm font-medium text-[var(--text)] mb-2">Recommended Structure:</p>
                    <p className="text-sm text-[var(--muted)]">{currentCategory.structure}</p>
                  </div>
                  <ul className="space-y-2">
                    {currentCategory.tips.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-[var(--text)]">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Difficulty-Specific Tips */}
              {currentDifficulty && questionDifficulty && (
                <section>
                  <h3 className="text-lg font-semibold text-[var(--text)] mb-4">
                    Tips for {questionDifficulty.charAt(0).toUpperCase() + questionDifficulty.slice(1)} Difficulty
                  </h3>
                  <ul className="space-y-2">
                    {currentDifficulty.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-[var(--text)] p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <Lightbulb className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* All Category Tips */}
              <section>
                <h3 className="text-lg font-semibold text-[var(--text)] mb-4">Tips by Question Type</h3>
                <div className="space-y-4">
                  {Object.entries(categoryTips).map(([category, info]) => (
                    <details key={category} className="border border-[var(--border)] rounded-lg p-4">
                      <summary className="font-semibold text-[var(--text)] cursor-pointer">
                        {info.title}
                      </summary>
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-[var(--muted)] mb-2">Structure: {info.structure}</p>
                        <ul className="space-y-1">
                          {info.tips.map((tip, idx) => (
                            <li key={idx} className="text-sm text-[var(--text)] flex items-start gap-2">
                              <span className="text-[var(--primary)]">•</span>
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </details>
                  ))}
                </div>
              </section>

              {/* Common Mistakes to Avoid */}
              <section>
                <h3 className="text-lg font-semibold text-[var(--text)] mb-4">Common Mistakes to Avoid</h3>
                <div className="space-y-2">
                  {[
                    "Rambling without structure - organize your thoughts first",
                    "Being too vague - use specific examples and numbers",
                    "Not answering the question - stay focused on what's asked",
                    "Giving up too quickly - show your problem-solving process",
                    "Not proofreading - check for clarity and typos",
                  ].map((mistake, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-[var(--text)] p-2 bg-red-50 border border-red-200 rounded">
                      <X className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <span>{mistake}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="mt-6 pt-6 border-t border-[var(--border)]">
              <button
                onClick={() => setIsOpen(false)}
                className="app-btn-primary w-full px-6 py-2.5"
              >
                Got it! Let's continue
              </button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

