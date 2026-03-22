'use client';

export function getSessionValue(key: string): string | null {
    try {
        return sessionStorage.getItem(key);
    } catch {
        return null;
    }
}

export function setSessionValue(key: string, value: string): boolean {
    try {
        sessionStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

export function removeSessionValue(key: string): void {
    try {
        sessionStorage.removeItem(key);
    } catch {
        // Ignore storage access failures.
    }
}

export function getSessionJSON<T>(key: string): T | null {
    const value = getSessionValue(key);
    if (!value) return null;

    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

export function setSessionJSON(key: string, value: unknown): boolean {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}
