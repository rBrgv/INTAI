/**
 * Unified Store - Uses Supabase when available, falls back to in-memory store
 * This allows gradual migration and backward compatibility
 */

import { isSupabaseConfigured } from './supabase';
import * as supabaseStore from './supabaseStore';
import * as memoryStore from './sessionStore';
import * as memoryCollegeStore from './collegeStore';
import { InterviewSession, CollegeJobTemplate, CandidateBatch } from './types';
import { logger } from './logger';

// ============================================
// SESSION STORE (Unified)
// ============================================

export async function createSession(session: InterviewSession): Promise<InterviewSession> {
  if (isSupabaseConfigured()) {
    try {
      return await supabaseStore.createSession(session);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Supabase createSession failed', error instanceof Error ? error : new Error(errorMessage), { 
        sessionId: session.id, 
        mode: session.mode,
        error: errorMessage 
      });
      // In serverless environments, memory store won't persist across requests
      // So we should re-throw the error instead of falling back
      // This ensures the user knows there's a database issue
      throw new Error(`Failed to create session in database: ${errorMessage}`);
    }
  }
  // Only use memory store if Supabase is not configured
  return memoryStore.createSession(session);
}

export async function getSession(id: string): Promise<InterviewSession | null> {
  if (isSupabaseConfigured()) {
    try {
      const session = await supabaseStore.getSession(id);
      if (session) {
        return session;
      }
      // If not found in Supabase, check memory store as fallback
      // This handles cases where session was created in memory due to Supabase failure
      const memorySession = memoryStore.getSession(id);
      if (memorySession) {
        logger.warn('Session found in memory store but not in Supabase', { sessionId: id });
        return memorySession;
      }
      return null;
    } catch (error) {
      logger.warn('Supabase getSession error, checking memory store', { error: error instanceof Error ? error.message : String(error), sessionId: id });
      // If Supabase fails, check memory store as fallback
      const memorySession = memoryStore.getSession(id);
      if (memorySession) {
        return memorySession;
      }
      // If not found in either, return null
      return null;
    }
  }
  // Only use memory store if Supabase is not configured
  return memoryStore.getSession(id);
}

export async function updateSession(
  id: string,
  updater: (s: InterviewSession) => InterviewSession
): Promise<InterviewSession | null> {
  if (isSupabaseConfigured()) {
    try {
      const result = await supabaseStore.updateSession(id, updater);
      if (!result) {
        logger.error('Supabase updateSession returned null - this indicates a database error', undefined, { sessionId: id });
        // Don't fall back to memory - this would cause data inconsistency
        // Instead, return null so the caller knows it failed
        return null;
      }
      return result;
    } catch (error) {
      logger.error('Supabase updateSession threw an error', error instanceof Error ? error : new Error(String(error)), { sessionId: id });
      // Don't fall back to memory - this would cause data inconsistency
      throw error;
    }
  }
  return memoryStore.updateSession(id, updater);
}

export async function findSessionByShareToken(token: string): Promise<InterviewSession | null> {
  if (isSupabaseConfigured()) {
    try {
      const session = await supabaseStore.findSessionByShareToken(token);
      if (session) return session;
    } catch (error) {
      logger.warn('Supabase findSessionByShareToken failed, falling back to memory', { error: error instanceof Error ? error.message : String(error) });
    }
  }
  return memoryStore.findSessionByShareToken(token);
}

export async function getSessionsByIds(sessionIds: string[]): Promise<InterviewSession[]> {
  if (isSupabaseConfigured()) {
    try {
      return await supabaseStore.getSessionsByIds(sessionIds);
    } catch (error) {
      logger.warn('Supabase getSessionsByIds failed, falling back to memory', { error: error instanceof Error ? error.message : String(error), sessionIds });
    }
  }
  return memoryStore.getSessionsByIds(sessionIds);
}

export async function getAllSessions(): Promise<InterviewSession[]> {
  if (isSupabaseConfigured()) {
    try {
      return await supabaseStore.getAllSessions();
    } catch (error) {
      logger.warn('Supabase getAllSessions failed, falling back to memory', { error: error instanceof Error ? error.message : String(error) });
    }
  }
  return memoryStore.getAllSessions();
}

// ============================================
// COLLEGE STORE (Unified)
// ============================================

export async function createTemplate(template: CollegeJobTemplate): Promise<CollegeJobTemplate> {
  if (isSupabaseConfigured()) {
    try {
      return await supabaseStore.createTemplate(template);
    } catch (error) {
      logger.warn('Supabase createTemplate failed, falling back to memory', { error: error instanceof Error ? error.message : String(error), templateId: template.id });
    }
  }
  return memoryCollegeStore.createTemplate(template);
}

export async function getTemplate(id: string): Promise<CollegeJobTemplate | null> {
  if (isSupabaseConfigured()) {
    try {
      const template = await supabaseStore.getTemplate(id);
      if (template) return template;
    } catch (error) {
      logger.warn('Supabase getTemplate failed, falling back to memory', { error: error instanceof Error ? error.message : String(error), templateId: id });
    }
  }
  return memoryCollegeStore.getTemplate(id);
}

export async function getAllTemplates(): Promise<CollegeJobTemplate[]> {
  if (isSupabaseConfigured()) {
    try {
      return await supabaseStore.getAllTemplates();
    } catch (error) {
      logger.warn('Supabase getAllTemplates failed, falling back to memory', { error: error instanceof Error ? error.message : String(error) });
    }
  }
  return memoryCollegeStore.getAllTemplates();
}

export async function createBatch(batch: CandidateBatch): Promise<CandidateBatch> {
  if (isSupabaseConfigured()) {
    try {
      return await supabaseStore.createBatch(batch);
    } catch (error) {
      logger.warn('Supabase createBatch failed, falling back to memory', { error: error instanceof Error ? error.message : String(error), batchId: batch.id });
    }
  }
  return memoryCollegeStore.createBatch(batch);
}

export async function getBatch(id: string): Promise<CandidateBatch | null> {
  if (isSupabaseConfigured()) {
    try {
      const batch = await supabaseStore.getBatch(id);
      if (batch) return batch;
    } catch (error) {
      logger.warn('Supabase getBatch failed, falling back to memory', { error: error instanceof Error ? error.message : String(error), batchId: id });
    }
  }
  return memoryCollegeStore.getBatch(id);
}

export async function getBatchesByTemplate(templateId: string): Promise<CandidateBatch[]> {
  if (isSupabaseConfigured()) {
    try {
      return await supabaseStore.getBatchesByTemplate(templateId);
    } catch (error) {
      logger.warn('Supabase getBatchesByTemplate failed, falling back to memory', { error: error instanceof Error ? error.message : String(error), templateId });
    }
  }
  return memoryCollegeStore.getBatchesByTemplate(templateId);
}

// ============================================
// AUDIT LOGGING
// ============================================

export async function logAudit(
  action: string,
  entityType: string,
  entityId: string | null,
  details?: Record<string, any>
): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      await supabaseStore.logAudit(action, entityType, entityId || '', details);
    } catch (error) {
      logger.warn('Failed to log audit', { error: error instanceof Error ? error.message : String(error), action, entityType, entityId });
      // Audit logging failures are non-critical, so we continue
    }
  }
}

