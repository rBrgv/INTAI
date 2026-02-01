import { NextRequest } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { hashPassword } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.name || !body.email || !body.password) {
      return apiError("Invalid request", "Name, email, and password are required", 400);
    }

    if (!isSupabaseConfigured() || !supabase) {
      return apiError("Configuration error", "Database not configured", 500);
    }

    const { name, email, password, contactPerson, phone, address } = body;

    // Validate password strength
    if (password.length < 8) {
      return apiError("Validation failed", "Password must be at least 8 characters", 400);
    }

    // Check if college already exists
    const { data: existing } = await supabase
      .from('colleges')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return apiError("Email already registered", "A college with this email already exists", 409);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create college
    const { data: college, error: collegeError } = await supabase
      .from('colleges')
      .insert({
        name,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        contact_person: contactPerson,
        phone,
        address,
      })
      .select()
      .single();

    if (collegeError) {
      logger.error('Error creating college', collegeError instanceof Error ? collegeError : new Error(String(collegeError)), { email });
      return apiError("Registration failed", "Failed to create college account", 500);
    }

    // Create session
    const session = {
      collegeId: college.id,
      collegeName: college.name,
      userEmail: college.email,
      userId: college.id,
      role: 'admin' as const,
    };

    const response = apiSuccess({ session, collegeId: college.id }, "Registration successful");
    response.cookies.set('college_session', JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    logger.error("Registration error", error instanceof Error ? error : new Error(String(error)));
    return apiError(
      "Internal server error",
      error instanceof Error ? error.message : "An unexpected error occurred",
      500
    );
  }
}

