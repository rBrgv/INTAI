/**
 * Resend Email Service
 * Handles all email sending functionality using Resend API
 */

import { Resend } from 'resend';

// Initialize Resend with API key from environment
const resend = new Resend(process.env.RESEND_API_KEY);

export interface InterviewInviteEmailData {
    candidateName: string;
    candidateEmail: string;
    interviewLink: string;
    collegeName: string;
    jobTitle: string;
    questionCount: number;
    estimatedTime: number;
}

/**
 * Send interview invitation email to a candidate
 */
export async function sendInterviewInvite(data: InterviewInviteEmailData) {
    try {
        const { data: result, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'AI Interview Platform <noreply@yourdomain.com>',
            to: [data.candidateEmail],
            subject: `Interview Invitation from ${data.collegeName}`,
            html: generateInterviewInviteHTML(data),
        });

        if (error) {
            console.error('Resend API error:', error);
            throw new Error(`Failed to send email: ${error.message}`);
        }

        return {
            success: true,
            messageId: result?.id,
            recipient: data.candidateEmail,
        };
    } catch (error) {
        console.error('Error sending interview invite:', error);
        throw error;
    }
}

/**
 * Send bulk interview invitations
 */
export async function sendBulkInterviewInvites(invites: InterviewInviteEmailData[]) {
    const results = await Promise.allSettled(
        invites.map(invite => sendInterviewInvite(invite))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return {
        total: invites.length,
        successful,
        failed,
        results: results.map((result, index) => ({
            email: invites[index].candidateEmail,
            status: result.status,
            messageId: result.status === 'fulfilled' ? result.value.messageId : null,
            error: result.status === 'rejected' ? result.reason.message : null,
        })),
    };
}

/**
 * Generate HTML email template for interview invitation
 */
function generateInterviewInviteHTML(data: InterviewInviteEmailData): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interview Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5, #4338ca); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Interview Invitation</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi <strong>${data.candidateName}</strong>,
              </p>
              
              <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                You have been invited by <strong>${data.collegeName}</strong> to complete an AI-powered interview for the <strong>${data.jobTitle}</strong> position.
              </p>

              <!-- Interview Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; margin: 30px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="color: #4f46e5; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">Interview Details</h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Position:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500; text-align: right;">${data.jobTitle}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Number of Questions:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500; text-align: right;">${data.questionCount}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Estimated Time:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500; text-align: right;">${data.estimatedTime} minutes</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${data.interviewLink}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #4338ca); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.3);">
                      Start Interview
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                Or copy and paste this link into your browser:
              </p>
              <p style="color: #4f46e5; font-size: 14px; word-break: break-all; margin: 10px 0 30px 0;">
                ${data.interviewLink}
              </p>

              <!-- Tips Section -->
              <div style="background-color: #eff6ff; border-left: 4px solid #4f46e5; padding: 16px; margin: 30px 0;">
                <h4 style="color: #1f2937; margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">🎯 Tips for Success:</h4>
                <ul style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
                  <li>Find a quiet place with stable internet</li>
                  <li>Use a desktop or laptop for the best experience</li>
                  <li>Take your time to answer thoughtfully</li>
                  <li>You can use voice or text input for answers</li>
                </ul>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                Good luck!<br>
                <strong>${data.collegeName} Placement Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0 0 10px 0;">
                This is an automated message from AI Interview Platform
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © 2026 ${data.collegeName}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
