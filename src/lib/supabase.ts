import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// These should be set in your .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  // Note: Using logger here would cause circular dependency, so we keep console.warn for this initialization message
  if (process.env.NODE_ENV === 'development') {
    console.warn('Supabase URL or Anon Key not found. Using in-memory store fallback.');
  }
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper to check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

// Database table names
export const TABLES = {
  SESSIONS: 'interview_sessions',
  RESUMES: 'resumes',
  TEMPLATES: 'college_job_templates',
  BATCHES: 'candidate_batches',
  BATCH_CANDIDATES: 'batch_candidates',
  SESSION_HISTORY: 'session_history',
  TEMPLATE_HISTORY: 'template_history',
  AUDIT_LOGS: 'audit_logs',
} as const;

// Storage bucket names
export const STORAGE_BUCKETS = {
  RESUMES: 'resumes',
} as const;

