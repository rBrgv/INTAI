-- ==========================================
-- INTAI COMPLETE DATABASE SETUP
-- Combined migration script (001 + 002)
-- Run this in Supabase SQL Editor to fix missing tables
-- ==========================================

-- 1. RESUMES TABLE
CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  extracted_text TEXT NOT NULL,
  text_extracted_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by TEXT,
  session_id UUID,
  CONSTRAINT valid_file_type CHECK (file_type IN ('pdf', 'docx', 'doc'))
);
CREATE INDEX IF NOT EXISTS idx_resumes_session ON resumes(session_id);

-- 2. COLLEGE JOB TEMPLATES
CREATE TABLE IF NOT EXISTS college_job_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  jd_text TEXT NOT NULL,
  top_skills TEXT[] NOT NULL,
  config JSONB NOT NULL,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT valid_top_skills CHECK (array_length(top_skills, 1) <= 5)
);
CREATE INDEX IF NOT EXISTS idx_templates_college ON college_job_templates(college_id);

-- 3. INTERVIEW SESSIONS
CREATE TABLE IF NOT EXISTS interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL CHECK (mode IN ('company', 'college', 'individual')),
  status TEXT NOT NULL CHECK (status IN ('created', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  resume_id UUID REFERENCES resumes(id),
  resume_text TEXT,
  jd_text TEXT,
  role TEXT,
  level TEXT CHECK (level IN ('junior', 'mid', 'senior')),
  questions JSONB DEFAULT '[]'::jsonb,
  current_question_index INT DEFAULT 0,
  answers JSONB DEFAULT '[]'::jsonb,
  evaluations JSONB DEFAULT '[]'::jsonb,
  score_summary JSONB,
  report JSONB,
  share_token TEXT UNIQUE,
  job_setup JSONB,
  college_job_template_id UUID REFERENCES college_job_templates(id),
  candidate_email TEXT,
  candidate_name TEXT,
  student_id TEXT,
  tab_switch_count INT DEFAULT 0,
  tab_switch_events JSONB DEFAULT '[]'::jsonb,
  presence JSONB
);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_share_token ON interview_sessions(share_token);

-- 4. COLLEGES (AUTH)
CREATE TABLE IF NOT EXISTS colleges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  contact_person TEXT,
  phone TEXT,
  address TEXT
);
CREATE INDEX IF NOT EXISTS idx_colleges_email ON colleges(email);

-- 5. CANDIDATE BATCHES
CREATE TABLE IF NOT EXISTS candidate_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_template_id UUID NOT NULL REFERENCES college_job_templates(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  college_id UUID REFERENCES colleges(id)
);
CREATE INDEX IF NOT EXISTS idx_batches_template ON candidate_batches(job_template_id);
CREATE INDEX IF NOT EXISTS idx_batches_college ON candidate_batches(college_id);

-- 6. BATCH CANDIDATES
CREATE TABLE IF NOT EXISTS batch_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES candidate_batches(id) ON DELETE CASCADE,
  session_id UUID REFERENCES interview_sessions(id),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  student_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_at TIMESTAMPTZ,
  link_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_batch_candidates_batch ON batch_candidates(batch_id);

-- 7. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  user_email TEXT,
  user_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. STUDENTS
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  student_id TEXT,
  phone TEXT,
  department TEXT,
  year TEXT,
  batch TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  UNIQUE(college_id, email)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_college_student_id_unique 
ON students(college_id, student_id) 
WHERE student_id IS NOT NULL;
