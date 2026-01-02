import { NextResponse } from "next/server";
import { findSessionByShareToken } from "@/lib/sessionStore";

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const session = findSessionByShareToken(params.token);

  if (!session || !session.report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json({
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

