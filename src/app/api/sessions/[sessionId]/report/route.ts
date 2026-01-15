import { NextResponse } from "next/server";
import { getSession, updateSession, logAudit } from "@/lib/unifiedStore";
import { getOpenAI } from "@/lib/openai";
import { buildReportPrompt } from "@/lib/prompts";
import { InterviewReport } from "@/lib/types";
import { apiSuccess, apiError } from "@/lib/apiResponse";

// Configure for production
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60; // Report generation can take time

function clampInt(n: unknown, min: number, max: number) {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.round(x)));
}

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const sliced = raw.slice(start, end + 1);
      return JSON.parse(sliced);
    }
    throw new Error("Invalid JSON");
  }
}

function isGenericFiller(text: string): boolean {
  const lower = text.toLowerCase();
  const genericPatterns = [
    "adapt to company tools",
    "needs more depth",
    "could improve",
    "may need",
    "no direct experience mentioned",
    "might need",
    "could benefit from",
    "may require",
  ];
  // Check if it's a generic pattern without concrete technology/example
  for (const pattern of genericPatterns) {
    if (lower.includes(pattern)) {
      // Allow if followed by concrete tech (e.g., "may need React experience")
      const afterPattern = lower.substring(lower.indexOf(pattern) + pattern.length);
      const hasConcreteTech = /(react|node|python|java|aws|docker|kubernetes|sql|typescript|javascript)/i.test(afterPattern);
      if (!hasConcreteTech && afterPattern.length < 30) {
        return true;
      }
    }
  }
  return false;
}

