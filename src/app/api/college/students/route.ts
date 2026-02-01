import { NextRequest } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requireAuthAPI } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/apiResponse';
import { sanitizeForStorage } from '@/lib/sanitize';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const session = requireAuthAPI(req);
    
    if (!isSupabaseConfigured() || !supabase) {
      return apiError("Configuration error", "Database not configured", 500);
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const department = searchParams.get("department");

    let query = supabase
      .from('students')
      .select('*')
      .eq('college_id', session.collegeId)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,student_id.ilike.%${search}%`);
    }

    if (department) {
      query = query.eq('department', department);
    }

    const { data: students, error } = await query;

    if (error) {
      logger.error('Error fetching students', error instanceof Error ? error : new Error(String(error)), { collegeId: session.collegeId });
      return apiError("Failed to fetch students", "Database error", 500);
    }

    return apiSuccess({ students: students || [] });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return apiError("Unauthorized", "Please log in to access this resource", 401);
    }
    logger.error("Error in GET /api/college/students", error instanceof Error ? error : new Error(String(error)));
    return apiError("Internal server error", "An unexpected error occurred", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuthAPI(req);
    
    if (!isSupabaseConfigured() || !supabase) {
      return apiError("Configuration error", "Database not configured", 500);
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return apiError("Invalid JSON", "Request body must be valid JSON", 400);
    }

    const { email, name, studentId, phone, department, year, batch } = body;

    if (!email || !name) {
      return apiError("Validation failed", "Email and name are required", 400);
    }

    // Check for duplicate email within college
    const { data: existing } = await supabase
      .from('students')
      .select('id')
      .eq('college_id', session.collegeId)
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return apiError("Duplicate email", "A student with this email already exists", 409);
    }

    // Check for duplicate student_id if provided
    if (studentId) {
      const { data: existingId } = await supabase
        .from('students')
        .select('id')
        .eq('college_id', session.collegeId)
        .eq('student_id', studentId)
        .single();

      if (existingId) {
        return apiError("Duplicate student ID", "A student with this ID already exists", 409);
      }
    }

    const { data: student, error } = await supabase
      .from('students')
      .insert({
        college_id: session.collegeId,
        email: sanitizeForStorage(email.toLowerCase()),
        name: sanitizeForStorage(name),
        student_id: studentId ? sanitizeForStorage(studentId) : null,
        phone: phone ? sanitizeForStorage(phone) : null,
        department: department ? sanitizeForStorage(department) : null,
        year: year ? sanitizeForStorage(year) : null,
        batch: batch ? sanitizeForStorage(batch) : null,
        created_by: session.userEmail,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating student', error instanceof Error ? error : new Error(String(error)), { collegeId: session.collegeId });
      return apiError("Failed to create student", "Database error", 500);
    }

    return apiSuccess({ student }, "Student created successfully", 201);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return apiError("Unauthorized", "Please log in to access this resource", 401);
    }
    logger.error("Error in POST /api/college/students", error instanceof Error ? error : new Error(String(error)));
    return apiError("Internal server error", "An unexpected error occurred", 500);
  }
}

