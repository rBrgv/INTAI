-- College Authentication and Student Management
-- Run this in Supabase SQL Editor or via Supabase CLI

-- ============================================
-- COLLEGE AUTHENTICATION
-- ============================================

-- Colleges table
CREATE TABLE IF NOT EXISTS colleges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- bcrypt hash
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  -- Additional info
  contact_person TEXT,
  phone TEXT,
  address TEXT
);

CREATE INDEX IF NOT EXISTS idx_colleges_email ON colleges(email);
CREATE INDEX IF NOT EXISTS idx_colleges_active ON colleges(is_active);

-- College users (multiple admins per college)
CREATE TABLE IF NOT EXISTS college_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(college_id, email)
);

CREATE INDEX IF NOT EXISTS idx_college_users_college ON college_users(college_id);
CREATE INDEX IF NOT EXISTS idx_college_users_email ON college_users(email);

-- ============================================
-- STUDENT MANAGEMENT
-- ============================================

-- Students table (managed by college)
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  
  -- Student info
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  student_id TEXT,
  phone TEXT,
  department TEXT,
  year TEXT,
  batch TEXT, -- e.g., "2024", "2025"
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT, -- college user email
  
  -- Constraints
  UNIQUE(college_id, email)
);

CREATE INDEX IF NOT EXISTS idx_students_college ON students(college_id);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
CREATE INDEX IF NOT EXISTS idx_students_department ON students(department);

-- Partial unique index for student_id (only when not null)
-- This ensures student_id is unique within a college, but only when it's provided
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_college_student_id_unique 
ON students(college_id, student_id) 
WHERE student_id IS NOT NULL;

-- ============================================
-- UPDATE EXISTING TABLES
-- ============================================

-- Add college_id to templates if not exists (already has it, but ensure it's required)
-- Update candidate_batches to include college_id for easier filtering
ALTER TABLE candidate_batches 
ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES colleges(id);

CREATE INDEX IF NOT EXISTS idx_batches_college ON candidate_batches(college_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_colleges_updated_at ON colleges;
CREATE TRIGGER update_colleges_updated_at 
  BEFORE UPDATE ON colleges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_college_users_updated_at ON college_users;
CREATE TRIGGER update_college_users_updated_at 
  BEFORE UPDATE ON college_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_students_updated_at ON students;
CREATE TRIGGER update_students_updated_at 
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SAMPLE DATA (for testing - remove in production)
-- ============================================

-- Note: Password hash is for "password123" - change in production!
-- You can generate new hashes using: bcrypt.hashSync('password', 10)
INSERT INTO colleges (id, name, email, password_hash) 
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Test College', 'admin@testcollege.edu', '$2b$10$rOzJqZqZqZqZqZqZqZqZqOqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZq')
ON CONFLICT (email) DO NOTHING;

