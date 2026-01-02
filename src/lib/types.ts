export type InterviewMode = "company" | "open";

export type RoleLevel = "junior" | "mid" | "senior";

export type InterviewQuestion = {
  id: string;
  text: string;
  category: "experience" | "technical" | "scenario" | "behavioral";
  difficulty: "easy" | "medium" | "hard";
};

export type InterviewAnswer = {
  questionId: string;
  text: string;
  submittedAt: number;
};

export type InterviewEvaluation = {
  questionId: string;
  // 0-10 each
  scores: {
    technical: number;
    communication: number;
    problemSolving: number;
  };
  // 0-10 computed
  overall: number;
  // concise feedback
  strengths: string[];
  gaps: string[];
  followUpQuestion: string; // one suggested follow-up
};

export type ScoreSummary = {
  countEvaluated: number;
  avg: {
    technical: number;
    communication: number;
    problemSolving: number;
    overall: number;
  };
};

export type HireRecommendation = "strong_hire" | "hire" | "borderline" | "no_hire";

export type InterviewReport = {
  recommendation: HireRecommendation;
  confidence: number; // 0-100
  executiveSummary: string; // 2-4 lines
  strengths: string[]; // 4-7 bullets
  gapsAndRisks: string[]; // 4-7 bullets
  evidence: Array<{
    claim: string; // short statement
    supportingAnswerSnippet: string; // short snippet from answer
    relatedQuestionId: string;
    evidenceType: "technical" | "leadership" | "communication" | "problem_solving";
  }>;
  nextRoundFocus: string[]; // 4-6 bullets
};

export type InterviewSession = {
  id: string;
  mode: InterviewMode;
  createdAt: number;
  resumeText: string;
  jdText?: string;
  role?: string;
  level?: RoleLevel;
  status: "created" | "in_progress" | "completed";
  questions: InterviewQuestion[];
  currentQuestionIndex: number;
  answers: InterviewAnswer[];
  evaluations: InterviewEvaluation[];
  scoreSummary: ScoreSummary;
  report?: InterviewReport;
  shareToken?: string;
  presence?: {
    photoDataUrl?: string;
    phrasePrompt?: string;
    phraseTranscript?: string;
    completedAt?: number;
  };
};

