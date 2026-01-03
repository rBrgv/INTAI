-- INTAI Database Schema with History and Resume Storage
-- Run this in Supabase SQL Editor or via Supabase CLI

-- ============================================
-- CORE TABLES
-- ============================================

-- Resumes table (stores file metadata + extracted text)
CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- File storage (Supabase Storage path)
  file_path TEXT NOT NULL, -- e.g., "resumes/{session_id}/resume.pdf"
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'pdf', 'docx', 'doc'
  file_size BIGINT, -- bytes
  
  -- Extracted content
  extracted_text TEXT NOT NULL,
  text_extracted_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  uploaded_by TEXT, -- email or user identifier
  session_id UUID, -- Will reference interview_sessions after creation
  
  -- Constraints
  CONSTRAINT valid_file_type CHECK (file_type IN ('pdf', 'docx', 'doc'))
);

CREATE INDEX IF NOT EXISTS idx_resumes_session ON resumes(session_id);
CREATE INDEX IF NOT EXISTS idx_resumes_created_at ON resumes(created_at DESC);

-- College Job Templates
CREATE TABLE IF NOT EXISTS college_job_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  
  jd_text TEXT NOT NULL,
  top_skills TEXT[] NOT NULL,
  config JSONB NOT NULL, -- { questionCount, difficultyCurve, customDifficulty }
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT valid_top_skills CHECK (array_length(top_skills, 1) <= 5)
);

CREATE INDEX IF NOT EXISTS idx_templates_college ON college_job_templates(college_id);
CREATE INDEX IF NOT EXISTS idx_templates_created_at ON college_job_templates(created_at DESC);

