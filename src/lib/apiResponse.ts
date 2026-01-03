/**
 * Standardized API Response Helpers
 * Ensures consistent response format across all API routes
 */

export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: Record<string, any>;
};

export function successResponse<T>(
  data: T,
  message?: string,
  meta?: Record<string, any>
): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(message && { message }),
    ...(meta && { meta }),
  };
}

export function errorResponse(
  error: string,
  message?: string,
  statusCode?: number,
  meta?: Record<string, any>
): ApiResponse<never> {
  return {
    success: false,
    error,
    ...(message && { message }),
    ...(meta && { meta }),
  };
}

/**
 * Helper to create NextResponse with standardized format
 */
import { NextResponse } from 'next/server';

export function apiSuccess<T>(
  data: T,
  message?: string,
  status: number = 200,
  meta?: Record<string, any>
) {
  return NextResponse.json(successResponse(data, message, meta), { status });
}

export function apiError(
  error: string,
  message?: string,
  status: number = 500,
  details?: string | Record<string, any>
) {
  const response: ApiResponse<never> = {
    success: false,
    error,
    ...(message && { message }),
    ...(details && { details }),
  };
  return NextResponse.json(response, { status });
}

