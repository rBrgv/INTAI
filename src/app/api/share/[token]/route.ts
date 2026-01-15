import { NextResponse } from "next/server";
import { findSessionByShareToken, logAudit } from "@/lib/unifiedStore";
import { apiSuccess, apiError } from "@/lib/apiResponse";

// Configure for production
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30; // Share token lookup should be fast

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const session = await findSessionByShareToken(params.token);

  if (!session || !session.report) {
    return apiError(
      "Report not found",
      "The requested report does not exist or is not available",
      404
    );
  }

  // Log report view
  await logAudit('report_viewed', 'session', session.id, {
    via: 'share_link',
    token: params.token,
  });

  return apiSuccess({
    report: session.report,
    context: {
      mode: session.mode,
      role: session.role,
      level: session.level,
    },
    scoreSummary: session.scoreSummary,
    shareToken: session.shareToken,
  });
}


