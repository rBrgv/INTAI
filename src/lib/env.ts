/**
 * Environment Variable Validation
 * Validates required and optional environment variables at startup
 */

import { z } from 'zod';

const envSchema = z.object({
  // Required
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  
  // Optional (Supabase)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional().or(z.literal('')),
  
  // Optional (Node environment)
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

export function getEnv(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  try {
    validatedEnv = envSchema.parse({
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NODE_ENV: process.env.NODE_ENV || 'development',
    });
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.issues.map(e => e.path.join('.')).join(', ');
      throw new Error(`Invalid environment variables: ${missing}`);
    }
    throw error;
  }
}

// Validate on import (server-side only)
if (typeof window === 'undefined') {
  try {
    getEnv();
  } catch (error) {
    // Only log in development to avoid breaking builds
    if (process.env.NODE_ENV === 'development') {
      console.warn('Environment validation warning:', error instanceof Error ? error.message : error);
    }
  }
}

