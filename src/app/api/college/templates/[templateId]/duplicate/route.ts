import { NextRequest } from "next/server";
import { getTemplate, createTemplate } from "@/lib/unifiedStore";
import { requireAuthAPI } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { CollegeJobTemplate } from "@/lib/types";

function randomId() {
  return crypto.randomUUID();
}

export async function POST(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const session = requireAuthAPI(req);
    
    const existingTemplate = await getTemplate(params.templateId);
    if (!existingTemplate) {
      return apiError("Template not found", "The requested template does not exist", 404);
    }

    // Verify template belongs to college
    if (existingTemplate.collegeId && existingTemplate.collegeId !== session.collegeId) {
      return apiError("Forbidden", "You don't have access to this template", 403);
    }

    // Create duplicate
    const duplicate: CollegeJobTemplate = {
      id: randomId(),
      collegeId: session.collegeId,
      jdText: existingTemplate.jdText,
      topSkills: [...existingTemplate.topSkills],
      config: { ...existingTemplate.config },
      createdAt: Date.now(),
      createdBy: session.userEmail,
    };

    await createTemplate(duplicate);

    return apiSuccess(
      { templateId: duplicate.id },
      "Template duplicated successfully",
      201
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return apiError("Unauthorized", "Please log in to access this resource", 401);
    }
    return apiError("Internal server error", error instanceof Error ? error.message : "An unexpected error occurred", 500);
  }
}

