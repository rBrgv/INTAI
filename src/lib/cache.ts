/**
 * Performance optimization utilities for caching API responses
 */

// Simple in-memory cache for session data
const sessionCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds - short lived for fresh data

export function getCachedSession(sessionId: string): any | null {
    const cached = sessionCache.get(sessionId);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > CACHE_TTL) {
        sessionCache.delete(sessionId);
        return null;
    }

    return cached.data;
}

export function setCachedSession(sessionId: string, data: any): void {
    sessionCache.set(sessionId, {
        data,
        timestamp: Date.now(),
    });

    // Clean up old entries periodically
    if (sessionCache.size > 100) {
        const now = Date.now();
        for (const [key, value] of sessionCache.entries()) {
            if (now - value.timestamp > CACHE_TTL * 2) {
                sessionCache.delete(key);
            }
        }
    }
}

export function invalidateCachedSession(sessionId: string): void {
    sessionCache.delete(sessionId);
}

export function clearSessionCache(): void {
    sessionCache.clear();
}
