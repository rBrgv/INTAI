import { NextRequest } from "next/server";
import { createTemplate, getTemplate, getAllTemplates, logAudit } from "@/lib/unifiedStore";
import { CollegeJobTemplate, InterviewConfig } from "@/lib/types";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { sanitizeForStorage } from "@/lib/sanitize";
import { requireAuthAPI } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

function randomId() {
  return crypto.randomUUID();
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuthAPI(req);
    
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
    const jdText = sanitizeForStorage(rawJdText);

    const topSkills = Array.isArray(body.topSkills) 
      ? body.topSkills.map((s: any) => sanitizeForStorage(String(s).trim())).filter((s: string) => s.length > 0).slice(0, 5)
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
      collegeId: session.collegeId,
      jdText,
      topSkills,
      config: {
        questionCount: config.questionCount,
        difficultyCurve: config.difficultyCurve,
        customDifficulty: config.customDifficulty,
      },
      createdAt: Date.now(),
      createdBy: session.userEmail,
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
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return apiError("Unauthorized", "Please log in to access this resource", 401);
    }
    return apiError("Internal server error", error instanceof Error ? error.message : "An unexpected error occurred", 500);
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = requireAuthAPI(req);
    
    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get("id");

    if (templateId) {
      const template = await getTemplate(templateId);
      if (!template) {
        return apiError("Template not found", "The requested template does not exist", 404);
      }
      
      // Verify template belongs to college
      if (template.collegeId && template.collegeId !== session.collegeId) {
        return apiError("Forbidden", "You don't have access to this template", 403);
      }
      
      return apiSuccess({ template });
    }

    // Return all templates for this college
    if (isSupabaseConfigured() && supabase) {
      const { data: templates, error } = await supabase
        .from('college_job_templates')
        .select('*')
        .eq('college_id', session.collegeId)
        .order('created_at', { ascending: false });
      
      if (error) {
        // Fallback to unified store
        const allTemplates = await getAllTemplates();
        const filtered = allTemplates.filter(t => t.collegeId === session.collegeId);
        return apiSuccess({ templates: filtered });
      }
      
      // Map Supabase format to our type
      const mappedTemplates: CollegeJobTemplate[] = (templates || []).map((t: any) => ({
        id: t.id,
        collegeId: t.college_id,
        jdText: t.jd_text,
        topSkills: t.top_skills || [],
        config: t.config || {},
        createdAt: new Date(t.created_at).getTime(),
        createdBy: t.created_by,
      }));
      
      return apiSuccess({ templates: mappedTemplates });
    }
    
    // Fallback to unified store
    const allTemplates = await getAllTemplates();
    const filtered = allTemplates.filter(t => t.collegeId === session.collegeId);
    return apiSuccess({ templates: filtered });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return apiError("Unauthorized", "Please log in to access this resource", 401);
    }
    return apiError("Internal server error", error instanceof Error ? error.message : "An unexpected error occurred", 500);
  }
}

