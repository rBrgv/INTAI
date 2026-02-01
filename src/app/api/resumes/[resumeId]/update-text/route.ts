import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: { resumeId: string } }
) {
  if (!isSupabaseConfigured() || !supabase) {
    return apiError(
      "Supabase not configured",
      "Database is not available",
      500
    );
  }

  try {
    const body = await req.json();
    const extractedText = String(body.extractedText || "").trim();

    if (!extractedText) {
      return apiError(
        "Validation failed",
        "Extracted text is required",
        400
      );
    }

    const { data, error } = await supabase
      .from("resumes")
      .update({
        extracted_text: extractedText,
        text_extracted_at: new Date().toISOString(),
      })
      .eq("id", params.resumeId)
      .select()
      .single();

    if (error) {
      logger.error("Update error", new Error(error.message), { resumeId: params.resumeId });
      return apiError(
        "Failed to update resume text",
        "Could not update resume in database",
        500,
        { details: error.message }
      );
    }

    return apiSuccess({ resume: data }, "Resume text updated successfully");
  } catch (error) {
    logger.error("Update text error", error instanceof Error ? error : new Error(String(error)), { resumeId: params.resumeId });
    return apiError(
      "Internal server error",
      error instanceof Error ? error.message : "Unknown error",
      500
    );
  }
}

