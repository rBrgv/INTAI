import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/apiResponse';

export async function POST(req: NextRequest) {
  const response = apiSuccess({}, "Logged out successfully");
  response.cookies.delete('college_session');
  return response;
}

