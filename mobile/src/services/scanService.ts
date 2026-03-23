import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  type Unsubscribe,
  getDocs,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';

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
  hazardFlags?: any;
  escalationRequired?: boolean;
  imageThumb?: string;
  scanMode: 'single' | 'multi-view';
  source: 'mobile' | 'raspberry_pi';
  deviceId?: string;
  passportId?: string;
  // Optional extra fields when scans were created by the web app
  fullPayload?: string;
  guide?: string;
  dpp?: string;
}

export type Stats = {
  scannedToday: number;
  avgWRI: number;
  totalValueUSD: number;
  gradeAPct: number;
};

export function subscribeToRecentScans(
  limitCount: number,
  onData: (scans: ScanRecord[]) => void,
): Unsubscribe {
  const constraints: QueryConstraint[] = [];
  if (auth.currentUser?.uid) {
    constraints.push(where('workerId', '==', auth.currentUser.uid));
  }
  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(limitCount));

  const q = query(
    collection(db, 'scans'),
    ...constraints,
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
      console.warn('[mobile scanService] snapshot error', err);
      onData([]);
    },
  );
}

export async function getScanByPassportId(
  passportId: string,
): Promise<ScanRecord | null> {
  const q = query(
    collection(db, 'scans'),
    where('passportId', '==', passportId),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...(doc.data() as Omit<ScanRecord, 'id'>) };
}

export function computeStats(scans: ScanRecord[]): Stats {
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
      ? Math.round(
          (scans.reduce((s, sc) => s + sc.wriScore, 0) / scans.length) * 100,
        ) / 100
      : 0;

  const totalValue = scans.reduce(
    (s, sc) => s + (sc.recoveryValueUSD || 0),
    0,
  );

  const gradeACount = scans.filter((s) => s.grade === 'A').length;
  const gradeAPct = scans.length > 0
    ? Math.round((gradeACount / scans.length) * 100)
    : 0;

  return {
    scannedToday: todayScans.length,
    avgWRI,
    totalValueUSD: Math.round(totalValue * 100) / 100,
    gradeAPct,
  };
}

export function relativeTime(ts: Timestamp): string {
  const now = Date.now();
  const ms = ts.toMillis();
  const diff = now - ms;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  const d = ts.toDate();
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}
