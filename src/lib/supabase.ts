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

// Create Supabase client with anon key (for client-side and general use)
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      db: {
        schema: 'public',
      },
    })
  : null;

// Create Supabase client with service role key for server-side operations
// This bypasses RLS and read replicas, ensuring we get fresh data immediately
// Set SUPABASE_SERVICE_ROLE_KEY in your environment variables (server-side only, never expose to client)
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      db: {
        schema: 'public',
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// Helper to get the appropriate Supabase client
// Use admin client for server-side reads to bypass read replicas
export function getSupabaseClient(useAdmin = false) {
  if (useAdmin && supabaseAdmin) {
    return supabaseAdmin;
  }
  return supabase;
}

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

