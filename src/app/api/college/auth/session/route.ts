import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/apiResponse';

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return apiError("Not authenticated", "No active session", 401);
  }
  return apiSuccess({ session });
}

