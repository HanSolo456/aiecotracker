import {
    collection,
    addDoc,
    doc,
    query,
    orderBy,
    limit,
    where,
    getDocs,
    getDoc,
    onSnapshot,
    Timestamp,
    type QueryConstraint,
    type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PartMetadataPayload, DigitalProductPassport } from '@/types';
import { removeSessionValue, setSessionValue } from '@/lib/sessionState';

// ─────────────────────────────────────────────────────────────────────────────
// Scan Service — Firestore persistence layer
//
// All reads/writes are centralised here to keep Firebase out of UI components.
// ─────────────────────────────────────────────────────────────────────────────

export interface ScanRecord {
    id?: string;
    createdAt: Timestamp;
    partName: string;
    subtype: string | null;
    material: string;
    alloyGrade: string | null;
    surfaceCondition: string;
    partConfidence: number;
    materialConfidence: number;
    estimatedMassKg: number | null;
    nominalSizeMm: number | null;
    wriScore: number;
    recoveryValueUSD: number;
    grade: 'A' | 'B' | 'C';
    hazardFlags: PartMetadataPayload['hazard_flags'];
    escalationRequired: boolean;
    imageThumb: string;
    scanMode: 'single' | 'multi-view';
    source: 'web' | 'mobile' | 'raspberry_pi';   // Where this scan originated
    deviceId?: string;                    // Pi device ID, if applicable
    passportId?: string;                  // DPP passport_metadata.passport_id for QR deep-links
    // ── Phase 4: Org / worker context ─────────────────────────────────────────
    orgId?: string;       // Organisation that owns this scan
    workerId?: string;    // UID of the user who triggered the scan
    workerName?: string;  // Display name at time of scan
    // Full data for restoring the result page
    fullPayload: string;  // JSON string of PartMetadataPayload
    guide: string;        // JSON string of guide object
    dpp: string;          // JSON string of DPP object
}

type DppRecoveryShape = {
    material_composition?: {
        total_theoretical_recovery_value_usd?: number;
    };
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Compute WRI (Weighted Recyclability Index) from confidence scores */
function computeWRI(partConf: number, matConf: number): number {
    return Math.round(((partConf + matConf) / 2) * 100) / 100;
}

/** A → ≥0.85, B → 0.65–0.84, C → <0.65 */
function computeGrade(wri: number): 'A' | 'B' | 'C' {
    if (wri >= 0.85) return 'A';
    if (wri >= 0.65) return 'B';
    return 'C';
}

/** Simple recovery value estimate based on material + mass */
const MATERIAL_VALUE_PER_KG: Record<string, number> = {
    '316L_stainless_steel': 2.1,
    carbon_steel: 0.45,
    cast_iron: 0.22,
    copper_alloy: 6.8,
    titanium: 12.0,
    inconel_625: 18.0,
    aluminium_alloy: 1.6,
    PTFE: 3.5,
    unknown: 0.3,
};

function computeRecoveryValue(material: string, massKg: number | null): number {
    const ratePerKg = MATERIAL_VALUE_PER_KG[material] ?? 0.3;
    const mass = massKg ?? 0.5; // default 0.5 kg if unknown (more realistic for e-waste/batteries)
    return Math.round(ratePerKg * mass * 100) / 100;
}

/** Scale-down a base64 image to a ~200px thumbnail using canvas (client-side only) */
async function makeThumbnail(dataUrl: string): Promise<string> {
    if (typeof window === 'undefined') return dataUrl;
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const MAX = 200;
            const scale = Math.min(MAX / img.width, MAX / img.height, 1);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => resolve('');
        img.src = dataUrl;
    });
}

