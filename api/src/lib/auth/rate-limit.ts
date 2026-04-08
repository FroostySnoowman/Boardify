interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMITS = {
  signUp: { max: 5, window: 15 * 60 * 1000 },
  signIn: { max: 10, window: 15 * 60 * 1000 },
  oauth: { max: 10, window: 15 * 60 * 1000 },
  passwordReset: { max: 5, window: 60 * 60 * 1000 },
} as const;

type RateLimitType = keyof typeof RATE_LIMITS;

function getClientId(request: Request): string {
  const cfIp = request.headers.get('CF-Connecting-IP');
  if (cfIp) {
    return cfIp;
  }

  const forwardedFor = request.headers.get('X-Forwarded-For');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return 'unknown';
}

function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

export function checkRateLimit(
  request: Request,
  type: RateLimitType
): { allowed: boolean; resetAt?: number; remaining?: number } {
  if (Math.random() < 0.01) {
    cleanupExpiredEntries();
  }

  const clientId = getClientId(request);
  const key = `${type}:${clientId}`;
  const config = RATE_LIMITS[type];
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.window,
    });
    return {
      allowed: true,
      resetAt: now + config.window,
      remaining: config.max - 1,
    };
  }

  if (entry.count >= config.max) {
    return {
      allowed: false,
      resetAt: entry.resetAt,
      remaining: 0,
    };
  }

  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    resetAt: entry.resetAt,
    remaining: config.max - entry.count,
  };
}

export function resetRateLimit(request: Request, type: RateLimitType): void {
  const clientId = getClientId(request);
  const key = `${type}:${clientId}`;
  rateLimitStore.delete(key);
}
