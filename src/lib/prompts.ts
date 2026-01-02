import { InterviewMode, RoleLevel, InterviewQuestion, InterviewEvaluation, InterviewAnswer } from "./types";

export function buildQuestionGenPrompt(args: {
  mode: InterviewMode;
  role?: string;
  level?: RoleLevel;
  resumeText: string;
  jdText?: string;
  count: number;
}) {
  const { mode, role, level, resumeText, jdText, count } = args;

  const context = [
    `You are an expert interviewer. Generate ${count} interview questions.`,
    `Return ONLY valid JSON (no markdown) with this exact shape:`,
    `{"questions":[{"id":"q1","text":"...","category":"experience|technical|scenario|behavioral","difficulty":"easy|medium|hard"}]}`,
    `Guidelines:`,
    `- Questions must be specific and role-relevant.`,
    `- Include a mix of experience + technical + scenario + behavioral.`,
    `- Keep each question under 35 words.`,
    `- No preamble, no commentary, JSON only.`,
  ].join("\n");

  const roleInfo =
    mode === "open"
      ? `Role: ${role}\nLevel: ${level}`
      : `Mode: company\nUse the JD + resume alignment to tailor questions.`;

  const jdBlock = jdText ? `\nJOB DESCRIPTION:\n${jdText}\n` : "";
  const resumeBlock = `\nRESUME:\n${resumeText}\n`;

  return `${context}\n\n${roleInfo}\n${jdBlock}${resumeBlock}`;
}

export function buildAnswerEvalPrompt(args: {
  mode: InterviewMode;
  role?: string;
  level?: RoleLevel;
  resumeText: string;
  jdText?: string;
  question: InterviewQuestion;
  answerText: string;
}) {
  const { mode, role, level, resumeText, jdText, question, answerText } = args;

  const instructions = [
    "You are an expert interviewer and evaluator.",
    "Evaluate the candidate answer to the given interview question.",
    "Return ONLY valid JSON (no markdown, no commentary).",
    "Use this exact JSON shape:",
    JSON.stringify(
      {
        questionId: "q1",
        scores: { technical: 0, communication: 0, problemSolving: 0 },
        overall: 0,
        strengths: ["..."],
        gaps: ["..."],
        followUpQuestion: "...",
      },
      null,
      2
    ),
    "Scoring rules:",
    "- technical, communication, problemSolving: integer 0 to 10",
    "- overall: integer 0 to 10; compute as a balanced judgment of the three",
    "- strengths and gaps: 2 to 4 short bullets each",
    "- followUpQuestion: one specific follow-up question based on gaps",
    "Be strict and consistent. Penalize vague, generic, or incorrect answers.",
  ].join("\n");

  const roleInfo =
    mode === "open"
      ? `Role: ${role}\nLevel: ${level}`
      : "Mode: company\nUse JD-resume alignment to judge relevance.";

  const jdBlock = jdText ? `\nJOB DESCRIPTION:\n${jdText}\n` : "";
  const resumeBlock = `\nRESUME:\n${resumeText}\n`;

  const qaBlock = [
    `QUESTION (${question.category}, ${question.difficulty}):`,
    question.text,
    "",
    "CANDIDATE ANSWER:",
    answerText,
  ].join("\n");

  return `${instructions}\n\n${roleInfo}\n${jdBlock}${resumeBlock}\n${qaBlock}`;
}

export function buildReportPrompt(args: {
  mode: InterviewMode;
  role?: string;
  level?: RoleLevel;
  resumeText: string;
  jdText?: string;
  questions: InterviewQuestion[];
  answers: InterviewAnswer[];
  evaluations: InterviewEvaluation[];
  scoreSummary: { countEvaluated: number; avg: { technical: number; communication: number; problemSolving: number; overall: number } };
}) {
  const { mode, role, level, resumeText, jdText, questions, answers, evaluations, scoreSummary } = args;

  const instructions = [
    "You are a senior hiring manager writing an interview debrief report.",
    "Use the provided interview Q&A and evaluations.",
    "Return ONLY valid JSON (no markdown).",
    "Use this exact JSON shape:",
    JSON.stringify(
      {
        recommendation: "hire",
        confidence: 0,
        executiveSummary: "string",
        strengths: ["..."],
        gapsAndRisks: ["..."],
        evidence: [
          { claim: "string", supportingAnswerSnippet: "string", relatedQuestionId: "q1", evidenceType: "technical" }
        ],
        nextRoundFocus: ["..."]
      },
      null,
      2
    ),
    "Rules:",
    "- recommendation must be one of: strong_hire, hire, borderline, no_hire",
    "- confidence must be integer 0-100. Calibrate based on scoreSummary:",
    "  * If countEvaluated < 3, max confidence 70",
    "  * If countEvaluated 3-5, max confidence 85",
    "  * If countEvaluated >= 6, max confidence 95",
    "  * If overallAvg < 7, max confidence 80",
    "  * If overallAvg < 8, max confidence 90",
    "- executiveSummary 2-4 lines, concise and specific",
    "- strengths: EXACTLY 4-7 bullets, short and concrete. Each must reference something specific from transcript/evaluations.",
    "- gapsAndRisks: EXACTLY 4-7 bullets, short and concrete. Avoid generic filler like 'adapt to company tools', 'needs more depth', 'could improve', 'may need' unless followed by concrete technology/example.",
    "- evidence: 3-6 items. Each item must include:",
    "  * claim: short statement",
    "  * supportingAnswerSnippet: short snippet from answer (max 160 chars)",
    "  * relatedQuestionId: question ID",
    "  * evidenceType: one of 'technical', 'leadership', 'communication', 'problem_solving'",
    "- nextRoundFocus: 4-6 bullets",
    "- Base your claims on the answers. Do not invent. Reference specific examples from the transcript."
  ].join("\n");

  const roleInfo =
    mode === "open"
      ? `Role: ${role}\nLevel: ${level}`
      : "Mode: company\nUse JD-resume alignment.";

  const jdBlock = jdText ? `\nJOB DESCRIPTION:\n${jdText}\n` : "";
  const resumeBlock = `\nRESUME:\n${resumeText}\n`;

  const qMap = new Map(questions.map((q) => [q.id, q]));
  const aMap = new Map(answers.map((a) => [a.questionId, a]));
  const eMap = new Map(evaluations.map((e) => [e.questionId, e]));

  const transcript = questions
    .map((q) => {
      const a = aMap.get(q.id);
      const e = eMap.get(q.id);
      return [
        `QID: ${q.id}`,
        `Q: ${q.text}`,
        `A: ${a?.text ?? ""}`,
        e
          ? `Eval: overall=${e.overall} tech=${e.scores.technical} comm=${e.scores.communication} ps=${e.scores.problemSolving}`
          : "Eval: none",
        ""
      ].join("\n");
    })
    .join("\n");

  const scoreBlock = `SCORE SUMMARY:\nCountEvaluated=${scoreSummary.countEvaluated}, OverallAvg=${scoreSummary.avg.overall}, TechAvg=${scoreSummary.avg.technical}, CommsAvg=${scoreSummary.avg.communication}, PSAvg=${scoreSummary.avg.problemSolving}`;

  return `${instructions}\n\n${roleInfo}\n${jdBlock}${resumeBlock}\n${scoreBlock}\n\nINTERVIEW TRANSCRIPT:\n${transcript}`;
}

