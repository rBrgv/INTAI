type Bucket = {
  count: number;
  resetAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __RL_BUCKETS__: Map<string, Bucket> | undefined;
}

const buckets = globalThis.__RL_BUCKETS__ ?? new Map<string, Bucket>();
globalThis.__RL_BUCKETS__ = buckets;

export function rateLimit(args: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  const b = buckets.get(args.key);

  if (!b || now > b.resetAt) {
    buckets.set(args.key, { count: 1, resetAt: now + args.windowMs });
    return { ok: true, remaining: args.limit - 1, resetAt: now + args.windowMs };
  }

  if (b.count >= args.limit) {
    return { ok: false, remaining: 0, resetAt: b.resetAt };
  }

  b.count += 1;
  buckets.set(args.key, b);

  return { ok: true, remaining: args.limit - b.count, resetAt: b.resetAt };
}

