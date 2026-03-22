'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ScanLine, TrendingUp, Leaf, DollarSign,
    Users, ChevronLeft, BarChart2, Award, Trophy,
    AlertTriangle, Zap, Droplets, ShieldAlert, Activity,
    Recycle, MapPin, ChevronRight, Settings, Cpu, SlidersHorizontal, LogOut,
} from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getScanRecoveryValueINR, type ScanRecord } from '@/lib/scanService';
import { computeLeaderboard, TIER_CONFIG } from '@/lib/incentiveService';
import { computeBadges, TOTAL_BADGES } from '@/lib/badges';
import BottomNav from '@/components/BottomNav';
import OrgSubNav, { type OrgTab } from '@/components/OrgSubNav';
import LeaderboardPanel from '@/components/org/LeaderboardPanel';
import ImpactPanel from '@/components/org/ImpactPanel';

let orgDashboardCache: { orgId: string; scans: ScanRecord[] } | null = null;

// ── helpers ───────────────────────────────────────────────────────────────────

function dateKey(ts: Timestamp): string {
    const d = ts.toDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function co2Saved(scans: ScanRecord[]): number {
    return parseFloat(scans.reduce((s, sc) => s + (sc.estimatedMassKg ?? 0.5) * 2.5, 0).toFixed(1));
}

// ── chart palette ─────────────────────────────────────────────────────────────

const LIME    = '#84cc16';
const AMBER   = '#f59e0b';
const RED     = '#f87171';
const BLUE    = '#60a5fa';
const TEAL    = '#34d399';
const PURPLE  = '#a78bfa';
const PINK    = '#f472b6';

const MATERIAL_COLORS: Record<string, string> = {
    '316L_stainless_steel': LIME,
    carbon_steel: BLUE,
    cast_iron: AMBER,
    copper_alloy: TEAL,
    titanium: PURPLE,
    inconel_625: PINK,
    aluminium_alloy: '#38bdf8',
    PTFE_seat_ring: '#fb923c',
    lithium_compound: RED,
    FR4_fibreglass: AMBER,
    silicon: TEAL,
    polypropylene: BLUE,
};
function materialColor(key: string): string {
    return MATERIAL_COLORS[key] ?? '#6b7280';
}

// ── sub-components (StatCard) ─────────────────────────────────────────────────

function StatCard({
    icon, label, value, sub, color = LIME,
}: { icon: React.ReactNode; label: string; value: string; sub?: string; color?: string }) {
    return (
        <div className="rounded-2xl p-4 flex flex-col gap-2"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${color}18` }}>
                    <span style={{ color }}>{icon}</span>
                </div>
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{label}</span>
            </div>
            <p className="text-2xl font-bold text-white leading-none" style={{ fontFamily: 'Space Grotesk' }}>{value}</p>
            {sub && <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
        </div>
    );
}

// ── Chart: Upgraded Scan Activity Bar (14-day) ────────────────────────────────

function ScanActivityChart({ data }: { data: { label: string; count: number }[] }) {
    const max = Math.max(...data.map(d => d.count), 1);
    const today = todayKey();
    const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    return (
        <div>
            {/* bars */}
            <div className="flex items-end gap-[3px] h-20">
                {data.map((d, i) => {
                    const isToday = d.label === today;
                    const barH = Math.max(4, (d.count / max) * 72);
                    const dayOfWeek = new Date(d.label + 'T00:00:00').getDay();
                    return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.label}: ${d.count} scan${d.count !== 1 ? 's' : ''}`}>
                            {/* count label on top */}
                            <span className="text-[8px] font-semibold leading-none"
                                style={{ color: d.count > 0 ? (isToday ? LIME : 'var(--text-dim)') : 'transparent' }}>
                                {d.count > 0 ? d.count : ''}
                            </span>
                            <div className="w-full rounded-t-sm transition-all duration-300"
                                style={{
                                    height: `${barH}px`,
                                    background: isToday
                                        ? LIME
                                        : d.count > 0
                                            ? `${LIME}70`
                                            : 'var(--border)',
                                    boxShadow: isToday && d.count > 0 ? `0 0 8px ${LIME}60` : undefined,
                                }}
                            />
                            {/* day-of-week label */}
                            <span className="text-[7px] leading-none mt-0.5"
                                style={{ color: isToday ? LIME : 'var(--text-muted)' }}>
                                {DAY_LABELS[dayOfWeek]}
                            </span>
                        </div>
                    );
                })}
            </div>
            <div className="flex justify-between mt-1">
                <span className="text-[9px]" style={{ color: '#374151' }}>14d ago</span>
                <span className="text-[9px]" style={{ color: LIME }}>Today</span>
            </div>
        </div>
    );
}

