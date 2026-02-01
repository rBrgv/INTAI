import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase';

export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'ok' as const,
    services: {
      openai: !!process.env.OPENAI_API_KEY,
      supabase: isSupabaseConfigured(),
    },
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
  };

  const allHealthy = checks.services.openai && checks.services.supabase;
  
  return NextResponse.json(checks, {
    status: allHealthy ? 200 : 503,
  });
}

