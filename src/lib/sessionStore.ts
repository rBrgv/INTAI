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

export function getSessionsByIds(sessionIds: string[]): InterviewSession[] {
  return sessionIds
    .map(id => getSession(id))
    .filter((s): s is InterviewSession => s !== null);
}

export function getAllSessions(): InterviewSession[] {
  return Array.from(store.values());
}

export function getSessionsByMode(mode: string): InterviewSession[] {
  return Array.from(store.values()).filter(s => s.mode === mode);
}

export function getSessionsByEmail(email: string): InterviewSession[] {
  return Array.from(store.values()).filter(s => s.candidateEmail === email);
}

export function getSessionsByTemplate(templateId: string): InterviewSession[] {
  return Array.from(store.values()).filter(s => s.collegeJobTemplateId === templateId);
}

