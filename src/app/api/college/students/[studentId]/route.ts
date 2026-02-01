import { NextRequest } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requireAuthAPI } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/apiResponse';
import { sanitizeForStorage } from '@/lib/sanitize';
import { logger } from '@/lib/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const session = requireAuthAPI(req);
    
    if (!isSupabaseConfigured() || !supabase) {
      return apiError("Configuration error", "Database not configured", 500);
    }

    const { data: student, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', params.studentId)
      .eq('college_id', session.collegeId)
      .single();

    if (error || !student) {
      return apiError("Student not found", "The requested student does not exist", 404);
    }

    return apiSuccess({ student });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return apiError("Unauthorized", "Please log in to access this resource", 401);
    }
    logger.error("Error in GET /api/college/students/[studentId]", error instanceof Error ? error : new Error(String(error)));
    return apiError("Internal server error", "An unexpected error occurred", 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const session = requireAuthAPI(req);
    
    if (!isSupabaseConfigured() || !supabase) {
      return apiError("Configuration error", "Database not configured", 500);
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return apiError("Invalid JSON", "Request body must be valid JSON", 400);
    }

    // Verify student belongs to college
    const { data: existing } = await supabase
      .from('students')
      .select('id')
      .eq('id', params.studentId)
      .eq('college_id', session.collegeId)
      .single();

    if (!existing) {
      return apiError("Student not found", "The requested student does not exist", 404);
    }

    const { email, name, studentId, phone, department, year, batch } = body;

    // Check for duplicate email (excluding current student)
    if (email) {
      const { data: duplicate } = await supabase
        .from('students')
        .select('id')
        .eq('college_id', session.collegeId)
        .eq('email', email.toLowerCase())
        .neq('id', params.studentId)
        .single();

      if (duplicate) {
        return apiError("Duplicate email", "A student with this email already exists", 409);
      }
    }

    // Check for duplicate student_id (excluding current student)
    if (studentId) {
      const { data: duplicateId } = await supabase
        .from('students')
        .select('id')
        .eq('college_id', session.collegeId)
        .eq('student_id', studentId)
        .neq('id', params.studentId)
        .single();

      if (duplicateId) {
        return apiError("Duplicate student ID", "A student with this ID already exists", 409);
      }
    }

    const updateData: any = {};
    if (email) updateData.email = sanitizeForStorage(email.toLowerCase());
    if (name) updateData.name = sanitizeForStorage(name);
    if (studentId !== undefined) updateData.student_id = studentId ? sanitizeForStorage(studentId) : null;
    if (phone !== undefined) updateData.phone = phone ? sanitizeForStorage(phone) : null;
    if (department !== undefined) updateData.department = department ? sanitizeForStorage(department) : null;
    if (year !== undefined) updateData.year = year ? sanitizeForStorage(year) : null;
    if (batch !== undefined) updateData.batch = batch ? sanitizeForStorage(batch) : null;

    const { data: student, error } = await supabase
      .from('students')
      .update(updateData)
      .eq('id', params.studentId)
      .eq('college_id', session.collegeId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating student', error instanceof Error ? error : new Error(String(error)), { studentId: params.studentId });
      return apiError("Failed to update student", "Database error", 500);
    }

    return apiSuccess({ student }, "Student updated successfully");
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return apiError("Unauthorized", "Please log in to access this resource", 401);
    }
    logger.error("Error in PUT /api/college/students/[studentId]", error instanceof Error ? error : new Error(String(error)));
    return apiError("Internal server error", "An unexpected error occurred", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const session = requireAuthAPI(req);
    
    if (!isSupabaseConfigured() || !supabase) {
      return apiError("Configuration error", "Database not configured", 500);
    }

    // Verify student belongs to college
    const { data: existing } = await supabase
      .from('students')
      .select('id')
      .eq('id', params.studentId)
      .eq('college_id', session.collegeId)
      .single();

    if (!existing) {
      return apiError("Student not found", "The requested student does not exist", 404);
    }

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', params.studentId)
      .eq('college_id', session.collegeId);

    if (error) {
      logger.error('Error deleting student', error instanceof Error ? error : new Error(String(error)), { studentId: params.studentId });
      return apiError("Failed to delete student", "Database error", 500);
    }

    return apiSuccess({}, "Student deleted successfully");
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return apiError("Unauthorized", "Please log in to access this resource", 401);
    }
    logger.error("Error in DELETE /api/college/students/[studentId]", error instanceof Error ? error : new Error(String(error)));
    return apiError("Internal server error", "An unexpected error occurred", 500);
  }
}

