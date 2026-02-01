type Bucket = {
  count: number;
  resetAt: number;
  violations: number; // Track repeated violations
  blockedUntil?: number; // Temporary block after repeated violations
};

declare global {
  // eslint-disable-next-line no-var
  var __RL_BUCKETS__: Map<string, Bucket> | undefined;
}

const buckets = globalThis.__RL_BUCKETS__ ?? new Map<string, Bucket>();
globalThis.__RL_BUCKETS__ = buckets;

// Clean up old buckets periodically (every 5 minutes)
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      // Remove expired buckets and unblocked IPs
      if (now > bucket.resetAt && (!bucket.blockedUntil || now > bucket.blockedUntil)) {
        buckets.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export function rateLimit(args: {
  key: string;
  limit: number;
  windowMs: number;
  blockAfterViolations?: number; // Block after N violations (default: 5)
  blockDurationMs?: number; // Block duration in ms (default: 15 minutes)
}) {
  const now = Date.now();
  const blockAfterViolations = args.blockAfterViolations ?? 5;
  const blockDurationMs = args.blockDurationMs ?? 15 * 60 * 1000; // 15 minutes

  const b = buckets.get(args.key);

  // Check if currently blocked
  if (b?.blockedUntil && now < b.blockedUntil) {
    return { 
      ok: false, 
      remaining: 0, 
      resetAt: b.resetAt,
      blocked: true,
      blockedUntil: b.blockedUntil,
    };
  }

  // Reset block if expired
  if (b?.blockedUntil && now >= b.blockedUntil) {
    b.blockedUntil = undefined;
  }

  if (!b || now > b.resetAt) {
    buckets.set(args.key, { 
      count: 1, 
      resetAt: now + args.windowMs,
      violations: 0,
    });
    return { ok: true, remaining: args.limit - 1, resetAt: now + args.windowMs };
  }

  if (b.count >= args.limit) {
    // Increment violation count
    b.violations = (b.violations || 0) + 1;
    
    // Block if too many violations
    if (b.violations >= blockAfterViolations) {
      b.blockedUntil = now + blockDurationMs;
      buckets.set(args.key, b);
      return { 
        ok: false, 
        remaining: 0, 
        resetAt: b.resetAt,
        blocked: true,
        blockedUntil: b.blockedUntil,
        violations: b.violations,
      };
    }

    buckets.set(args.key, b);
    return { 
      ok: false, 
      remaining: 0, 
      resetAt: b.resetAt,
      violations: b.violations,
    };
  }

  b.count += 1;
  // Reset violations on successful request (within limit)
  if (b.violations > 0 && b.count < args.limit * 0.5) {
    b.violations = 0;
  }
  buckets.set(args.key, b);

  return { ok: true, remaining: args.limit - b.count, resetAt: b.resetAt };
}


