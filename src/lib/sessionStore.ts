import { InterviewSession } from "./types";

declare global {
  // eslint-disable-next-line no-var
  var __SESSION_STORE__: Map<string, InterviewSession> | undefined;
}

const store =
  globalThis.__SESSION_STORE__ ?? new Map<string, InterviewSession>();
globalThis.__SESSION_STORE__ = store;

export function createSession(session: InterviewSession) {
  store.set(session.id, session);
  return session;
}

export function getSession(id: string) {
  return store.get(id) ?? null;
}

export function updateSession(
  id: string,
  updater: (s: InterviewSession) => InterviewSession
) {
  const current = store.get(id);
  if (!current) return null;
  const updated = updater(current);
  store.set(id, updated);
  return updated;
}

export function findSessionByShareToken(token: string): InterviewSession | null {
  for (const session of store.values()) {
    if (session.shareToken === token) {
      return session;
    }
  }
  return null;
}

