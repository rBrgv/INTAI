import { NextRequest } from "next/server";
import { getTemplate, createTemplate, logAudit } from "@/lib/unifiedStore";
import { requireAuthAPI } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { sanitizeForStorage } from "@/lib/sanitize";
import { CollegeJobTemplate, InterviewConfig } from "@/lib/types";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const session = requireAuthAPI(req);

    const template = await getTemplate(params.templateId);
    if (!template) {
      return apiError("Template not found", "The requested template does not exist", 404);
    }

    // Verify template belongs to college
    if (template.collegeId && template.collegeId !== session.collegeId) {
      return apiError("Forbidden", "You don't have access to this template", 403);
    }

    return apiSuccess({ template });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return apiError("Unauthorized", "Please log in to access this resource", 401);
    }
    return apiError("Internal server error", error instanceof Error ? error.message : "An unexpected error occurred", 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const session = requireAuthAPI(req);

    const body = await req.json().catch(() => null);
    if (!body) {
      return apiError("Invalid JSON", "Request body must be valid JSON", 400);
    }

    const existingTemplate = await getTemplate(params.templateId);
    if (!existingTemplate) {
      return apiError("Template not found", "The requested template does not exist", 404);
    }

    // Verify template belongs to college
    if (existingTemplate.collegeId && existingTemplate.collegeId !== session.collegeId) {
      return apiError("Forbidden", "You don't have access to this template", 403);
    }

    const rawJdText = String(body.jdText ?? existingTemplate.jdText).trim();
    if (!rawJdText || rawJdText.length < 50) {
      return apiError(
        "Validation failed",
        "Job description is required (min 50 chars)",
        400
      );
    }

    const jdText = sanitizeForStorage(rawJdText);

    const topSkills = Array.isArray(body.topSkills)
      ? body.topSkills.map((s: any) => sanitizeForStorage(String(s).trim())).filter((s: string) => s.length > 0).slice(0, 5)
      : existingTemplate.topSkills;

    if (topSkills.length === 0) {
      return apiError(
        "Validation failed",
        "At least one skill is required",
        400
      );
    }

    const config = body.config as InterviewConfig || existingTemplate.config;
    if (!config || !config.questionCount || !config.difficultyCurve) {
      return apiError(
        "Validation failed",
        "Interview configuration is required",
        400
      );
    }

    // Update in Supabase if configured
    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase
        .from('college_job_templates')
        .update({
          jd_text: jdText,
          top_skills: topSkills,
          config: {
            questionCount: config.questionCount,
            difficultyCurve: config.difficultyCurve,
            customDifficulty: config.customDifficulty,
          },
        })
        .eq('id', params.templateId)
        .eq('college_id', session.collegeId);

      if (error) {
        logger.error('Error updating template', error instanceof Error ? error : new Error(String(error)), { templateId: params.templateId });
        return apiError("Failed to update template", "Database error", 500);
      }

      await logAudit('template_updated', 'template', params.templateId, {
        college_id: session.collegeId,
      });

      const updatedTemplate: CollegeJobTemplate = {
        ...existingTemplate,
        jdText,
        topSkills,
        config: {
          questionCount: config.questionCount,
          difficultyCurve: config.difficultyCurve,
          customDifficulty: config.customDifficulty,
        },
      };

      return apiSuccess({ template: updatedTemplate }, "Template updated successfully");
    }

    // Fallback: Create new template with same ID (for in-memory store)
    // Note: In-memory store doesn't support updates, so we'd need to implement that
    return apiError("Update not supported", "Template updates require database configuration", 500);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return apiError("Unauthorized", "Please log in to access this resource", 401);
    }
    return apiError("Internal server error", error instanceof Error ? error.message : "An unexpected error occurred", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const session = requireAuthAPI(req);

    const template = await getTemplate(params.templateId);
    if (!template) {
      return apiError("Template not found", "The requested template does not exist", 404);
    }

    // Verify template belongs to college
    if (template.collegeId && template.collegeId !== session.collegeId) {
      return apiError("Forbidden", "You don't have access to this template", 403);
    }

    // Delete from Supabase if configured
    if (isSupabaseConfigured() && supabase) {
      // Use soft delete to prevent FK errors with candidate_batches
      const { error } = await supabase
        .from('college_job_templates')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', params.templateId)
        .eq('college_id', session.collegeId);

      if (error) {
        logger.error('Error deleting template', error instanceof Error ? error : new Error(String(error)), { templateId: params.templateId });
        return apiError("Failed to delete template", "Database error", 500);
      }

      await logAudit('template_deleted', 'template', params.templateId, {
        college_id: session.collegeId,
      });

      return apiSuccess({}, "Template deleted successfully");
    }

    return apiError("Delete not supported", "Template deletion requires database configuration", 500);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return apiError("Unauthorized", "Please log in to access this resource", 401);
    }
    return apiError("Internal server error", error instanceof Error ? error.message : "An unexpected error occurred", 500);
  }
}