/** Friendly display name from part_class enum */
function friendlyPartName(partClass: string, subtype: string | null): string {
    const names: Record<string, string> = {
        gate_valve: 'Gate Valve',
        centrifugal_pump: 'Centrifugal Pump',
        heat_exchanger: 'Heat Exchanger',
        pressure_vessel: 'Pressure Vessel',
        motor: 'Electric Motor',
        compressor: 'Compressor',
        flange: 'Flange',
        pipe_fitting: 'Pipe Fitting',
        circuit_breaker: 'Circuit Breaker',
        transformer: 'Transformer',
        unknown: 'Unknown Part',
    };
    const base = names[partClass] ?? partClass.replace(/_/g, ' ');
    return subtype ? `${base} — ${subtype}` : base;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Save a completed scan to Firestore.
 * Returns the new document ID.
 */
export interface ScanContext {
    orgId?: string;
    workerId?: string;
    workerName?: string;
}

export async function saveScan(
    payload: PartMetadataPayload,
    imageDataUrl: string,
    scanMode: 'single' | 'multi-view' = 'single',
    guide: object = {},
    dpp: DigitalProductPassport | Record<string, never> = {},
    source: 'web' | 'mobile' | 'raspberry_pi' = 'web',
    deviceId?: string,
    ctx?: ScanContext,
): Promise<string> {
    const partConf = payload.visual_id.confidence_score;
    const matConf = payload.material_inference.confidence_score;
    const wri = computeWRI(partConf, matConf);
    const material = payload.material_inference.primary_material;
    const massKg = payload.geometry_descriptor?.estimated_mass_kg ?? null;

    const thumb = await makeThumbnail(imageDataUrl);
    const dppRecoveryValue =
        typeof (dpp as DigitalProductPassport)?.material_composition?.total_theoretical_recovery_value_usd === 'number'
            ? (dpp as DigitalProductPassport).material_composition.total_theoretical_recovery_value_usd
            : null;

    const record: Omit<ScanRecord, 'id'> = {
        createdAt: Timestamp.now(),
        partName: friendlyPartName(payload.visual_id.part_class, payload.visual_id.subtype ?? null),
        subtype: payload.visual_id.subtype ?? null,
        material,
        alloyGrade: payload.material_inference.estimated_alloy_grade ?? null,
        surfaceCondition: payload.material_inference.surface_condition ?? '',
        partConfidence: partConf,
        materialConfidence: matConf,
        estimatedMassKg: massKg,
        nominalSizeMm: payload.geometry_descriptor?.nominal_size_mm ?? null,
        wriScore: wri,
        recoveryValueUSD: dppRecoveryValue ?? computeRecoveryValue(material, massKg),
        grade: computeGrade(wri),
        hazardFlags: payload.hazard_flags,
        escalationRequired: payload.escalation_required ?? false,
        imageThumb: thumb || '',
        scanMode,
        source,
        ...(deviceId ? { deviceId } : {}),
        // Phase 4 org context — only written when the user belongs to an org
        ...(ctx?.orgId     ? { orgId:      ctx.orgId }      : {}),
        ...(ctx?.workerId  ? { workerId:   ctx.workerId }   : {}),
        ...(ctx?.workerName ? { workerName: ctx.workerName } : {}),
        fullPayload: JSON.stringify(payload),
        guide: JSON.stringify(guide),
        dpp: JSON.stringify(dpp),
        passportId: dpp?.passport_metadata?.passport_id ?? undefined,
    };

    const docRef = await addDoc(collection(db, 'scans'), record);
    return docRef.id;
}

/**
 * Subscribe to the most recent N scans in real-time.
 * Returns an unsubscribe function — call it on component unmount.
 */
export function subscribeToRecentScans(
    limitCount: number,
    onData: (scans: ScanRecord[]) => void,
    options?: { workerId?: string }
): Unsubscribe {
    const constraints: QueryConstraint[] = [];
    if (options?.workerId) {
        constraints.push(where('workerId', '==', options.workerId));
    }
    constraints.push(orderBy('createdAt', 'desc'));
    constraints.push(limit(limitCount));

    const q = query(collection(db, 'scans'), ...constraints);
    return onSnapshot(
        q,
        (snap) => {
            const scans: ScanRecord[] = snap.docs.map((doc) => ({
                id: doc.id,
                ...(doc.data() as Omit<ScanRecord, 'id'>),
            }));
            onData(scans);
        },
        (err) => {
            if (err.code === 'permission-denied') {
                console.warn('[scanService] Firestore read permission denied — check security rules:', err.message);
                onData([]);
            } else {
                console.error('[scanService] Snapshot error:', err);
            }
        }
    );
}

/**
 * Subscribe to scans filtered by orgId (for org members' dashboard).
 * Requires the composite index: scans(orgId ASC, createdAt DESC).
 */
export function subscribeToOrgScans(
    orgId: string,
    limitCount: number,
    onData: (scans: ScanRecord[]) => void
): Unsubscribe {
    const q = query(
        collection(db, 'scans'),
        where('orgId', '==', orgId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
    );
    return onSnapshot(
        q,
        (snap) => {
            const scans: ScanRecord[] = snap.docs.map((doc) => ({
                id: doc.id,
                ...(doc.data() as Omit<ScanRecord, 'id'>),
            }));
            onData(scans);
        },
        (err) => {
            if (err.code === 'permission-denied') {
                console.warn('[scanService] Org scans permission denied:', err.message);
                onData([]);
            } else {
                console.error('[scanService] Org snapshot error:', err);
            }
        }
    );
}


/**
 * Subscribe to scans for a specific worker within an org.
 * Requires composite index: scans(orgId ASC, workerId ASC, createdAt DESC).
 */
export function subscribeToWorkerScans(
    orgId: string,
    workerId: string,
    limitCount: number,
    onData: (scans: ScanRecord[]) => void
): Unsubscribe {
    const q = query(
        collection(db, 'scans'),
        where('orgId', '==', orgId),
        where('workerId', '==', workerId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
    );
    return onSnapshot(
        q,
        (snap) => {
            const scans: ScanRecord[] = snap.docs.map((doc) => ({
                id: doc.id,
                ...(doc.data() as Omit<ScanRecord, 'id'>),
            }));
            onData(scans);
        },
        (err) => {
            if (err.code === 'permission-denied') {
                console.warn('[scanService] Worker scans permission denied:', err.message);
                onData([]);
            } else {
                console.error('[scanService] Worker snapshot error:', err);
            }
        }
    );
}

/**
 * Fetch a single scan record by its DPP passport_id.
 * Used by the passport page when opened via QR code (no sessionStorage available).
 */
export async function getScanByPassportId(passportId: string): Promise<ScanRecord | null> {
    const q = query(collection(db, 'scans'), where('passportId', '==', passportId), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as ScanRecord;
}

export async function getScanById(scanId: string): Promise<ScanRecord | null> {
    const ref = doc(db, 'scans', scanId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as ScanRecord;
}

const USD_TO_INR = 83.5;

function parseDppRecoveryInr(dppRaw: string | undefined): number | null {
    if (!dppRaw || dppRaw === '{}' || dppRaw === 'null') return null;
    try {
        const parsed = JSON.parse(dppRaw) as DppRecoveryShape;
        const value = parsed?.material_composition?.total_theoretical_recovery_value_usd;
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
        return Math.round(value * 100) / 100;
    } catch {
        return null;
    }
}

/**
 * Canonical recovery value in INR.
 * Priority:
 * 1) DPP total (already generated in INR in current pipeline)
 * 2) Legacy field converted from USD to INR
 */
export function getScanRecoveryValueINR(scan: Pick<ScanRecord, 'recoveryValueUSD' | 'dpp'>): number {
    const fromDpp = parseDppRecoveryInr(scan.dpp);
    if (fromDpp !== null) return fromDpp;
    return Math.round((scan.recoveryValueUSD ?? 0) * USD_TO_INR * 100) / 100;
}

/**
 * Compute dashboard KPI stats from a list of scans.
 * All monetary values are returned in INR for consistent display.
 */
export function computeStats(scans: ScanRecord[]) {
    const today = new Date();
    const todayScans = scans.filter((s) => {
        const d = s.createdAt.toDate();
        return (
            d.getFullYear() === today.getFullYear() &&
            d.getMonth() === today.getMonth() &&
            d.getDate() === today.getDate()
        );
    });

    const avgWRI =
        scans.length > 0
            ? Math.round((scans.reduce((s, sc) => s + sc.wriScore, 0) / scans.length) * 100) / 100
            : 0;

    const totalValueINR = Math.round(scans.reduce((s, sc) => s + getScanRecoveryValueINR(sc), 0));

    const gradeACount = scans.filter((s) => s.grade === 'A').length;
    const gradeAPct = scans.length > 0 ? Math.round((gradeACount / scans.length) * 100) : 0;

    // CO2 saved: ~2.5 kg CO2 avoided per kg of recovered material
    const totalMassKg = scans.reduce((s, sc) => s + (sc.estimatedMassKg ?? 0.5), 0);
    const co2SavedKg = parseFloat((totalMassKg * 2.5).toFixed(1));

    return {
        scannedToday: todayScans.length,
        avgWRI,
        totalValueINR,   // ₹ — use this everywhere
        totalValueUSD: totalValueINR, // kept for backwards compat
        gradeAPct,
        co2SavedKg,      // kg — use this everywhere
    };
}

/** Format a Firestore Timestamp into a relative time string */
export function relativeTime(ts: Timestamp): string {
    const now = Date.now();
    const ms = ts.toMillis();
    const diff = now - ms;
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    const d = ts.toDate();
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * Restore a historical ScanRecord into sessionStorage so the
 * existing /scan/result, /guide, and /passport pages can display it.
 *
 * Returns true if the restore succeeded, false if data was missing.
 */
export function restoreScanToSession(scan: ScanRecord): boolean {
    try {
        if (!scan.fullPayload) return false;
        if (!setSessionValue('ecotrack_payload', scan.fullPayload)) return false;
        if (!setSessionValue('ecotrack_guide', scan.guide || '{}')) return false;
        if (!setSessionValue('ecotrack_dpp', scan.dpp || '{}')) return false;
        if (scan.imageThumb) {
            if (!setSessionValue('ecotrack_image', scan.imageThumb)) return false;
        } else {
            removeSessionValue('ecotrack_image');
        }
        return true;
    } catch {
        return false;
    }
}
