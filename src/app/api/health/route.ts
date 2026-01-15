import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase';

export const maxDuration = 10; // Health check should be fast
export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = {
    supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    openai: !!process.env.OPENAI_API_KEY,
    serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    timestamp: Date.now(),
    environment: process.env.NODE_ENV || 'development',
    vercelEnv: process.env.VERCEL_ENV || 'unknown',
  };
  
  return NextResponse.json({
    status: 'ok',
    checks,
  });
}

