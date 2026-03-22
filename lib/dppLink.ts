const DEFAULT_PUBLIC_APP_URL = 'https://aiecotracker.vercel.app';

function normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

export function getPublicAppUrl(): string {
    const envBase = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (envBase) return normalizeBaseUrl(envBase);

    if (typeof window !== 'undefined' && window.location?.origin) {
        return normalizeBaseUrl(window.location.origin);
    }

    return DEFAULT_PUBLIC_APP_URL;
}

export function buildDppShareUrl(passportId: string): string {
    const safeId = encodeURIComponent(passportId);
    return `${getPublicAppUrl()}/dpp/${safeId}`;
}
