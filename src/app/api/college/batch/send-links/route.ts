import { NextRequest } from "next/server";
import { requireAuthAPI } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { getTemplate } from "@/lib/unifiedStore";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { logger } from "@/lib/logger";

/**
 * Send interview links via email
 * This is a placeholder - in production, integrate with an email service like:
 * - SendGrid
 * - AWS SES
 * - Resend
 * - Nodemailer with SMTP
 */
export async function POST(req: NextRequest) {
  try {
    const session = requireAuthAPI(req);
    
    const body = await req.json().catch(() => null);
    if (!body) {
      return apiError("Invalid JSON", "Request body must be valid JSON", 400);
    }

    const { templateId, candidateEmails, customMessage } = body;

    if (!templateId || !Array.isArray(candidateEmails) || candidateEmails.length === 0) {
      return apiError("Validation failed", "templateId and candidateEmails array are required", 400);
    }

    // Verify template belongs to college
    const template = await getTemplate(templateId);
    if (!template) {
      return apiError("Template not found", "The requested template does not exist", 404);
    }
    if (template.collegeId && template.collegeId !== session.collegeId) {
      return apiError("Forbidden", "You don't have access to this template", 403);
    }

    // Fetch batches and get session IDs for candidates
    if (!isSupabaseConfigured() || !supabase) {
      return apiError("Configuration error", "Database not configured", 500);
    }

    const { data: batches, error: batchesError } = await supabase
      .from('candidate_batches')
      .select(`
        id,
        batch_candidates (
          email,
          session_id
        )
      `)
      .eq('job_template_id', templateId)
      .eq('college_id', session.collegeId);

    if (batchesError) {
      logger.error('Error fetching batches', batchesError instanceof Error ? batchesError : new Error(String(batchesError)));
      return apiError("Failed to fetch candidate data", "Database error", 500);
    }

    // Build email list with links
    const emailList: Array<{ email: string; link: string; name?: string }> = [];
    
    batches?.forEach((batch: any) => {
      batch.batch_candidates?.forEach((candidate: any) => {
        if (candidateEmails.includes(candidate.email) && candidate.session_id) {
          emailList.push({
            email: candidate.email,
            link: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/interview/${candidate.session_id}`,
            name: candidate.name,
          });
        }
      });
    });

    if (emailList.length === 0) {
      return apiError("No valid candidates found", "No candidates with session IDs found for the provided emails", 404);
    }

    // TODO: Integrate with email service
    // For now, return the email data that would be sent
    // In production, use:
    // - SendGrid: sgMail.send()
    // - AWS SES: ses.sendEmail()
    // - Resend: resend.emails.send()
    // - Nodemailer: transporter.sendMail()

    const emailSubject = `Interview Invitation - ${template.jdText.substring(0, 50)}...`;
    const emailBody = customMessage || `You have been invited to complete an interview. Please click the link below to begin.`;

    // Log email sending (in production, actually send emails)
    logger.info('Email sending requested', {
      templateId,
      emailCount: emailList.length,
      collegeId: session.collegeId,
    });

    return apiSuccess({
      emailsSent: emailList.length,
      emailList: emailList.map(e => ({ email: e.email, link: e.link })),
      message: `Email sending prepared for ${emailList.length} candidate(s). In production, emails would be sent via your configured email service.`,
      // Include email content for testing
      emailContent: {
        subject: emailSubject,
        body: emailBody,
      },
    }, "Email links prepared successfully");
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return apiError("Unauthorized", "Please log in to access this resource", 401);
    }
    logger.error("Error in send-links", error instanceof Error ? error : new Error(String(error)));
    return apiError("Internal server error", error instanceof Error ? error.message : "An unexpected error occurred", 500);
  }
}

