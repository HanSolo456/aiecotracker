'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
    Leaf, ArrowRight, TrendingUp, Shield, Recycle,
    Factory, Globe2, Zap, Award, BarChart2, ChevronRight,
    ExternalLink, RefreshCw,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PlatformStats {
    totals: {
        scans: number;
        massKg: number;
        co2Kg: number;
        valueINR: number;
        gradeAPct: number;
        hazardFlags: number;
        activeOrgs: number;
    };
    trend: { date: string; scans: number; co2Kg: number }[];
    topMaterials: { name: string; count: number }[];
    generatedAt: string;
}

// ── Animated counter ──────────────────────────────────────────────────────────
function useCounter(target: number, duration = 1800, decimals = 0) {
    const [val, setVal] = useState(0);
    const ref = useRef<HTMLDivElement>(null);
    const ran = useRef(false);

    useEffect(() => {
        if (target === 0) return;
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting || ran.current) return;
            ran.current = true;
            obs.disconnect();
            const start = performance.now();
            const step = (now: number) => {
                const p = Math.min((now - start) / duration, 1);
                const ease = 1 - Math.pow(1 - p, 3);
                const v = ease * target;
                setVal(decimals > 0 ? parseFloat(v.toFixed(decimals)) : Math.round(v));
                if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }, { threshold: 0.3 });
        obs.observe(el);
        return () => obs.disconnect();
    }, [target, duration, decimals]);

    return { val, ref };
}

// ── Format helpers ─────────────────────────────────────────────────────────────
function fmtINR(n: number): string {
    if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
    if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
    if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
    return `₹${n}`;
}

function fmtNum(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color = '#84cc16' }: { data: number[]; color?: string }) {
    if (!data.length) return null;
    const max = Math.max(...data, 1);
    const W = 200, H = 40;
    const pts = data.map((v, i) => {
        const x = (i / (data.length - 1)) * W;
        const y = H - (v / max) * H;
        return `${x},${y}`;
    }).join(' ');
    return (
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={`0,${H} ${pts} ${W},${H}`} fill={color} fillOpacity="0.08" stroke="none" />
        </svg>
    );
}

