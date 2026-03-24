/**
 * offlineQueue.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight offline scan queue backed by localStorage.
 *
 * When a scan is submitted without internet connectivity the payload is saved
 * here. On the next page load (or when the browser fires the 'online' event)
 * all queued scans are replayed through the normal saveScan() pipeline.
 *
 * Usage:
 *   import { enqueueOfflineScan, flushOfflineQueue, getOfflineQueueSize } from '@/lib/offlineQueue';
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { PartMetadataPayload, DigitalProductPassport } from '@/types';
import type { ScanContext } from '@/lib/scanService';

const STORAGE_KEY = 'ecotrack_offline_queue';
const MAX_QUEUE_SIZE = 20; // prevent runaway storage use

export interface QueuedScan {
    id: string;               // local UUID for deduplication
    queuedAt: number;         // epoch ms
    payload: PartMetadataPayload;
    imageDataUrl: string;
    scanMode: 'single' | 'multi-view';
    guide: object;
    dpp: DigitalProductPassport | Record<string, never>;
    source: 'web' | 'mobile' | 'raspberry_pi';
    deviceId?: string;
    ctx?: ScanContext;
}

function loadQueue(): QueuedScan[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as QueuedScan[]) : [];
    } catch {
        return [];
    }
}

function saveQueue(queue: QueuedScan[]): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {
        // Storage full — silently drop the oldest item
        const trimmed = queue.slice(1);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch { /* ignore */ }
    }
}

function uuid(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Add a scan to the offline queue. Returns the local queue ID. */
export function enqueueOfflineScan(
    payload: PartMetadataPayload,
    imageDataUrl: string,
    scanMode: 'single' | 'multi-view' = 'single',
    guide: object = {},
    dpp: DigitalProductPassport | Record<string, never> = {},
    source: 'web' | 'mobile' | 'raspberry_pi' = 'web',
    deviceId?: string,
    ctx?: ScanContext,
): string {
    const queue = loadQueue();
    if (queue.length >= MAX_QUEUE_SIZE) {
        // Drop oldest to prevent unbounded growth
        queue.shift();
    }
    const id = uuid();
    queue.push({ id, queuedAt: Date.now(), payload, imageDataUrl, scanMode, guide, dpp, source, deviceId, ctx });
    saveQueue(queue);
    return id;
}

/** How many scans are waiting to be uploaded. */
export function getOfflineQueueSize(): number {
    return loadQueue().length;
}

/**
 * Try to flush all queued scans to Firestore.
 * Requires an online connection — call this in a 'online' event listener
 * or on app startup.
 *
 * Returns the number of successfully uploaded scans.
 */
export async function flushOfflineQueue(): Promise<number> {
    if (typeof window === 'undefined' || !navigator.onLine) return 0;

    const queue = loadQueue();
    if (queue.length === 0) return 0;

    // Dynamic import to avoid circular deps and keep this tree-shakeable
    const { saveScan } = await import('@/lib/scanService');

    let uploaded = 0;
    const remaining: QueuedScan[] = [];

    for (const item of queue) {
        try {
            await saveScan(
                item.payload,
                item.imageDataUrl,
                item.scanMode,
                item.guide,
                item.dpp,
                item.source,
                item.deviceId,
                item.ctx,
            );
            uploaded++;
        } catch (err) {
            console.warn('[offlineQueue] Failed to upload queued scan:', err);
            remaining.push(item); // keep it — will retry next time
        }
    }

    saveQueue(remaining);
    return uploaded;
}

/** Remove a specific queued scan by its local ID (e.g. user cancels). */
export function removeFromQueue(localId: string): void {
    const queue = loadQueue().filter(item => item.id !== localId);
    saveQueue(queue);
}

/** Clear the entire queue (e.g. user signs out). */
export function clearOfflineQueue(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
}
