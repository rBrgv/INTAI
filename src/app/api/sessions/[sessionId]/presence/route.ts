import { NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/sessionStore";

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  const session = getSession(params.sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ presence: session.presence ?? null });
}

export async function POST(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  const session = getSession(params.sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const photoDataUrl = body.photoDataUrl
    ? String(body.photoDataUrl).slice(0, 1_600_000) // ~1.5MB limit
    : undefined;
  const phraseTranscript = body.phraseTranscript
    ? String(body.phraseTranscript).slice(0, 200)
    : undefined;

  const completedAt = phraseTranscript ? Date.now() : undefined;

  updateSession(params.sessionId, (s) => ({
    ...s,
    presence: {
      ...s.presence,
      photoDataUrl: photoDataUrl || s.presence?.photoDataUrl,
      phrasePrompt: s.presence?.phrasePrompt || "I confirm this interview response is my own.",
      phraseTranscript: phraseTranscript || s.presence?.phraseTranscript,
      completedAt: completedAt || s.presence?.completedAt,
    },
  }));

  return NextResponse.json({ ok: true });
}

