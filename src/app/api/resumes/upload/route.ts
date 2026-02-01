import { supabase, isSupabaseConfigured, STORAGE_BUCKETS } from "@/lib/supabase";
import { logAudit } from "@/lib/unifiedStore";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  // If Supabase is not configured, return a helpful error but don't block the user
  // The client-side component will handle this gracefully
  if (!isSupabaseConfigured() || !supabase) {
    return apiError(
      "Supabase not configured",
      "File storage is not available. Text extraction will still work.",
      503
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const extractedText = formData.get("extractedText") as string | null;
    const sessionId = formData.get("sessionId") as string | null;
    const uploadedBy = formData.get("uploadedBy") as string | null;

    if (!file) {
      return apiError("No file provided", "Please upload a file", 400);
    }

    // Validate file type
    const fileType = file.name.toLowerCase().endsWith(".pdf")
      ? "pdf"
      : file.name.toLowerCase().endsWith(".docx")
      ? "docx"
      : file.name.toLowerCase().endsWith(".doc")
      ? "doc"
      : null;

    if (!fileType) {
      return apiError(
        "Invalid file type",
        "Only PDF, DOCX, and DOC are supported",
        400
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return apiError(
        "File too large",
        "File size exceeds 10MB limit",
        400
      );
    }

    // Generate unique file path
    const fileId = crypto.randomUUID();
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || fileType;
    const filePath = sessionId
      ? `resumes/${sessionId}/${fileId}.${fileExtension}`
      : `resumes/${fileId}.${fileExtension}`;

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.RESUMES)
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      logger.error("Storage upload error", new Error(uploadError.message), { fileType, fileName: file.name, fileSize: file.size });
      // Check if bucket doesn't exist or permission issue - return 503 (Service Unavailable)
      const errorMessage = uploadError.message || String(uploadError);
      if (errorMessage.includes("Bucket not found") || errorMessage.includes("new row violates") || errorMessage.includes("permission") || errorMessage.includes("not found")) {
        return apiError(
          "Storage bucket not configured. Please create a 'resumes' bucket in Supabase Storage.",
          "File storage is not available. Text extraction will still work.",
          503,
          { details: errorMessage }
        );
      }
      // For other storage errors, also return 503 since storage is optional
      return apiError(
        "Failed to upload file to storage",
        "File storage is not available. Text extraction will still work.",
        503,
        { details: errorMessage }
      );
    }

    // Use extracted text from form data, or empty string if not provided
    // The text will be updated via the update-text API if needed
    const textToStore = extractedText || "";

    // Store resume metadata in database
    const { data: resumeData, error: dbError } = await supabase
      .from("resumes")
      .insert({
        file_path: filePath,
        file_name: file.name,
        file_type: fileType,
        file_size: file.size,
        extracted_text: textToStore,
        session_id: sessionId || null,
        uploaded_by: uploadedBy || null,
      })
      .select()
      .single();

    if (dbError) {
      logger.error("Database insert error", new Error(dbError.message), { filePath, fileName: file.name });
      // Try to clean up uploaded file if it was uploaded
      if (uploadData) {
        await supabase.storage.from(STORAGE_BUCKETS.RESUMES).remove([filePath]).catch(() => {});
      }
      // Return 503 since this is a database issue and storage is optional
      return apiError(
        "Failed to save resume metadata",
        "File storage is not available. Text extraction will still work.",
        503,
        { details: dbError.message }
      );
    }

    // Log audit
    await logAudit("resume_uploaded", "resume", resumeData.id, {
      file_name: file.name,
      file_size: file.size,
      file_type: fileType,
      session_id: sessionId,
    });

    return apiSuccess(
      {
        resumeId: resumeData.id,
        filePath: resumeData.file_path,
        fileName: resumeData.file_name,
        fileType: resumeData.file_type,
      },
      "Resume uploaded successfully",
      201
    );
  } catch (error) {
    console.error("Upload error:", error);
    return apiError(
      "Internal server error",
      error instanceof Error ? error.message : "Unknown error",
      500
    );
  }
}

