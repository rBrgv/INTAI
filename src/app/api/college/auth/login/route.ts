import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { verifyPassword, hashPassword } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.email || !body.password) {
      return apiError("Invalid request", "Email and password are required", 400);
    }

    if (!isSupabaseConfigured() || !supabase) {
      return apiError("Configuration error", "Database not configured", 500);
    }

    const { email, password } = body;

    // Try to find in colleges table first (main college account)
    const { data: college, error: collegeError } = await supabase
      .from('colleges')
      .select('id, name, email, password_hash, is_active')
      .eq('email', email.toLowerCase())
      .single();

    if (collegeError && collegeError.code !== 'PGRST116') {
      logger.error('Error fetching college', collegeError instanceof Error ? collegeError : new Error(String(collegeError)), { email });
      return apiError("Login failed", "Invalid email or password", 401);
    }

    // If found in colleges table
    if (college) {
      if (!college.is_active) {
        return apiError("Account disabled", "Your college account has been disabled", 403);
      }

      const isValid = await verifyPassword(password, college.password_hash);
      if (!isValid) {
        return apiError("Login failed", "Invalid email or password", 401);
      }

      // Create session
      const session = {
        collegeId: college.id,
        collegeName: college.name,
        userEmail: college.email,
        userId: college.id,
        role: 'admin' as const,
      };

      const response = apiSuccess({ session }, "Login successful");
      response.cookies.set('college_session', JSON.stringify(session), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });

      return response;
    }

    // Try to find in college_users table
    const { data: user, error: userError } = await supabase
      .from('college_users')
      .select('id, college_id, email, password_hash, role, is_active, colleges(id, name)')
      .eq('email', email.toLowerCase())
      .single();

    if (userError || !user) {
      return apiError("Login failed", "Invalid email or password", 401);
    }

    if (!user.is_active) {
      return apiError("Account disabled", "Your account has been disabled", 403);
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return apiError("Login failed", "Invalid email or password", 401);
    }

    // Get college info
    const collegeInfo = user.colleges as any;
    if (!collegeInfo) {
      return apiError("Configuration error", "College not found", 500);
    }

    // Create session
    const session = {
      collegeId: user.college_id,
      collegeName: collegeInfo.name,
      userEmail: user.email,
      userId: user.id,
      role: user.role as 'admin' | 'viewer',
    };

    const response = apiSuccess({ session }, "Login successful");
    response.cookies.set('college_session', JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    logger.error("Login error", error instanceof Error ? error : new Error(String(error)));
    return apiError(
      "Internal server error",
      error instanceof Error ? error.message : "An unexpected error occurred",
      500
    );
  }
}

