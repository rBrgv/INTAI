/**
 * Authentication utilities for College Mode
 * Simple session-based authentication using Next.js cookies
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export type CollegeSession = {
  collegeId: string;
  collegeName: string;
  userEmail: string;
  userId: string;
  role: 'admin' | 'viewer';
};

// Hash password (for registration)
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Get session from cookies (server component)
export async function getCollegeSession(): Promise<CollegeSession | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('college_session');
    if (!sessionCookie?.value) {
      return null;
    }
    return JSON.parse(sessionCookie.value) as CollegeSession;
  } catch {
    return null;
  }
}

// Get session from request (for API routes)
export function getSessionFromRequest(req: NextRequest): CollegeSession | null {
  try {
    const sessionCookie = req.cookies.get('college_session');
    if (!sessionCookie?.value) {
      return null;
    }
    return JSON.parse(sessionCookie.value) as CollegeSession;
  } catch {
    return null;
  }
}

// Check if user is authenticated (server component)
export async function requireAuth(): Promise<CollegeSession> {
  const session = await getCollegeSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

// Check if user is authenticated (API route)
export function requireAuthAPI(req: NextRequest): CollegeSession {
  const session = getSessionFromRequest(req);
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

