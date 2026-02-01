export type InterviewMode = "company" | "college" | "individual";

export type RoleLevel = "junior" | "mid" | "senior";

export type InterviewQuestion = {
  id: string;
  text: string;
  category: "experience" | "technical" | "scenario" | "behavioral";
  difficulty: "easy" | "medium" | "hard";
  displayedAt?: number; // When question was first displayed to candidate
};

export type InterviewAnswer = {
  questionId: string;
  text: string;
  submittedAt: number;
  timeSpent?: number; // Time in seconds from question display to answer submission
  isSuspiciouslyFast?: boolean; // Flagged if answered too quickly (< 10s for hard, < 5s for easy/medium)
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

// New: Interview configuration
export type InterviewConfig = {
  questionCount: 5 | 10 | 15 | 20 | 25;
  difficultyCurve: "easy_to_hard" | "balanced" | "custom";
  customDifficulty?: ("easy" | "medium" | "hard")[];
};

// New: Job setup structure
export type JobSetup = {
  jdText?: string; // Required for company mode, optional for individual
  topSkills?: string[]; // Required for company mode, optional for individual (Max 5)
  config: InterviewConfig;
  resumeText?: string; // For company/individual mode
};

// New: College job template
export type CollegeJobTemplate = {
  id: string;
  collegeId?: string;
  jdText: string;
  topSkills: string[];
  config: InterviewConfig;
  createdAt: number;
  createdBy?: string;
};

// New: Candidate batch for college mode
export type CandidateBatch = {
  id: string;
  jobTemplateId: string;
  collegeId?: string;
  candidates: Array<{
    email: string;
    name: string;
    studentId?: string;
    sessionId?: string;
    status?: "pending" | "in_progress" | "completed";
    completedAt?: number;
    linkSentAt?: number;
  }>;
  createdAt: number;
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
  // New fields
  jobSetup?: JobSetup;
  collegeJobTemplateId?: string;
  candidateEmail?: string;
  candidateName?: string;
  studentId?: string;
  tabSwitchCount?: number; // For cheating detection
  tabSwitchEvents?: Array<{ timestamp: number; type: "blur" | "focus" }>;
  lastActivityAt?: number; // Last activity timestamp for session timeout
  startedAt?: number; // When interview was actually started (questions generated)
  questionTimings?: Array<{
    questionId: string;
    displayedAt: number;
    answeredAt?: number;
    timeSpent?: number;
  }>; // Detailed timing per question
};

