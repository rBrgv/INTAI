/**
 * Unified Store - Uses Supabase when available, falls back to in-memory store
 * This allows gradual migration and backward compatibility
 */

import { isSupabaseConfigured } from './supabase';
import * as supabaseStore from './supabaseStore';
import * as memoryStore from './sessionStore';
import * as memoryCollegeStore from './collegeStore';
import { InterviewSession, CollegeJobTemplate, CandidateBatch, InterviewMode } from './types';
import { logger } from './logger';

// ============================================
// SESSION STORE (Unified)
// ============================================

export async function createSession(session: InterviewSession): Promise<InterviewSession> {
  logger.info('createSession called', { 
    sessionId: session.id, 
    mode: session.mode,
    isSupabaseConfigured: isSupabaseConfigured() 
  });
  
  if (isSupabaseConfigured()) {
    try {
      const created = await supabaseStore.createSession(session);
      logger.info('Session created in Supabase', { sessionId: session.id });
      return created;
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
  logger.info('Creating session in memory store', { sessionId: session.id });
  const created = memoryStore.createSession(session);
  logger.info('Session created in memory store', { 
    sessionId: session.id,
    storeSize: (globalThis as any).__SESSION_STORE__?.size || 0
  });
  return created;
}

export async function getSession(id: string, expectedUpdatedAt?: string): Promise<InterviewSession | null> {
  const isSupabaseAvailable = isSupabaseConfigured();
  logger.info('getSession called', { 
    sessionId: id, 
    isSupabaseConfigured: isSupabaseAvailable,
    supabaseUrl: isSupabaseAvailable ? process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...' : 'not set'
  });
  
  if (isSupabaseAvailable) {
    try {
      logger.debug('Attempting to get session from Supabase', { sessionId: id });
      const session = await supabaseStore.getSession(id);
      if (session) {
        logger.info('Session found in Supabase', { sessionId: id, status: session.status });
        return session;
      }
      logger.warn('Session not found in Supabase', { 
        sessionId: id,
        table: 'interview_sessions',
        note: 'Check if table exists and has correct permissions'
      });
      
      // If not found in Supabase, check memory store as fallback
      // NOTE: In serverless environments, memory store won't persist across requests
      // This is only useful if both requests happen in the same function instance
      logger.debug('Checking memory store as fallback', { sessionId: id });
      const memorySession = memoryStore.getSession(id);
      if (memorySession) {
        logger.warn('Session found in memory store but not in Supabase - WILL NOT PERSIST in serverless', { 
          sessionId: id,
          warning: 'This session will be lost on next request. Fix Supabase configuration.'
        });
        return memorySession;
      }
      logger.warn('Session not found in Supabase or memory store', { sessionId: id });
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDetails = error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 200)
      } : { error: String(error) };
      
      logger.error('Supabase getSession error', error instanceof Error ? error : new Error(errorMessage), { 
        sessionId: id,
        errorDetails,
        possibleCauses: [
          'Table does not exist - run migrations',
          'RLS policies blocking access',
          'Invalid credentials',
          'Network connectivity issue'
        ]
      });
      
      // If Supabase fails, check memory store as fallback
      logger.debug('Checking memory store after Supabase error', { sessionId: id });
      const memorySession = memoryStore.getSession(id);
      if (memorySession) {
        logger.warn('Session found in memory store after Supabase error - WILL NOT PERSIST in serverless', { 
          sessionId: id,
          warning: 'This session will be lost on next request. Fix Supabase error: ' + errorMessage
        });
        return memorySession;
      }
      logger.warn('Session not found after Supabase error and memory check', { 
        sessionId: id,
        error: errorMessage
      });
      return null;
    }
  }
  
  // Only use memory store if Supabase is not configured
  logger.debug('Supabase not configured, using memory store', { 
    sessionId: id,
    warning: 'Memory store will not persist in serverless environment'
  });
  const memorySession = memoryStore.getSession(id);
  if (memorySession) {
    logger.info('Session found in memory store', { sessionId: id });
  } else {
    logger.warn('Session not found in memory store', { sessionId: id });
  }
  return memorySession;
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
  logger.info('findSessionByShareToken called', { token, isSupabaseConfigured: isSupabaseConfigured() });
  
  if (isSupabaseConfigured()) {
    try {
      const session = await supabaseStore.findSessionByShareToken(token);
      if (session) {
        logger.info('Session found in Supabase by share token', { token, sessionId: session.id });
        return session;
      }
      logger.warn('Session not found in Supabase by share token', { token });
    } catch (error) {
      logger.warn('Supabase findSessionByShareToken failed, falling back to memory', { 
        error: error instanceof Error ? error.message : String(error),
        token 
      });
    }
  }
  
  logger.debug('Checking memory store for share token', { token });
  const memorySession = memoryStore.findSessionByShareToken(token);
  if (memorySession) {
    logger.info('Session found in memory store by share token', { token, sessionId: memorySession.id });
  } else {
    logger.warn('Session not found in memory store by share token', { 
      token,
      warning: 'Memory store may not persist across requests. Configure Supabase for persistent storage.'
    });
  }
  return memorySession;
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

export async function getSessionsByMode(mode: InterviewMode): Promise<InterviewSession[]> {
  if (isSupabaseConfigured()) {
    try {
      return await supabaseStore.getSessionsByMode(mode);
    } catch (error) {
      logger.warn('Supabase getSessionsByMode failed, falling back to memory', { error: error instanceof Error ? error.message : String(error), mode });
    }
  }
  return memoryStore.getSessionsByMode(mode);
}

export async function getSessionsByEmail(email: string): Promise<InterviewSession[]> {
  if (isSupabaseConfigured()) {
    try {
      return await supabaseStore.getSessionsByEmail(email);
    } catch (error) {
      logger.warn('Supabase getSessionsByEmail failed, falling back to memory', { error: error instanceof Error ? error.message : String(error), email });
    }
  }
  return memoryStore.getSessionsByEmail(email);
}

export async function getSessionsByTemplate(templateId: string): Promise<InterviewSession[]> {
  if (isSupabaseConfigured()) {
    try {
      return await supabaseStore.getSessionsByTemplate(templateId);
    } catch (error) {
      logger.warn('Supabase getSessionsByTemplate failed, falling back to memory', { error: error instanceof Error ? error.message : String(error), templateId });
    }
  }
  return memoryStore.getSessionsByTemplate(templateId);
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