// ── Big stat card ─────────────────────────────────────────────────────────────
function BigStat({
    icon: Icon, label, value, sub, accent, prefix = '', suffix = '', delay = 0,
}: {
    icon: React.ElementType; label: string; value: number; sub: string;
    accent: string; prefix?: string; suffix?: string; delay?: number;
}) {
    const { val, ref } = useCounter(value, 2000);
    return (
        <div ref={ref} className="relative rounded-2xl p-6 flex flex-col gap-4 overflow-hidden transition-all hover:scale-[1.02]"
            style={{ background: 'var(--bg-card)', border: `1px solid var(--border)`, transitionDelay: `${delay}ms` }}>
            {/* top accent line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${accent}18`, border: `1px solid ${accent}35` }}>
                <Icon size={20} style={{ color: accent }} />
            </div>
            <div>
                <p className="text-3xl sm:text-4xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>
                    {prefix}{val.toLocaleString('en-IN')}{suffix}
                </p>
                <p className="text-sm font-semibold mt-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>
            </div>
        </div>
    );
}

// ── Material pill ─────────────────────────────────────────────────────────────
const MAT_COLORS: Record<string, string> = {
    metal: '#60a5fa', aluminum: '#34d399', pcb: '#f59e0b',
    plastic: '#a78bfa', battery: '#f87171', ewaste: '#fb923c',
    glass: '#38bdf8', paper: '#84cc16', default: '#94a3b8',
};

function MaterialBar({ name, count, max }: { name: string; count: number; max: number }) {
    const color = MAT_COLORS[name] || MAT_COLORS.default;
    const pct = max > 0 ? (count / max) * 100 : 0;
    const label = name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return (
        <div className="flex items-center gap-3">
            <div className="w-24 shrink-0 text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{label}</div>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: color }} />
            </div>
            <div className="w-10 text-right text-xs font-bold" style={{ color }}>{count}</div>
        </div>
    );
}

// ── Mini trend chart ──────────────────────────────────────────────────────────
function TrendBars({ data }: { data: { date: string; scans: number }[] }) {
    const max = Math.max(...data.map(d => d.scans), 1);
    const recent = data.slice(-20);
    return (
        <div className="flex items-end gap-1 h-16">
            {recent.map((d, i) => {
                const h = Math.max((d.scans / max) * 64, 4);
                return (
                    <div key={i} className="flex-1 rounded-t transition-all duration-700 group relative"
                        style={{ height: h, background: `rgba(132,204,22,${0.3 + (d.scans / max) * 0.7})` }}>
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                            {d.date.slice(5)}: {d.scans}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ImpactPage() {
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<string>('');

    const fetchStats = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/platform-stats');
            if (res.ok) {
                const data: PlatformStats = await res.json();
                setStats(data);
                setLastRefresh(new Date().toLocaleTimeString('en-IN'));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    const t = stats?.totals;

    return (
        <main className="min-h-screen relative" style={{ background: 'var(--bg-primary)' }}>

            {/* ── ambient glows ── */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -left-48 top-0 w-[600px] h-[600px] rounded-full blur-[140px]"
                    style={{ background: 'radial-gradient(circle, rgba(132,204,22,0.1) 0%, transparent 70%)' }} />
                <div className="absolute right-0 top-48 w-[500px] h-[500px] rounded-full blur-[120px]"
                    style={{ background: 'radial-gradient(circle, rgba(96,165,250,0.08) 0%, transparent 70%)' }} />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full blur-[120px]"
                    style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.06) 0%, transparent 70%)' }} />
                <div className="absolute inset-0 bg-grid opacity-40" />
            </div>

            {/* ══════════════ NAV ══════════════ */}
            <nav className="sticky top-0 z-40 border-b backdrop-blur-xl" style={{ background: 'rgba(10,14,26,0.9)', borderColor: 'var(--border)' }}>
                <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2.5 group">
                        <div className="w-9 h-9 rounded-[12px] flex items-center justify-center"
                            style={{ background: 'rgba(132,204,22,0.12)', border: '1px solid rgba(132,204,22,0.25)' }}>
                            <Leaf size={16} style={{ color: 'var(--lime)' }} />
                        </div>
                        <div>
                            <p className="font-bold text-white text-sm" style={{ fontFamily: 'Space Grotesk' }}>AI-EcoTrack</p>
                            <p className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Platform Impact</p>
                        </div>
                    </Link>
                    <div className="flex items-center gap-3">
                        {lastRefresh && (
                            <span className="hidden sm:block text-xs" style={{ color: 'var(--text-muted)' }}>
                                Updated {lastRefresh}
                            </span>
                        )}
                        <button
                            onClick={fetchStats}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                        >
                            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                        <Link href="/auth" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90"
                            style={{ background: 'var(--lime)', color: '#0f172a' }}>
                            Join Platform
                            <ArrowRight size={12} />
                        </Link>
                    </div>
                </div>
            </nav>

            <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 py-12 space-y-12">

                {/* ══════════════ HERO HEADER ══════════════ */}
                <div className="text-center space-y-4 pt-7">
                    <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight" style={{ fontFamily: 'Space Grotesk' }}>
                        Circular Economy{' '}
                        <span style={{ background: 'linear-gradient(90deg,#84cc16,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Impact Dashboard
                        </span>
                    </h1>
                    <p className="text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
                        Real-time aggregate impact across all organisations using AI-EcoTrack —
                        waste identified, CO₂ diverted, and recovery value unlocked across India's industrial ecosystem.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 pt-2">
                        {['India E-Waste Rules 2022', 'EU ESPR 2024', 'EPR Compliant', 'OSHA Referenced'].map(tag => (
                            <span key={tag} className="px-3 py-1 rounded-full text-[11px] font-semibold"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>

                {/* ══════════════ BIG 4 STATS ══════════════ */}
                {loading ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="rounded-2xl h-40 shimmer" />
                        ))}
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <BigStat icon={BarChart2} label="Items Classified" value={t?.scans ?? 0}
                            sub="Total industrial parts AI-identified" accent="#84cc16" delay={0} />
                        <BigStat icon={Globe2} label="CO₂ Diverted" value={t?.co2Kg ?? 0} suffix=" kg"
                            sub="vs. landfill or incineration baseline" accent="#34d399" delay={80} />
                        <BigStat icon={TrendingUp} label="Recovery Value" value={t?.valueINR ?? 0} prefix="₹"
                            sub="Material value unlocked from sorted scrap" accent="#60a5fa" delay={160} />
                        <BigStat icon={Factory} label="Active Organisations" value={t?.activeOrgs ?? 0}
                            sub="Facilities and recyclers on the platform" accent="#a78bfa" delay={240} />
                    </div>
                )}

                {/* ══════════════ SECONDARY METRICS ══════════════ */}
                {!loading && t && (
                    <div className="grid sm:grid-cols-3 gap-4">
                        {[
                            { icon: Recycle, label: 'Mass Processed', value: `${t.massKg.toLocaleString('en-IN')} kg`, sub: 'Total estimated material weight scanned', accent: '#84cc16' },
                            { icon: Shield, label: 'Safety Flags Raised', value: t.hazardFlags.toLocaleString('en-IN'), sub: 'Hazardous items escalated before disassembly', accent: '#f59e0b' },
                            { icon: Award, label: 'Grade A Accuracy', value: `${t.gradeAPct}%`, sub: 'Scans achieving top recyclability classification', accent: '#34d399' },
                        ].map(({ icon: Icon, label, value, sub, accent }) => (
                            <div key={label} className="rounded-2xl p-5 flex gap-4 items-start"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
                                    <Icon size={18} style={{ color: accent }} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>{value}</p>
                                    <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ══════════════ TREND + MATERIALS ══════════════ */}
                {!loading && stats && (
                    <div className="grid lg:grid-cols-2 gap-6">

                        {/* Scan trend */}
                        <div className="rounded-2xl p-6 space-y-4"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--lime)' }}>Scan Activity</p>
                                    <h3 className="text-lg font-bold text-white mt-1" style={{ fontFamily: 'Space Grotesk' }}>Daily scans — last 20 days</h3>
                                </div>
                                <Zap size={18} style={{ color: 'var(--lime)' }} />
                            </div>
                            {stats.trend.length > 0 ? (
                                <TrendBars data={stats.trend} />
                            ) : (
                                <div className="h-16 flex items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
                                    No scan data yet
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <Sparkline data={stats.trend.map(d => d.co2Kg)} color="#34d399" />
                            </div>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Green area = CO₂ diverted (kg) daily trend
                            </p>
                        </div>

                        {/* Material breakdown */}
                        <div className="rounded-2xl p-6 space-y-4"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#60a5fa' }}>Material Streams</p>
                                    <h3 className="text-lg font-bold text-white mt-1" style={{ fontFamily: 'Space Grotesk' }}>Top classified materials</h3>
                                </div>
                                <Recycle size={18} style={{ color: '#60a5fa' }} />
                            </div>
                            <div className="space-y-3">
                                {stats.topMaterials.length > 0 ? (
                                    stats.topMaterials.map(m => (
                                        <MaterialBar key={m.name} name={m.name} count={m.count}
                                            max={stats.topMaterials[0]?.count ?? 1} />
                                    ))
                                ) : (
                                    <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                                        No material data yet
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ══════════════ WHY IT MATTERS ══════════════ */}
                <div className="rounded-3xl overflow-hidden"
                    style={{ background: 'var(--bg-card)', border: '1px solid rgba(132,204,22,0.15)' }}>
                    <div className="relative px-8 py-10"
                        style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(132,204,22,0.06) 0%, transparent 70%)' }}>
                        <div className="max-w-3xl">
                            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--lime)' }}>
                                Regulatory Context
                            </p>
                            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Space Grotesk' }}>
                                Why this data matters for India
                            </h2>
                            <p className="text-base leading-7 mb-6" style={{ color: 'var(--text-secondary)' }}>
                                India generates <strong className="text-white">3.2 million tonnes of e-waste annually</strong> — ranked 3rd globally — with only 22% formally recycled.
                                AI-EcoTrack creates a permanent, AI-verified Digital Product Passport for every industrial item,
                                enabling EPR compliance tracking, worker safety enforcement, and circular economy reporting
                                aligned with <strong className="text-white">India E-Waste Management Rules 2022</strong> and <strong className="text-white">EU ESPR 2024</strong>.
                            </p>
                            <div className="grid sm:grid-cols-3 gap-4">
                                {[
                                    { label: 'Worker Safety', body: 'Mandatory OSHA 1910.147 + RoHS protocols injected before any disassembly — zero ambiguity for field workers.' },
                                    { label: 'EPR Compliance', body: 'Every scan generates a tamper-proof DPP enabling producers to fulfil Extended Producer Responsibility obligations.' },
                                    { label: 'Revenue Recovery', body: 'Accurate material grading prevents cross-contamination — recovering up to 83% more scrap value vs. manual sorting.' },
                                ].map(({ label, body }) => (
                                    <div key={label} className="rounded-xl p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                                        <p className="font-semibold text-white text-sm mb-2" style={{ fontFamily: 'Space Grotesk' }}>{label}</p>
                                        <p className="text-xs leading-5" style={{ color: 'var(--text-dim)' }}>{body}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ══════════════ CO₂ METHODOLOGY ══════════════ */}
                <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                        Measurement Methodology
                    </p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { mat: 'Aluminium', factor: '9.16 kg CO₂/kg', color: '#34d399' },
                            { mat: 'E-waste / PCB', factor: '3.10–4.20 kg CO₂/kg', color: '#f59e0b' },
                            { mat: 'Plastic', factor: '2.53 kg CO₂/kg', color: '#a78bfa' },
                            { mat: 'Metal / Steel', factor: '1.46 kg CO₂/kg', color: '#60a5fa' },
                        ].map(({ mat, factor, color }) => (
                            <div key={mat} className="rounded-xl p-4 text-center"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                                <p className="text-sm font-bold" style={{ color, fontFamily: 'Space Grotesk' }}>{factor}</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>{mat}</p>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
                        Source: EPA / IPCC Guidelines for GHG inventories. CO₂ factors represent emissions avoided vs. virgin material production.
                    </p>
                </div>

                {/* ══════════════ CTA ══════════════ */}
                <div className="rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden"
                    style={{ background: 'var(--bg-card)', border: '1px solid rgba(132,204,22,0.2)' }}>
                    <div className="absolute inset-0 pointer-events-none"
                        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(132,204,22,0.08) 0%, transparent 60%)' }} />
                    <div className="relative">
                        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--lime)' }}>
                            Start contributing
                        </p>
                        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4" style={{ fontFamily: 'Space Grotesk' }}>
                            Add your organisation to the map
                        </h2>
                        <p className="text-base max-w-xl mx-auto mb-8" style={{ color: 'var(--text-secondary)' }}>
                            Join facilities and recyclers already using AI-EcoTrack.
                            Pilot access is currently free — no billing, no lock-in.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Link href="/auth"
                                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-bold text-sm transition-all hover:scale-105"
                                style={{ background: 'linear-gradient(135deg,#84cc16,#65a30d)', color: '#0f172a', boxShadow: '0 0 32px rgba(132,204,22,0.3)' }}>
                                Join for Free
                                <ArrowRight size={16} />
                            </Link>
                            <Link href="/"
                                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-semibold text-sm transition-all hover:opacity-90"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                <ExternalLink size={14} />
                                Back to Home
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Footer note */}
                <p className="text-center text-xs pb-6" style={{ color: 'var(--text-muted)' }}>
                    All data is platform-wide aggregate only — no individual organisation data is disclosed. · AI-EcoTrack by Team MakersLab · IndiaInnovates 2026
                </p>
            </div>
        </main>
    );
}
