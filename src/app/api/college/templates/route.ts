import { NextResponse } from "next/server";
import { createTemplate, getTemplate, getAllTemplates, logAudit } from "@/lib/unifiedStore";
import { CollegeJobTemplate, InterviewConfig } from "@/lib/types";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { sanitizeForStorage } from "@/lib/sanitize";

// Configure for production
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30; // Template operations should be fast

function randomId() {
  return crypto.randomUUID();
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return apiError("Invalid JSON", "Request body must be valid JSON", 400);
  }

  const rawJdText = String(body.jdText ?? "").trim();
  if (!rawJdText || rawJdText.length < 50) {
    return apiError(
      "Validation failed",
      "Job description is required (min 50 chars)",
      400
    );
  }
  // Sanitize JD text before storing
  const jdText = await sanitizeForStorage(rawJdText);

  const topSkills = Array.isArray(body.topSkills) 
    ? (await Promise.all(body.topSkills.map((s: any) => sanitizeForStorage(String(s).trim())))).filter((s: string) => s.length > 0).slice(0, 5)
    : [];
  
  if (topSkills.length === 0) {
    return apiError(
      "Validation failed",
      "At least one skill is required",
      400
    );
  }

  const config = body.config as InterviewConfig;
  if (!config || !config.questionCount || !config.difficultyCurve) {
    return apiError(
      "Validation failed",
      "Interview configuration is required",
      400
    );
  }

  const template: CollegeJobTemplate = {
    id: randomId(),
    jdText,
    topSkills,
    config: {
      questionCount: config.questionCount,
      difficultyCurve: config.difficultyCurve,
      customDifficulty: config.customDifficulty,
    },
    createdAt: Date.now(),
  };

  await createTemplate(template);

  await logAudit('template_created', 'template', template.id, {
    college_id: template.collegeId,
  });

  return apiSuccess(
    { templateId: template.id },
    "Template created successfully",
    201
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const templateId = searchParams.get("id");

  if (templateId) {
    const template = await getTemplate(templateId);
    if (!template) {
      return apiError("Template not found", "The requested template does not exist", 404);
    }
    return apiSuccess({ template });
  }

  // Return all templates
  const templates = await getAllTemplates();
  return apiSuccess({ templates });
}