// ── Chart: Grade Distribution Donut ──────────────────────────────────────────

function DonutChart({ a, b, c }: { a: number; b: number; c: number }) {
    const total = a + b + c;
    if (total === 0) return (
        <div className="flex items-center justify-center h-28 text-xs" style={{ color: 'var(--text-dim)' }}>
            No data yet
        </div>
    );

    // SVG donut via strokeDasharray
    const R = 38;
    const CIRC = 2 * Math.PI * R;
    const cx = 56, cy = 56;

    const slices = [
        { count: a, color: LIME,  label: 'A' },
        { count: b, color: AMBER, label: 'B' },
        { count: c, color: RED,   label: 'C' },
    ];

    let cumPct = 0;
    const rings = slices.map(s => {
        const pct = s.count / total;
        const dash = pct * CIRC;
        const gap  = CIRC - dash;
        // rotate so each slice starts where previous ended
        const rotate = cumPct * 360 - 90;
        cumPct += pct;
        return { ...s, dash, gap, rotate, pct };
    });

    return (
        <div className="flex items-center gap-4">
            {/* SVG donut */}
            <svg width="112" height="112" viewBox="0 0 112 112" className="shrink-0">
                {/* background ring */}
                <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--border)" strokeWidth="14" />
                {rings.map((ring, i) => (
                    <circle key={i}
                        cx={cx} cy={cy} r={R}
                        fill="none"
                        stroke={ring.color}
                        strokeWidth="14"
                        strokeDasharray={`${ring.dash} ${ring.gap}`}
                        strokeLinecap="butt"
                        style={{ transform: `rotate(${ring.rotate}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: 'stroke-dasharray 0.5s' }}
                    />
                ))}
                {/* centre text */}
                <text x={cx} y={cy - 6} textAnchor="middle" fill="white"
                    style={{ fontFamily: 'Space Grotesk', fontSize: '18px', fontWeight: 700 }}>
                    {total}
                </text>
                <text x={cx} y={cy + 10} textAnchor="middle" fill="#6b7280" style={{ fontSize: '8px' }}>
                    scans
                </text>
            </svg>

            {/* legend */}
            <div className="flex flex-col gap-2 flex-1">
                {rings.map(ring => (
                    <div key={ring.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ring.color }} />
                            <span className="text-xs font-semibold text-white">Grade {ring.label}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-sm font-bold" style={{ color: ring.color }}>{ring.count}</span>
                            <span className="text-[10px] ml-1" style={{ color: 'var(--text-dim)' }}>
                                {Math.round(ring.pct * 100)}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Chart: Horizontal Bar (Material Breakdown) ────────────────────────────────

function HorizontalBarChart({ data }: { data: { key: string; label: string; count: number; color: string }[] }) {
    const max = Math.max(...data.map(d => d.count), 1);
    if (data.length === 0) return (
        <p className="text-xs text-center py-4" style={{ color: 'var(--text-dim)' }}>No data yet</p>
    );
    return (
        <div className="flex flex-col gap-2.5">
            {data.map(d => {
                const pct = (d.count / max) * 100;
                return (
                    <div key={d.key}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-white truncate max-w-[55%]">{d.label}</span>
                            <span className="text-xs font-semibold ml-2 shrink-0" style={{ color: d.color }}>
                                {d.count} scan{d.count !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                            <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, background: d.color }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Chart: WRI Histogram ──────────────────────────────────────────────────────

function WRIHistogram({ scans }: { scans: ScanRecord[] }) {
    const BUCKETS = [
        { label: '0–0.2', min: 0,   max: 0.2, color: RED },
        { label: '0.2–0.4', min: 0.2, max: 0.4, color: AMBER },
        { label: '0.4–0.6', min: 0.4, max: 0.6, color: '#facc15' },
        { label: '0.6–0.8', min: 0.6, max: 0.8, color: TEAL },
        { label: '0.8–1.0', min: 0.8, max: 1.01, color: LIME },
    ];

    const counts = BUCKETS.map(b =>
        scans.filter(s => s.wriScore >= b.min && s.wriScore < b.max).length
    );
    const maxCount = Math.max(...counts, 1);

    if (scans.length === 0) return (
        <p className="text-xs text-center py-4" style={{ color: 'var(--text-dim)' }}>No data yet</p>
    );

    return (
        <div>
            <div className="flex items-end gap-2 h-20">
                {BUCKETS.map((b, i) => {
                    const barH = Math.max(4, (counts[i] / maxCount) * 72);
                    return (
                        <div key={b.label} className="flex-1 flex flex-col items-center gap-1"
                            title={`WRI ${b.label}: ${counts[i]} scan${counts[i] !== 1 ? 's' : ''}`}>
                            <span className="text-[9px] font-semibold leading-none"
                                style={{ color: counts[i] > 0 ? b.color : 'transparent' }}>
                                {counts[i] > 0 ? counts[i] : ''}
                            </span>
                            <div className="w-full rounded-t-sm transition-all duration-500"
                                style={{ height: `${barH}px`, background: b.color, opacity: counts[i] > 0 ? 1 : 0.25 }} />
                            <span className="text-[7px] leading-none text-center mt-0.5"
                                style={{ color: 'var(--text-muted)' }}>
                                {b.label}
                            </span>
                        </div>
                    );
                })}
            </div>
            <div className="flex justify-between mt-2">
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>← Low recyclability</span>
                <span className="text-[9px]" style={{ color: LIME }}>High →</span>
            </div>
        </div>
    );
}

// ── Chart: Cumulative Recovery Area Sparkline ─────────────────────────────────

function CumulativeRecoveryChart({ scans }: { scans: ScanRecord[] }) {
    const chartRef = useRef<HTMLDivElement | null>(null);
    const [chartWidth, setChartWidth] = useState(560);

    // Build 30-day running total
    const points = useMemo(() => {
        const days: { label: string; date: Date }[] = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            days.push({
                label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
                date: d,
            });
        }
        // daily totals
        const daily: Record<string, number> = {};
        scans.forEach(s => {
            const k = dateKey(s.createdAt);
            daily[k] = (daily[k] ?? 0) + getScanRecoveryValueINR(s);
        });
        // cumulative
        let running = 0;
        return days.map(d => {
            running += daily[d.label] ?? 0;
            return { label: d.label, value: running };
        });
    }, [scans]);

    useEffect(() => {
        const node = chartRef.current;
        if (!node) return;

        const updateWidth = () => {
            setChartWidth(Math.max(Math.round(node.getBoundingClientRect().width), 240));
        };

        updateWidth();

        const observer = new ResizeObserver(() => updateWidth());
        observer.observe(node);

        return () => observer.disconnect();
    }, []);

    const maxVal = Math.max(...points.map(p => p.value), 1);
    const W = chartWidth;
    const H = 64;
    const PAD_X = 2.5;
    const PAD_TOP = 3;
    const PAD_BOTTOM = 2;
    const chartHeight = H - PAD_TOP - PAD_BOTTOM;

    // Convert to SVG coords
    const pts = points.map((p, i) => ({
        x: PAD_X + (i / (points.length - 1)) * (W - PAD_X * 2),
        y: H - PAD_BOTTOM - (p.value / maxVal) * chartHeight,
        value: p.value,
    }));

    const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');
    const areaBaseY = H - PAD_BOTTOM;
    const areaPath = `${pts[0].x},${areaBaseY} ` + polyline + ` ${pts[pts.length - 1].x},${areaBaseY}`;
    const totalINR = points[points.length - 1].value;

    if (scans.length === 0) return (
        <p className="text-xs text-center py-4" style={{ color: 'var(--text-dim)' }}>No data yet</p>
    );

    return (
        <div ref={chartRef}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Last 30 days</span>
                <span className="text-sm font-bold" style={{ color: LIME }}>
                    ₹{Math.round(totalINR).toLocaleString('en-IN')}
                </span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16 rounded-lg overflow-hidden block">
                <defs>
                    <linearGradient id="recov-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={LIME} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={LIME} stopOpacity="0.02" />
                    </linearGradient>
                </defs>
                {/* area fill */}
                <polygon points={areaPath} fill="url(#recov-grad)" />
                {/* line */}
                <polyline points={polyline} fill="none" stroke={LIME} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                {/* endpoint dot */}
                <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.25" fill={LIME} />
            </svg>
            <div className="flex justify-between mt-1">
                <span className="text-[9px]" style={{ color: '#374151' }}>30d ago</span>
                <span className="text-[9px]" style={{ color: LIME }}>Today</span>
            </div>
        </div>
    );
}

// ── Chart: Hazard Flags Summary ────────────────────────────────────────────────

const HAZARD_META: {
    key: keyof ScanRecord['hazardFlags'];
    label: string;
    icon: React.ReactNode;
    color: string;
}[] = [
    { key: 'lead_solder_likelihood',    label: 'Lead Solder',      icon: <AlertTriangle size={13} />, color: RED },
    { key: 'asbestos_era_likelihood',   label: 'Asbestos Risk',    icon: <ShieldAlert size={13} />,   color: AMBER },
    { key: 'residual_fluid_risk',       label: 'Fluid Risk',       icon: <Droplets size={13} />,      color: BLUE },
    { key: 'pressurized_component',     label: 'Pressurised Part', icon: <Activity size={13} />,      color: PURPLE },
];

function HazardSummary({ scans }: { scans: ScanRecord[] }) {
    const counts = HAZARD_META.map(h => ({
        ...h,
        count: scans.filter(s => {
            const val = s.hazardFlags?.[h.key];
            return val === true || (typeof val === 'string' && val !== 'none' && val !== 'low' && val !== '');
        }).length,
    })).filter(h => h.count > 0);

    if (counts.length === 0) return (
        <div className="flex items-center gap-2 py-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${TEAL}18` }}>
                <Recycle size={12} style={{ color: TEAL }} />
            </div>
            <p className="text-xs" style={{ color: TEAL }}>No hazard flags detected across all scans</p>
        </div>
    );

    return (
        <div className="grid grid-cols-2 gap-2">
            {counts.map(h => (
                <div key={h.key as string}
                    className="flex items-center gap-2 rounded-xl px-3 py-2"
                    style={{ background: `${h.color}12`, border: `1px solid ${h.color}25` }}>
                    <span style={{ color: h.color }}>{h.icon}</span>
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold" style={{ color: h.color }}>{h.label}</p>
                        <p className="text-[9px]" style={{ color: 'var(--text-dim)' }}>{h.count} scan{h.count !== 1 ? 's' : ''}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function ChartCard({ title, sub, icon, children }: {
    title: string; sub?: string; icon: React.ReactNode; children: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-start justify-between mb-4">
                <div>
                    <p className="text-sm font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>{title}</p>
                    {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{sub}</p>}
                </div>
                <span style={{ color: LIME }}>{icon}</span>
            </div>
            {children}
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OrgDashboardPage() {
    const router = useRouter();
    const { user, profile, loading, signOut } = useAuth();

    const [scans, setScans] = useState<ScanRecord[]>(() => {
        if (!profile?.orgId) return [];
        return orgDashboardCache?.orgId === profile.orgId ? orgDashboardCache.scans : [];
    });
    const [fetching, setFetching] = useState(() => {
        if (!profile?.orgId) return true;
        return orgDashboardCache?.orgId !== profile.orgId;
    });

    useEffect(() => {
        if (loading) return;
        if (!user || user.isAnonymous) { router.replace('/dashboard'); return; }
        if (!profile?.orgId) { router.replace('/org/setup'); return; }

        async function load() {
            if (!profile?.orgId) return;
            try {
                const q = query(
                    collection(db, 'scans'),
                    where('orgId', '==', profile.orgId),
                    orderBy('createdAt', 'desc'),
                );
                const snap = await getDocs(q);
                const nextScans = snap.docs.map(d => ({ id: d.id, ...d.data() } as ScanRecord));
                setScans(nextScans);
                orgDashboardCache = { orgId: profile.orgId, scans: nextScans };
            } catch (e) {
                console.error('[OrgDashboard] fetch failed:', e);
            } finally {
                setFetching(false);
            }
        }
        load();
    }, [user, profile, loading, router]);

    // ── Derived stats ─────────────────────────────────────────────────────────

    const monthStart = useMemo(() => {
        const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
    }, []);

    const thisMonthScans = useMemo(
        () => scans.filter(s => s.createdAt.toDate() >= monthStart),
        [scans, monthStart]
    );

    const totalRecoveryINR = useMemo(
        () => Math.round(scans.reduce((s, sc) => s + getScanRecoveryValueINR(sc), 0)),
        [scans]
    );

    const co2 = useMemo(() => co2Saved(scans), [scans]);

    // Worker breakdown
    const workers = useMemo(() => {
        const map: Record<string, { name: string; count: number }> = {};
        scans.forEach(s => {
            if (!s.workerId) return;
            if (!map[s.workerId]) map[s.workerId] = { name: s.workerName ?? 'Unknown', count: 0 };
            map[s.workerId].count++;
        });
        return Object.entries(map).sort((a, b) => b[1].count - a[1].count).slice(0, 8);
    }, [scans]);

    // 14-day scan activity trend
    const trend = useMemo(() => {
        const days: { label: string; count: number }[] = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            days.push({ label: key, count: 0 });
        }
        scans.forEach(s => {
            const k = dateKey(s.createdAt);
            const slot = days.find(d => d.label === k);
            if (slot) slot.count++;
        });
        return days;
    }, [scans]);

    // Grade distribution A/B/C
    const gradeCounts = useMemo(() => ({
        a: scans.filter(s => s.grade === 'A').length,
        b: scans.filter(s => s.grade === 'B').length,
        c: scans.filter(s => s.grade === 'C').length,
    }), [scans]);

    // Material breakdown (top 6)
    const materialData = useMemo(() => {
        const counts: Record<string, number> = {};
        scans.forEach(s => {
            if (!s.material) return;
            counts[s.material] = (counts[s.material] ?? 0) + 1;
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([key, count]) => ({
                key,
                label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                count,
                color: materialColor(key),
            }));
    }, [scans]);

    // My efficiency stats
    const myStats = useMemo(() => {
        if (!user || scans.length === 0) return null;
        const lb = computeLeaderboard(scans);
        return lb.find(w => w.workerId === user.uid) ?? null;
    }, [scans, user]);

    const myBadges = useMemo(() => {
        if (!myStats) return null;
        const badges = computeBadges(myStats);
        return { earned: badges.filter(b => b.earned), next: badges.find(b => !b.earned) };
    }, [myStats]);

    const [activeTab, setActiveTab] = useState<OrgTab>('analytics');

    if (loading || (fetching && scans.length === 0)) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--border)', borderTopColor: LIME }} />
        </div>
    );

    return (
        <div className="flex flex-col min-h-screen pb-28 lg:pb-0" style={{ background: 'var(--bg-primary)' }}>

            {/* Header */}
            <div className="safe-top px-5 pt-6 pb-4 lg:px-10 lg:pt-10 lg:pb-6">
                <div className="flex items-center gap-3 mb-4">
                    <button
                        onClick={() => router.replace('/dashboard')}
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                    >
                        <ChevronLeft size={16} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                </div>
                <div className="flex items-center gap-2 mb-1">
                    <BarChart2 size={16} style={{ color: LIME }} />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Org Analytics</span>
                </div>
                <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>Dashboard</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
                    {scans.length} total org scan{scans.length !== 1 ? 's' : ''} · last synced now
                </p>

                <OrgSubNav activeTab={activeTab} onTabChange={setActiveTab} />
            </div>

            <div className="px-5 lg:px-10 flex flex-col gap-5 max-w-3xl">

                {/* Leaderboard tab */}
                {activeTab === 'leaderboard' && <LeaderboardPanel scans={scans} />}

                {/* Impact tab */}
                {activeTab === 'impact' && <ImpactPanel />}

                {/* Settings tab */}
                {activeTab === 'settings' && (
                    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                        <div className="px-4 py-3 flex items-center gap-2"
                            style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                            <Settings size={13} style={{ color: LIME }} />
                            <p className="text-xs font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>Settings & Tools</p>
                        </div>
                        <div className="flex flex-col" style={{ background: 'var(--bg-card)' }}>

                            {/* Org Settings */}
                            <button onClick={() => router.push('/org/profile')}
                                className="flex items-center gap-3 px-4 py-3.5 transition-all hover:opacity-80 active:scale-[0.99]"
                                style={{ borderBottom: '1px solid var(--border)' }}>
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: 'rgba(132,204,22,0.12)' }}>
                                    <Settings size={14} style={{ color: LIME }} />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="text-sm font-semibold text-white">Org Settings</p>
                                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>Edit org name, members &amp; roles</p>
                                </div>
                                <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />
                            </button>

                            {/* App Settings */}
                            <button onClick={() => router.push('/settings')}
                                className="flex items-center gap-3 px-4 py-3.5 transition-all hover:opacity-80 active:scale-[0.99]"
                                style={{ borderBottom: '1px solid var(--border)' }}>
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: 'rgba(167,139,250,0.12)' }}>
                                    <SlidersHorizontal size={14} style={{ color: '#a78bfa' }} />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="text-sm font-semibold text-white">App Settings</p>
                                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>Theme, language &amp; notifications</p>
                                </div>
                                <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />
                            </button>

                            {/* Add Device */}
                            <button onClick={() => router.push('/org/devices')}
                                className="flex items-center gap-3 px-4 py-3.5 transition-all hover:opacity-80 active:scale-[0.99]"
                                style={{ borderBottom: '1px solid var(--border)' }}>
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: 'rgba(56,189,248,0.12)' }}>
                                    <Cpu size={14} style={{ color: '#38bdf8' }} />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="text-sm font-semibold text-white">Add Device</p>
                                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>Provision a new ESP32 bin sensor</p>
                                </div>
                                <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />
                            </button>

                            {/* Sign Out */}
                            <button onClick={async () => { await signOut(); router.replace('/auth'); }}
                                className="flex items-center gap-3 px-4 py-3.5 transition-all hover:opacity-80 active:scale-[0.99]">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: 'rgba(239,68,68,0.12)' }}>
                                    <LogOut size={14} style={{ color: '#ef4444' }} />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>Sign Out</p>
                                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{profile?.email ?? user?.email ?? ''}</p>
                                </div>
                            </button>

                        </div>
                    </div>
                )}

                {/* Analytics tab content below */}
                {activeTab === 'analytics' && (<>

                {/* Empty state */}
                {scans.length === 0 && (
                    <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <ScanLine size={32} style={{ color: '#374151' }} />
                        <p className="text-sm font-semibold text-white">No org scans yet</p>
                        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                            Scans made by org members will appear here. Make sure workers are scanning while signed in.
                        </p>
                        <button onClick={() => router.push('/scan')}
                            className="mt-2 px-4 py-2 rounded-xl text-sm font-bold"
                            style={{ background: LIME, color: 'var(--bg-primary)' }}>
                            Start a Scan
                        </button>
                    </div>
                )}

                {scans.length > 0 && (
                    <>
                        {/* ── My Badges + Drop-off quick-access row ── */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* My Badges card */}
                            <button onClick={() => router.push('/badges')}
                                className="rounded-2xl p-4 flex flex-col gap-2 text-left relative overflow-hidden transition-all hover:opacity-90 active:scale-[0.98]"
                                style={{ background: 'var(--bg-card)', border: `1px solid ${LIME}30` }}>
                                <div className="absolute inset-0 pointer-events-none"
                                    style={{ background: `radial-gradient(ellipse at 50% 0%, ${LIME}10 0%, transparent 70%)` }} />
                                <div className="flex items-center justify-between">
                                    <span className="text-lg">🏅</span>
                                    <ChevronRight size={13} style={{ color: 'var(--text-dim)' }} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-white">My Badges</p>
                                    {myBadges ? (
                                        <p className="text-[10px] mt-0.5" style={{ color: LIME }}>
                                            {myBadges.earned.length} / {TOTAL_BADGES} earned
                                        </p>
                                    ) : (
                                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>Scan to earn badges</p>
                                    )}
                                    {myBadges?.next && (
                                        <p className="text-[9px] mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
                                            Next: {myBadges.next.emoji} {myBadges.next.name}
                                        </p>
                                    )}
                                </div>
                            </button>

                            {/* Drop-off map card */}
                            <button onClick={() => router.push('/drop-off')}
                                className="rounded-2xl p-4 flex flex-col gap-2 text-left relative overflow-hidden transition-all hover:opacity-90 active:scale-[0.98]"
                                style={{ background: 'var(--bg-card)', border: '1px solid rgba(96,165,250,0.25)' }}>
                                <div className="absolute inset-0 pointer-events-none"
                                    style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(96,165,250,0.08) 0%, transparent 70%)' }} />
                                <div className="flex items-center justify-between">
                                    <MapPin size={16} style={{ color: '#60a5fa' }} />
                                    <ChevronRight size={13} style={{ color: 'var(--text-dim)' }} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-white">Drop-off Map</p>
                                    <p className="text-[10px] mt-0.5" style={{ color: '#60a5fa' }}>Find nearby recycling</p>
                                    <p className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>E-waste centres near you</p>
                                </div>
                            </button>
                        </div>

                        {/* ── My Efficiency Tier card ── */}
                        {myStats && (() => {
                            const tier = TIER_CONFIG[myStats.efficiencyTier];
                            return (
                                <div
                                    className="rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden"
                                    style={{ background: 'var(--bg-card)', border: `1px solid ${tier.color}30` }}
                                >
                                    <div className="absolute inset-0 pointer-events-none"
                                        style={{ background: `radial-gradient(ellipse at 0% 50%, ${tier.color}10 0%, transparent 70%)` }} />
                                    {/* Gauge */}
                                    <div className="relative shrink-0">
                                        <svg width="64" height="64" viewBox="0 0 64 64">
                                            <circle cx="32" cy="32" r="26" fill="none" stroke="var(--border)" strokeWidth="7" />
                                            <circle cx="32" cy="32" r="26" fill="none"
                                                stroke={tier.color} strokeWidth="7"
                                                strokeDasharray={`${(myStats.segregationScore / 100) * 163.4} 163.4`}
                                                strokeLinecap="round"
                                                style={{ transform: 'rotate(-90deg)', transformOrigin: '32px 32px', transition: 'stroke-dasharray 0.6s ease' }}
                                            />
                                            <text x="32" y="36" textAnchor="middle" fill="white"
                                                style={{ fontFamily: 'Space Grotesk', fontSize: '13px', fontWeight: 700 }}>
                                                {myStats.segregationScore}%
                                            </text>
                                        </svg>
                                    </div>
                                    {/* Info */}
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>My Segregation</p>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-base">{myStats.efficiencyBadge}</span>
                                            <span className="text-sm font-bold" style={{ color: tier.color }}>{tier.label}</span>
                                        </div>
                                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                            #{myStats?.rank ?? '—'} on leaderboard · {myStats.points} pts
                                        </p>
                                    </div>
                                    {/* Points pill */}
                                    <div className="ml-auto shrink-0 text-right">
                                        <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>rank</p>
                                        <p className="text-2xl font-bold" style={{ color: tier.color, fontFamily: 'Space Grotesk' }}>#{myStats.rank}</p>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ── KPI grid ── */}
                        <div className="grid grid-cols-2 gap-3">
                            <StatCard
                                icon={<ScanLine size={14} />}
                                label="Scans This Month"
                                value={String(thisMonthScans.length)}
                                sub={`${scans.length} all time`}
                            />
                            <StatCard
                                icon={<DollarSign size={14} />}
                                label="Recovery Value"
                                value={`₹${totalRecoveryINR.toLocaleString('en-IN')}`}
                                sub="est. scrap market"
                                color={BLUE}
                            />
                            <StatCard
                                icon={<Leaf size={14} />}
                                label="CO₂ Saved"
                                value={`${co2} kg`}
                                sub="vs. landfill baseline"
                                color={TEAL}
                            />
                            <StatCard
                                icon={<Users size={14} />}
                                label="Active Workers"
                                value={String(workers.length)}
                                sub="with tagged scans"
                                color={AMBER}
                            />
                        </div>

                        {/* ── Scan Activity (upgraded) ── */}
                        <ChartCard
                            title="Scan Activity"
                            sub="Last 14 days — today highlighted"
                            icon={<TrendingUp size={16} />}>
                            <ScanActivityChart data={trend} />
                        </ChartCard>

                        {/* ── Grade Distribution donut ── */}
                        <ChartCard
                            title="Grade Distribution"
                            sub="Recyclability grades across all scans"
                            icon={<Award size={16} />}>
                            <DonutChart a={gradeCounts.a} b={gradeCounts.b} c={gradeCounts.c} />
                            <div className="mt-3 flex gap-2 text-[10px]" style={{ color: 'var(--text-dim)' }}>
                                <span className="font-semibold" style={{ color: LIME }}>A ≥ 0.85 WRI</span>
                                <span>·</span>
                                <span className="font-semibold" style={{ color: AMBER }}>B 0.65–0.84</span>
                                <span>·</span>
                                <span className="font-semibold" style={{ color: RED }}>C &lt; 0.65</span>
                            </div>
                        </ChartCard>

                        {/* ── Cumulative Recovery ── */}
                        <ChartCard
                            title="Cumulative Recovery ₹"
                            sub="Running total estimated scrap value (INR)"
                            icon={<DollarSign size={16} />}>
                            <CumulativeRecoveryChart scans={scans} />
                        </ChartCard>

                        {/* ── WRI Distribution histogram ── */}
                        <ChartCard
                            title="WRI Distribution"
                            sub="Weighted Recyclability Index — score buckets"
                            icon={<BarChart2 size={16} />}>
                            <WRIHistogram scans={scans} />
                        </ChartCard>

                        {/* ── Material Breakdown ── */}
                        <ChartCard
                            title="Material Breakdown"
                            sub="Top materials across all scans"
                            icon={<Recycle size={16} />}>
                            <HorizontalBarChart data={materialData} />
                        </ChartCard>

                        {/* ── Hazard Flags ── */}
                        <ChartCard
                            title="Hazard Flags"
                            sub="Triggered safety flags across the org"
                            icon={<AlertTriangle size={16} />}>
                            <HazardSummary scans={scans} />
                        </ChartCard>

                        {/* ── Worker Breakdown ── */}
                        {workers.length > 0 && (
                            <ChartCard
                                title="Worker Breakdown"
                                sub="Scan count per team member"
                                icon={<Users size={16} />}>
                                <div className="flex flex-col gap-2">
                                    {workers.map(([uid, { name, count }], i) => {
                                        const pct = Math.round((count / scans.length) * 100);
                                        return (
                                            <div key={uid} className="flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                                    style={{ background: 'rgba(132,204,22,0.1)', color: LIME, border: '1px solid rgba(132,204,22,0.2)' }}>
                                                    {name[0]?.toUpperCase() ?? '?'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs font-semibold text-white truncate">{name}</span>
                                                        <span className="text-xs ml-2 shrink-0" style={{ color: 'var(--text-dim)' }}>{count} scan{count !== 1 ? 's' : ''}</span>
                                                    </div>
                                                    <div className="h-1 rounded-full" style={{ background: 'var(--border)' }}>
                                                        <div className="h-full rounded-full transition-all duration-500"
                                                            style={{ width: `${pct}%`, background: LIME }} />
                                                    </div>
                                                </div>
                                                {i === 0 && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                                                        style={{ background: 'rgba(132,204,22,0.15)', color: LIME }}>
                                                        TOP
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </ChartCard>
                        )}
                    </>
                )}
                </>)}



            </div>

            <BottomNav />
        </div>
    );
}