-- Interview Sessions (main table)
CREATE TABLE IF NOT EXISTS interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL CHECK (mode IN ('company', 'college', 'individual')),
  status TEXT NOT NULL CHECK (status IN ('created', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Resume reference (points to resumes table)
  resume_id UUID REFERENCES resumes(id),
  resume_text TEXT, -- Extracted text (denormalized for quick access)
  
  -- Job details
  jd_text TEXT,
  role TEXT,
  level TEXT CHECK (level IN ('junior', 'mid', 'senior')),
  
  -- Interview data (JSONB for flexibility)
  questions JSONB DEFAULT '[]'::jsonb,
  current_question_index INT DEFAULT 0,
  answers JSONB DEFAULT '[]'::jsonb,
  evaluations JSONB DEFAULT '[]'::jsonb,
  score_summary JSONB,
  report JSONB,
  
  -- Sharing
  share_token TEXT UNIQUE,
  
  -- Setup
  job_setup JSONB,
  college_job_template_id UUID REFERENCES college_job_templates(id),
  
  -- Candidate info (for college mode)
  candidate_email TEXT,
  candidate_name TEXT,
  student_id TEXT,
  
  -- Anti-cheating
  tab_switch_count INT DEFAULT 0,
  tab_switch_events JSONB DEFAULT '[]'::jsonb,
  presence JSONB,
  
  -- Constraints
  CONSTRAINT valid_question_index CHECK (current_question_index >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sessions_status ON interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_mode ON interview_sessions(mode);
CREATE INDEX IF NOT EXISTS idx_sessions_template ON interview_sessions(college_job_template_id);
CREATE INDEX IF NOT EXISTS idx_sessions_candidate_email ON interview_sessions(candidate_email);
CREATE INDEX IF NOT EXISTS idx_sessions_share_token ON interview_sessions(share_token);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON interview_sessions(created_at DESC);

-- Candidate Batches
CREATE TABLE IF NOT EXISTS candidate_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_template_id UUID NOT NULL REFERENCES college_job_templates(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_batches_template ON candidate_batches(job_template_id);

-- Batch Candidates (normalized)
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
CREATE INDEX IF NOT EXISTS idx_batch_candidates_session ON batch_candidates(session_id);
CREATE INDEX IF NOT EXISTS idx_batch_candidates_status ON batch_candidates(status);

-- ============================================
-- HISTORY/AUDIT TABLES
-- ============================================

-- Session History (tracks all state changes)
CREATE TABLE IF NOT EXISTS session_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  
  -- What changed
  event_type TEXT NOT NULL, -- 'created', 'status_changed', 'question_answered', 'evaluated', 'report_generated', 'tab_switch'
  old_value JSONB,
  new_value JSONB,
  
  -- When and who
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by TEXT, -- user identifier if available
  
  -- Context
  metadata JSONB -- Additional context about the change
);

CREATE INDEX IF NOT EXISTS idx_session_history_session ON session_history(session_id);
CREATE INDEX IF NOT EXISTS idx_session_history_event_type ON session_history(event_type);
CREATE INDEX IF NOT EXISTS idx_session_history_changed_at ON session_history(changed_at DESC);

-- Template History (version control for templates)
CREATE TABLE IF NOT EXISTS template_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES college_job_templates(id) ON DELETE CASCADE,
  
  -- Version snapshot
  version_number INT NOT NULL,
  jd_text TEXT NOT NULL,
  top_skills TEXT[] NOT NULL,
  config JSONB NOT NULL,
  
  -- Change info
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by TEXT,
  change_reason TEXT,
  
  -- Full snapshot of template at this version
  snapshot JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_template_history_template ON template_history(template_id);
CREATE INDEX IF NOT EXISTS idx_template_history_version ON template_history(template_id, version_number DESC);

-- Audit Log (system-wide activity tracking)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What happened
  action TEXT NOT NULL, -- 'session_created', 'template_updated', 'batch_created', 'report_viewed', etc.
  entity_type TEXT NOT NULL, -- 'session', 'template', 'batch', 'resume'
  entity_id UUID,
  
  -- Who did it
  user_email TEXT,
  user_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  
  -- Details
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_email);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_sessions_updated_at ON interview_sessions;
CREATE TRIGGER update_sessions_updated_at 
  BEFORE UPDATE ON interview_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_templates_updated_at ON college_job_templates;
CREATE TRIGGER update_templates_updated_at 
  BEFORE UPDATE ON college_job_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to log session history
CREATE OR REPLACE FUNCTION log_session_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO session_history (session_id, event_type, old_value, new_value)
    VALUES (
      NEW.id,
      'status_changed',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status)
    );
  END IF;
  
  -- Log question advancement
  IF OLD.current_question_index IS DISTINCT FROM NEW.current_question_index THEN
    INSERT INTO session_history (session_id, event_type, old_value, new_value)
    VALUES (
      NEW.id,
      'question_advanced',
      jsonb_build_object('index', OLD.current_question_index),
      jsonb_build_object('index', NEW.current_question_index)
    );
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for session history
DROP TRIGGER IF EXISTS log_session_changes ON interview_sessions;
CREATE TRIGGER log_session_changes
  AFTER UPDATE ON interview_sessions
  FOR EACH ROW EXECUTE FUNCTION log_session_history();

-- Function to create template version on update
CREATE OR REPLACE FUNCTION create_template_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version INT;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO next_version
  FROM template_history
  WHERE template_id = NEW.id;
  
  -- Create history entry
  INSERT INTO template_history (
    template_id,
    version_number,
    jd_text,
    top_skills,
    config,
    snapshot
  )
  VALUES (
    NEW.id,
    next_version,
    NEW.jd_text,
    NEW.top_skills,
    NEW.config,
    to_jsonb(NEW)
  );
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for template versioning
DROP TRIGGER IF EXISTS create_template_version_trigger ON college_job_templates;
CREATE TRIGGER create_template_version_trigger
  AFTER UPDATE ON college_job_templates
  FOR EACH ROW
  WHEN (OLD.jd_text IS DISTINCT FROM NEW.jd_text 
     OR OLD.top_skills IS DISTINCT FROM NEW.top_skills
     OR OLD.config IS DISTINCT FROM NEW.config)
  EXECUTE FUNCTION create_template_version();

-- ============================================
-- STORAGE BUCKETS (Note: Run these in Supabase Dashboard Storage section)
-- ============================================
-- 
-- Create bucket via SQL:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('resumes', 'resumes', false)
-- ON CONFLICT (id) DO NOTHING;
--
-- Storage policies (run after bucket creation):
-- CREATE POLICY "Resumes are accessible by session owner"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'resumes');
--
-- CREATE POLICY "Resumes can be uploaded"
-- ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'resumes');

