import { NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/unifiedStore";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { sanitizeForStorage } from "@/lib/sanitize";

// Configure for production
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30; // Presence check should be fast

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  const session = await getSession(params.sessionId);
  if (!session) {
    return apiError("Session not found", "The requested session does not exist", 404);
  }

  return apiSuccess({ presence: session.presence ?? null });
}

export async function POST(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  const session = await getSession(params.sessionId);
  if (!session) {
    return apiError("Session not found", "The requested session does not exist", 404);
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return apiError("Invalid JSON", "Request body must be valid JSON", 400);
  }

  const photoDataUrl = body.photoDataUrl
    ? String(body.photoDataUrl).slice(0, 1_600_000) // ~1.5MB limit
    : undefined;
  const phraseTranscript = body.phraseTranscript
    ? await sanitizeForStorage(String(body.phraseTranscript).slice(0, 200))
    : undefined;

  const completedAt = phraseTranscript ? Date.now() : undefined;

  await updateSession(params.sessionId, (s) => ({
    ...s,
    presence: {
      ...s.presence,
      photoDataUrl: photoDataUrl || s.presence?.photoDataUrl,
      phrasePrompt: s.presence?.phrasePrompt || "I confirm this interview response is my own.",
      phraseTranscript: phraseTranscript || s.presence?.phraseTranscript,
      completedAt: completedAt || s.presence?.completedAt,
    },
  }));

  return apiSuccess({}, "Presence check completed");
}