function normalizeReport(parsed: any, scoreSummary: { countEvaluated: number; avg: { overall: number } }, securityEvents?: Array<{ event: string; timestamp: number; details?: Record<string, any> }>, tabSwitchCount?: number): InterviewReport {
  const rec = String(parsed?.recommendation ?? "borderline");
  const allowed = new Set(["strong_hire", "hire", "borderline", "no_hire"]);
  const recommendation = allowed.has(rec) ? (rec as any) : "borderline";

  // Clamp and cap confidence based on scoreSummary
  let confidence = clampInt(parsed?.confidence, 0, 100);
  
  // Cap based on countEvaluated
  if (scoreSummary.countEvaluated < 3) {
    confidence = Math.min(confidence, 70);
  } else if (scoreSummary.countEvaluated < 6) {
    confidence = Math.min(confidence, 85);
  } else {
    confidence = Math.min(confidence, 95);
  }
  
  // Cap based on overallAvg
  if (scoreSummary.avg.overall < 7) {
    confidence = Math.min(confidence, 80);
  } else if (scoreSummary.avg.overall < 8) {
    confidence = Math.min(confidence, 90);
  }

  const executiveSummary = String(parsed?.executiveSummary ?? "").slice(0, 600);

  // Filter and clamp strengths to 4-7
  let strengths = Array.isArray(parsed?.strengths)
    ? parsed.strengths.map((s: any) => String(s).slice(0, 160)).filter((s: string) => s.length > 0)
    : [];
  
  // Ensure 4-7 items
  if (strengths.length < 4) {
    const fallbacks = [
      `Strong technical foundation (avg score: ${scoreSummary.avg.overall.toFixed(1)})`,
      "Clear communication demonstrated in answers",
      "Structured problem-solving approach visible",
      "Relevant experience highlighted",
    ];
    strengths = [...strengths, ...fallbacks].slice(0, 7);
  }
  strengths = strengths.slice(0, 7);

  // Filter generic filler and clamp gapsAndRisks to 4-7
  let gapsAndRisks = Array.isArray(parsed?.gapsAndRisks)
    ? parsed.gapsAndRisks
        .map((s: any) => String(s).slice(0, 160))
        .filter((s: string) => s.length > 0 && !isGenericFiller(s))
    : [];
  
  // Ensure 4-7 items
  if (gapsAndRisks.length < 4) {
    const fallbacks = [
      `Overall performance at ${scoreSummary.avg.overall.toFixed(1)}/10 suggests areas for improvement`,
      "Limited evidence in some technical areas",
      "Could provide more concrete examples with metrics",
      "Some answers lacked specific implementation details",
    ];
    gapsAndRisks = [...gapsAndRisks, ...fallbacks].slice(0, 7);
  }
  gapsAndRisks = gapsAndRisks.slice(0, 7);

  // Normalize evidence with evidenceType
  const evidence = Array.isArray(parsed?.evidence)
    ? parsed.evidence
        .map((e: any) => {
          const evidenceType = String(e?.evidenceType ?? "technical").toLowerCase();
          const allowedTypes = ["technical", "leadership", "communication", "problem_solving"];
          const validType = allowedTypes.includes(evidenceType) ? evidenceType : "technical";
          
          return {
            claim: String(e?.claim ?? "").slice(0, 160),
            supportingAnswerSnippet: String(e?.supportingAnswerSnippet ?? "").slice(0, 160),
            relatedQuestionId: String(e?.relatedQuestionId ?? "").slice(0, 40),
            evidenceType: validType as "technical" | "leadership" | "communication" | "problem_solving",
          };
        })
        .filter((e: any) => e.claim && e.supportingAnswerSnippet && e.relatedQuestionId)
        .slice(0, 6)
    : [];

  const nextRoundFocus = Array.isArray(parsed?.nextRoundFocus)
    ? parsed.nextRoundFocus.map((s: any) => String(s).slice(0, 160)).slice(0, 6)
    : [];

  // Normalize security summary
  let securitySummary: InterviewReport["securitySummary"] = undefined;
  const securityEventCount = securityEvents?.length || 0;
  const tabSwitches = tabSwitchCount || 0;
  
  if (tabSwitches > 0 || securityEventCount > 0) {
    const criticalEvents = securityEvents?.filter(e => 
      ["devtools_detected", "screenshot_attempt", "clipboard_write", "keyboard_shortcut_blocked", "right_click_blocked"].includes(e.event)
    ).map(e => e.event) || [];
    
    securitySummary = {
      tabSwitchCount: tabSwitches,
      securityEventCount: securityEventCount,
      criticalEvents: Array.isArray(parsed?.securitySummary?.criticalEvents) 
        ? parsed.securitySummary.criticalEvents.map((e: any) => String(e)).slice(0, 10)
        : criticalEvents.slice(0, 10),
      summary: String(parsed?.securitySummary?.summary || "").slice(0, 300) || 
        `Interview monitoring detected ${tabSwitches} tab switch${tabSwitches > 1 ? "es" : ""} and ${securityEventCount} security event${securityEventCount > 1 ? "s" : ""}. ${criticalEvents.length > 0 ? `Critical events include: ${criticalEvents.join(", ")}.` : ""} These may indicate potential integrity concerns that should be considered in the hiring decision.`,
    };
  }

  return {
    recommendation,
    confidence,
    executiveSummary: executiveSummary || "Summary not available.",
    strengths: strengths.length >= 4 ? strengths : [
      `Strong technical foundation (avg score: ${scoreSummary.avg.overall.toFixed(1)})`,
      "Clear communication demonstrated in answers",
      "Structured problem-solving approach visible",
      "Relevant experience highlighted",
    ].slice(0, 7),
    gapsAndRisks: gapsAndRisks.length >= 4 ? gapsAndRisks : [
      `Overall performance at ${scoreSummary.avg.overall.toFixed(1)}/10 suggests areas for improvement`,
      "Limited evidence in some technical areas",
      "Could provide more concrete examples with metrics",
      "Some answers lacked specific implementation details",
    ].slice(0, 7),
    evidence: evidence.length
      ? evidence
      : [
          {
            claim: "Limited evidence captured in this session.",
            supportingAnswerSnippet: "Provide more detailed examples in the next round.",
            relatedQuestionId: "n/a",
            evidenceType: "technical" as const,
          },
        ],
    nextRoundFocus: nextRoundFocus.length ? nextRoundFocus : ["Ask for concrete examples and metrics."],
    securitySummary,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  const session = await getSession(params.sessionId);
  if (!session) {
    return apiError("Session not found", "The requested session does not exist", 404);
  }

  return apiSuccess({ 
    report: session.report ?? null, 
    status: session.status,
    scoreSummary: session.scoreSummary,
    shareToken: session.shareToken ?? null,
  });
}

export async function POST(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  const session = await getSession(params.sessionId);
  if (!session) {
    return apiError("Session not found", "The requested session does not exist", 404);
  }

  if (session.status !== "completed") {
    return apiError(
      "Interview not completed",
      "The interview must be completed before generating a report",
      400
    );
  }

  // If already generated, return it
  if (session.report) {
    return apiSuccess(
      { report: session.report, cached: true },
      "Report retrieved from cache"
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return apiError(
      "Configuration error",
      "OPENAI_API_KEY is not configured",
      500
    );
  }

  const prompt = buildReportPrompt({
    mode: session.mode,
    role: session.role,
    level: session.level,
    resumeText: session.resumeText,
    jdText: session.jdText,
    questions: session.questions,
    answers: session.answers,
    evaluations: session.evaluations,
    scoreSummary: session.scoreSummary,
    securityEvents: session.securityEvents,
    tabSwitchCount: session.tabSwitchCount,
  });

  const openai = getOpenAI();
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" } as any,
    messages: [
      { role: "system", content: "Return JSON only. No markdown." },
      { role: "user", content: prompt },
    ],
  });

  const raw = resp.choices[0]?.message?.content ?? "";
  let parsed: any;

  try {
    parsed = safeJsonParse(raw);
  } catch {
    return NextResponse.json({ error: "Failed to parse report JSON", raw }, { status: 500 });
  }

  const report = normalizeReport(parsed, session.scoreSummary, session.securityEvents, session.tabSwitchCount);

  // Generate shareToken if not present
  const shareToken = session.shareToken || crypto.randomUUID().replaceAll("-", "");

  await updateSession(params.sessionId, (s) => ({ ...s, report, shareToken }));

  return NextResponse.json({ ok: true, report, cached: false, shareToken });
}

