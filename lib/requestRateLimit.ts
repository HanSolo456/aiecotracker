import type { NextRequest } from 'next/server';

type Bucket = {
    count: number;
    resetAt: number;
};

type RateLimitConfig = {
    keyPrefix: string;
    limit: number;
    windowMs: number;
    keySuffix?: string;
};

type RateLimitResult = {
    allowed: boolean;
    retryAfterSec: number;
};

const buckets = new Map<string, Bucket>();

function getClientIp(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0]?.trim() || 'unknown';
    }

    return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function checkRateLimit(
    request: NextRequest,
    config: RateLimitConfig,
): RateLimitResult {
    const now = Date.now();
    const ip = getClientIp(request);
    const subject = config.keySuffix?.trim() || ip;
    const key = `${config.keyPrefix}:${subject}`;
    const existing = buckets.get(key);

    if (!existing || now >= existing.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + config.windowMs });
        return { allowed: true, retryAfterSec: Math.ceil(config.windowMs / 1000) };
    }

    if (existing.count >= config.limit) {
        return {
            allowed: false,
            retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
        };
    }

    existing.count += 1;
    buckets.set(key, existing);
    return {
        allowed: true,
        retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
}
