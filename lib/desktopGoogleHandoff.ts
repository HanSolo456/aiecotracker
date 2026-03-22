import 'server-only';

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

type PendingHandoff = {
    status: 'pending';
    createdAt: number;
    expiresAt: number;
};

type CompletedHandoff = {
    status: 'completed';
    idToken: string;
    createdAt: number;
    expiresAt: number;
};

type FailedHandoff = {
    status: 'failed';
    error: string;
    createdAt: number;
    expiresAt: number;
};

export type DesktopGoogleHandoff = PendingHandoff | CompletedHandoff | FailedHandoff;

const TTL_MS = 5 * 60 * 1000;
const STORE_DIR = path.join(os.tmpdir(), 'aiecotrack-desktop-google-handoff');

function handoffFile(requestId: string): string {
    return path.join(STORE_DIR, `${requestId}.json`);
}

async function ensureStoreDir(): Promise<void> {
    await fs.mkdir(STORE_DIR, { recursive: true });
}

async function pruneExpired(): Promise<void> {
    await ensureStoreDir();

    const now = Date.now();
    const entries = await fs.readdir(STORE_DIR).catch(() => [] as string[]);
    await Promise.all(
        entries.map(async (entry) => {
            const file = path.join(STORE_DIR, entry);
            const raw = await fs.readFile(file, 'utf8').catch(() => null);
            if (!raw) {
                await fs.unlink(file).catch(() => undefined);
                return;
            }

            let parsed: DesktopGoogleHandoff;
            try {
                parsed = JSON.parse(raw) as DesktopGoogleHandoff;
            } catch {
                await fs.unlink(file).catch(() => undefined);
                return;
            }

            if (parsed.expiresAt <= now) {
                await fs.unlink(file).catch(() => undefined);
            }
        }),
    );
}

async function writeHandoff(requestId: string, handoff: DesktopGoogleHandoff): Promise<void> {
    await ensureStoreDir();
    await fs.writeFile(handoffFile(requestId), JSON.stringify(handoff), 'utf8');
}

async function readHandoffFile(requestId: string): Promise<DesktopGoogleHandoff | null> {
    await pruneExpired();

    const raw = await fs.readFile(handoffFile(requestId), 'utf8').catch(() => null);
    if (!raw) return null;

    const handoff = JSON.parse(raw) as DesktopGoogleHandoff;
    if (handoff.expiresAt <= Date.now()) {
        await fs.unlink(handoffFile(requestId)).catch(() => undefined);
        return null;
    }
    return handoff;
}

export async function createDesktopGoogleHandoff(): Promise<{ requestId: string; expiresAt: number }> {
    const requestId = crypto.randomUUID().replace(/-/g, '');
    const expiresAt = Date.now() + TTL_MS;

    await writeHandoff(requestId, {
        status: 'pending',
        createdAt: Date.now(),
        expiresAt,
    });

    return { requestId, expiresAt };
}

export async function readDesktopGoogleHandoff(requestId: string): Promise<DesktopGoogleHandoff | null> {
    return readHandoffFile(requestId);
}

export async function consumeDesktopGoogleHandoff(requestId: string): Promise<DesktopGoogleHandoff | null> {
    const handoff = await readHandoffFile(requestId);
    if (!handoff) return null;

    if (handoff.status === 'completed' || handoff.status === 'failed') {
        await fs.unlink(handoffFile(requestId)).catch(() => undefined);
    }

    return handoff;
}

export async function completeDesktopGoogleHandoff(
    requestId: string,
    idToken: string,
): Promise<DesktopGoogleHandoff | null> {
    const existing = await readHandoffFile(requestId);
    if (!existing) return null;

    const completed: CompletedHandoff = {
        status: 'completed',
        idToken,
        createdAt: existing.createdAt,
        expiresAt: existing.expiresAt,
    };

    await writeHandoff(requestId, completed);
    return completed;
}

export async function failDesktopGoogleHandoff(
    requestId: string,
    error: string,
): Promise<DesktopGoogleHandoff | null> {
    const existing = await readHandoffFile(requestId);
    if (!existing) return null;

    const failed: FailedHandoff = {
        status: 'failed',
        error,
        createdAt: existing.createdAt,
        expiresAt: existing.expiresAt,
    };

    await writeHandoff(requestId, failed);
    return failed;
}
