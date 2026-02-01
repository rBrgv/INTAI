/**
 * API Route: Send Interview Invitations via Email
 * POST /api/college/send-emails
 */

import { NextRequest, NextResponse } from 'next/server';

interface InterviewInviteEmailData {
  candidateName: string;
  candidateEmail: string;
  interviewLink: string;
  collegeName: string;
  jobTitle: string;
  questionCount: number;
  estimatedTime: number;
}

// Generate HTML email template
function generateEmailHTML(data: InterviewInviteEmailData): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px">
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#4338ca);padding:40px;text-align:center;border-radius:8px 8px 0 0">
          <h1 style="color:#fff;margin:0;font-size:28px">Interview Invitation</h1>
        </td></tr>
        <tr><td style="padding:40px">
          <p style="color:#1f2937;font-size:16px;margin:0 0 20px">Hi <strong>${data.candidateName}</strong>,</p>
          <p style="color:#1f2937;font-size:16px;margin:0 0 20px">
            You have been invited by <strong>${data.collegeName}</strong> to complete an AI-powered interview for the <strong>${data.jobTitle}</strong> position.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;margin:30px 0">
            <tr><td style="padding:20px">
              <h3 style="color:#4f46e5;margin:0 0 15px;font-size:16px">Interview Details</h3>
              <table width="100%">
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:14px">Position:</td>
                  <td style="padding:8px 0;color:#1f2937;font-size:14px;font-weight:500;text-align:right">${data.jobTitle}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:14px">Questions:</td>
                  <td style="padding:8px 0;color:#1f2937;font-size:14px;font-weight:500;text-align:right">${data.questionCount}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:14px">Estimated Time:</td>
                  <td style="padding:8px 0;color:#1f2937;font-size:14px;font-weight:500;text-align:right">${data.estimatedTime} minutes</td>
                </tr>
              </table>
            </td></tr>
          </table>
          <table width="100%" style="margin:30px 0">
            <tr><td align="center">
              <a href="${data.interviewLink}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#4338ca);color:#fff;text-decoration:none;padding:16px 40px;border-radius:6px;font-size:16px;font-weight:600">
                Start Interview
              </a>
            </td></tr>
          </table>
          <p style="color:#6b7280;font-size:14px;margin:30px 0 0">Good luck!<br><strong>${data.collegeName} Placement Team</strong></p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:30px;text-align:center;border-radius:0 0 8px 8px;border-top:1px solid #e5e7eb">
          <p style="color:#9ca3af;font-size:12px;margin:0">© 2026 ${data.collegeName}. AI Interview Platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { invitations } = body;

    if (!invitations || !Array.isArray(invitations) || invitations.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request. Expected an array of invitations.' },
        { status: 400 }
      );
    }

    // Validate Resend API key
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return NextResponse.json(
        { error: 'Email service not configured. Please add RESEND_API_KEY to environment variables.' },
        { status: 500 }
      );
    }

    // Dynamic import of Resend to avoid ESM issues
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Send emails one by one
    const results = await Promise.allSettled(
      invitations.map(async (inv: InterviewInviteEmailData) => {
        const { data, error } = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'AI Interview <onboarding@resend.dev>',
          to: [inv.candidateEmail],
          subject: `Interview Invitation from ${inv.collegeName}`,
          html: generateEmailHTML(inv),
        });

        if (error) {
          throw new Error(error.message);
        }

        return { messageId: data?.id, email: inv.candidateEmail };
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return NextResponse.json({
      success: true,
      message: `Sent ${successful} of ${results.length} emails`,
      data: {
        total: results.length,
        successful,
        failed,
        results: results.map((result, index) => ({
          email: invitations[index].candidateEmail,
          status: result.status,
          messageId: result.status === 'fulfilled' ? result.value.messageId : null,
          error: result.status === 'rejected' ? result.reason?.message : null,
        })),
      },
    });

  } catch (error) {
    console.error('Error sending emails:', error);
    return NextResponse.json(
      {
        error: 'Failed to send emails',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
