'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
    Leaf, ArrowRight, TrendingUp, Shield, Recycle,
    Factory, Globe2, Zap, Award, BarChart2, ChevronRight,
    ExternalLink, RefreshCw, Wind, Trees, Car, Flame, Calculator,
    SlidersHorizontal, Share2, Sparkles,
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

// ── Emission factors (kg CO₂ avoided per kg of material, vs virgin production)
const EMISSION_FACTORS: Record<string, number> = {
    aluminium:  9.16,
    ewaste_pcb: 3.65,
    plastic:    2.53,
    steel:      1.46,
    copper:     3.40,
    paper:      1.10,
};

// Average mass per item per category (kg)
const AVG_MASS_KG: Record<string, number> = {
    aluminium:  4.2,
    ewaste_pcb: 0.9,
    plastic:    1.8,
    steel:      8.5,
    copper:     2.1,
    paper:      0.5,
};

// Indian scrap recovery price INR/kg
const SCRAP_PRICE_INR: Record<string, number> = {
    aluminium:  140,
    ewaste_pcb: 320,
    plastic:    28,
    steel:      42,
    copper:     520,
    paper:      14,
};

// Equivalencies
const KG_CO2_PER_TREE_YEAR      = 21.77;   // avg tree absorbs ~21.77 kg CO₂/year
const KG_CO2_PER_KM_CAR         = 0.192;   // avg petrol car CO₂/km (India)
const KWH_PER_KG_CO2_COAL       = 1 / 0.82;// coal power plant: 0.82 kg CO₂/kWh

interface MaterialMix {
    aluminium: number;
    ewaste_pcb: number;
    plastic: number;
    steel: number;
    copper: number;
    paper: number;
}

const DEFAULT_MIX: MaterialMix = {
    aluminium:  20,
    ewaste_pcb: 25,
    plastic:    15,
    steel:      25,
    copper:     10,
    paper:       5,
};

const MATERIAL_META: { key: keyof MaterialMix; label: string; color: string; emoji: string }[] = [
    { key: 'aluminium',   label: 'Aluminium',    color: '#34d399', emoji: '🔩' },
    { key: 'ewaste_pcb',  label: 'E-waste / PCB',color: '#f59e0b', emoji: '🖥️' },
    { key: 'plastic',     label: 'Plastic',       color: '#a78bfa', emoji: '🧴' },
    { key: 'steel',       label: 'Steel / Metal', color: '#60a5fa', emoji: '⚙️' },
    { key: 'copper',      label: 'Copper',        color: '#fb923c', emoji: '🔌' },
    { key: 'paper',       label: 'Paper / Card',  color: '#84cc16', emoji: '📦' },
];

function computeImpact(items: number, mix: MaterialMix) {
    const total = Object.values(mix).reduce((a, b) => a + b, 0) || 1;
    let co2Kg = 0, massKg = 0, valueINR = 0;
    for (const [mat, pct] of Object.entries(mix) as [keyof MaterialMix, number][]) {
        const frac = pct / total;
        const itemsOfMat = items * frac;
        const matMass = itemsOfMat * AVG_MASS_KG[mat];
        co2Kg   += matMass * EMISSION_FACTORS[mat];
        massKg  += matMass;
        valueINR += matMass * SCRAP_PRICE_INR[mat];
    }
    const treesYear    = co2Kg / KG_CO2_PER_TREE_YEAR;
    const kmAvoided    = co2Kg / KG_CO2_PER_KM_CAR;
    const kwhSaved     = co2Kg * KWH_PER_KG_CO2_COAL;
    const landfillCo2  = massKg * 0.95; // rough landfill emission factor
    const reductionPct = Math.min(100, co2Kg > 0 ? ((co2Kg) / (co2Kg + landfillCo2)) * 100 : 0);
    return { co2Kg, massKg, valueINR, treesYear, kmAvoided, kwhSaved, reductionPct };
}

function AnimNum({ target, decimals = 0, prefix = '', suffix = '' }: { target: number; decimals?: number; prefix?: string; suffix?: string }) {
    const [val, setVal] = useState(0);
    const prev = useRef(0);
    useEffect(() => {
        const from = prev.current;
        const diff = target - from;
        if (Math.abs(diff) < 0.0001) return;
        prev.current = target;
        const dur = 600;
        const start = performance.now();
        const step = (now: number) => {
            const p = Math.min((now - start) / dur, 1);
            const ease = 1 - Math.pow(1 - p, 3);
            const v = from + ease * diff;
            setVal(decimals > 0 ? parseFloat(v.toFixed(decimals)) : Math.round(v));
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [target, decimals]);
    const display = decimals > 0 ? val.toFixed(decimals) : val.toLocaleString('en-IN');
    return <>{prefix}{display}{suffix}</>;
}

function CarbonEstimator({ platformScans }: { platformScans?: number }) {
    const [items, setItems] = useState(platformScans ?? 150);
    const [mix, setMix] = useState<MaterialMix>(DEFAULT_MIX);
    const [inputVal, setInputVal] = useState(String(platformScans ?? 150));
    const [shared, setShared] = useState(false);

    useEffect(() => {
        if (platformScans) {
            setItems(platformScans);
            setInputVal(String(platformScans));
        }
    }, [platformScans]);

    const result = computeImpact(items, mix);

    function normalise(key: keyof MaterialMix, raw: number) {
        const newMix = { ...mix, [key]: raw };
        setMix(newMix);
    }

    function handleShare() {
        const text = `♻️ ${items} items scanned on AI-EcoTrack → ${result.co2Kg.toFixed(1)} kg CO₂ diverted, ${Math.round(result.treesYear)} tree-years saved, ₹${Math.round(result.valueINR).toLocaleString('en-IN')} value recovered! #CircularEconomy #AIEcoTrack`;
        navigator.clipboard.writeText(text).then(() => {
            setShared(true);
            setTimeout(() => setShared(false), 2500);
        });
    }

    const resultCards = [
        {
            icon: Wind, label: 'CO₂ Diverted',
            value: result.co2Kg, decimals: 1, suffix: ' kg',
            sub: 'vs. landfill / incineration baseline',
            color: '#34d399', glow: 'rgba(52,211,153,0.15)',
        },
        {
            icon: Leaf, label: 'Tree-Years Saved',
            value: result.treesYear, decimals: 1, suffix: ' yrs',
            sub: 'CO₂ absorbed by an avg. tree per year',
            color: '#84cc16', glow: 'rgba(132,204,22,0.15)',
        },
        {
            icon: Car, label: 'Driving Avoided',
            value: result.kmAvoided, decimals: 0, suffix: ' km',
            sub: 'Equivalent petrol car distance',
            color: '#60a5fa', glow: 'rgba(96,165,250,0.15)',
        },
        {
            icon: Zap, label: 'Energy Saved',
            value: result.kwhSaved, decimals: 0, suffix: ' kWh',
            sub: 'Coal-plant power equivalent avoided',
            color: '#f59e0b', glow: 'rgba(245,158,11,0.15)',
        },
        {
            icon: TrendingUp, label: 'Recovery Value',
            value: result.valueINR, decimals: 0, prefix: '₹', suffix: '',
            sub: 'Indian scrap market estimated value',
            color: '#a78bfa', glow: 'rgba(167,139,250,0.15)',
        },
        {
            icon: Factory, label: 'Mass Processed',
            value: result.massKg, decimals: 1, suffix: ' kg',
            sub: 'Total estimated material weight',
            color: '#fb923c', glow: 'rgba(251,146,60,0.15)',
        },
    ];

    return (
        <section className="rounded-3xl overflow-hidden relative"
            style={{ background: 'var(--bg-card)', border: '1px solid rgba(132,204,22,0.2)' }}>

            {/* ambient glow top */}
            <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(132,204,22,0.07) 0%, transparent 60%)' }} />

            <div className="relative px-6 sm:px-10 py-10 space-y-10">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                style={{ background: 'rgba(132,204,22,0.15)', border: '1px solid rgba(132,204,22,0.3)' }}>
                                <Calculator size={15} style={{ color: '#84cc16' }} />
                            </div>
                            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#84cc16' }}>
                                AI Carbon Calculator
                            </span>
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                                style={{ background: 'rgba(132,204,22,0.12)', color: '#84cc16', border: '1px solid rgba(132,204,22,0.2)' }}>
                                <Sparkles size={9} /> Live
                            </span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>
                            CO₂ Footprint Estimator
                        </h2>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                            Adjust items scanned &amp; material mix — see your real environmental impact instantly.
                        </p>
                    </div>
                    <button
                        onClick={handleShare}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-105 shrink-0 self-start sm:self-auto"
                        style={{
                            background: shared ? 'rgba(132,204,22,0.2)' : 'var(--bg-elevated)',
                            border: `1px solid ${shared ? 'rgba(132,204,22,0.5)' : 'var(--border)'}`,
                            color: shared ? '#84cc16' : 'var(--text-secondary)',
                        }}>
                        <Share2 size={13} />
                        {shared ? 'Copied to clipboard!' : 'Share result'}
                    </button>
                </div>

                {/* Controls */}
                <div className="grid lg:grid-cols-2 gap-8">

                    {/* Left — item count */}
                    <div className="space-y-6">
                        <div className="rounded-2xl p-5 space-y-4"
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-white">Items Scanned</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={1} max={100000}
                                        value={inputVal}
                                        onChange={e => {
                                            setInputVal(e.target.value);
                                            const n = parseInt(e.target.value, 10);
                                            if (!isNaN(n) && n >= 1 && n <= 100000) setItems(n);
                                        }}
                                        className="w-24 text-right text-sm font-bold rounded-lg px-3 py-1.5 outline-none focus:ring-1"
                                        style={{
                                            background: 'var(--bg-card)',
                                            border: '1px solid var(--border)',
                                            color: '#84cc16',
                                            '--tw-ring-color': '#84cc16',
                                        } as React.CSSProperties}
                                    />
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>items</span>
                                </div>
                            </div>
                            <input
                                type="range" min={1} max={10000} step={1}
                                value={Math.min(items, 10000)}
                                onChange={e => {
                                    const v = parseInt(e.target.value, 10);
                                    setItems(v);
                                    setInputVal(String(v));
                                }}
                                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                                style={{ accentColor: '#84cc16' }}
                            />
                            <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                <span>1</span><span>2,500</span><span>5,000</span><span>10,000</span>
                            </div>
                            {platformScans && (
                                <button
                                    onClick={() => { setItems(platformScans); setInputVal(String(platformScans)); }}
                                    className="text-xs font-medium transition-all hover:opacity-80"
                                    style={{ color: '#84cc16' }}>
                                    ↺ Use live platform total ({platformScans.toLocaleString('en-IN')} scans)
                                </button>
                            )}
                        </div>

                        {/* vs. Landfill baseline bar */}
                        <div className="rounded-2xl p-5 space-y-3"
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                            <div className="flex items-center gap-2">
                                <Flame size={14} style={{ color: '#f87171' }} />
                                <span className="text-sm font-semibold text-white">vs. Landfill Baseline</span>
                            </div>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                CO₂ diverted as a share of what landfill would have emitted
                            </p>
                            <div className="relative h-5 rounded-full overflow-hidden"
                                style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.2)' }}>
                                <div
                                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                                    style={{
                                        width: `${Math.min(result.reductionPct, 100)}%`,
                                        background: 'linear-gradient(90deg,#84cc16,#34d399)',
                                        boxShadow: '0 0 12px rgba(132,204,22,0.4)',
                                    }} />
                            </div>
                            <div className="flex justify-between text-xs font-bold">
                                <span style={{ color: '#34d399' }}>
                                    {result.reductionPct.toFixed(1)}% emission reduction
                                </span>
                                <span style={{ color: 'var(--text-muted)' }}>100%</span>
                            </div>
                        </div>
                    </div>

                    {/* Right — material mix */}
                    <div className="rounded-2xl p-5 space-y-4"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2">
                            <SlidersHorizontal size={14} style={{ color: '#60a5fa' }} />
                            <span className="text-sm font-semibold text-white">Material Mix</span>
                            <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                                proportional weighting
                            </span>
                        </div>
                        <div className="space-y-3">
                            {MATERIAL_META.map(({ key, label, color, emoji }) => (
                                <div key={key} className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                            {emoji} {label}
                                        </span>
                                        <span className="text-xs font-bold" style={{ color }}>
                                            {mix[key]}%
                                        </span>
                                    </div>
                                    <input
                                        type="range" min={0} max={100} step={5}
                                        value={mix[key]}
                                        onChange={e => normalise(key, parseInt(e.target.value, 10))}
                                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                        style={{ accentColor: color }}
                                    />
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            Sliders are weighted proportionally — no need to total 100%.
                        </p>
                    </div>
                </div>

                {/* Result cards */}
                <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                        Estimated Environmental Impact
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {resultCards.map(({ icon: Icon, label, value, decimals, prefix, suffix, sub, color, glow }) => (
                            <div key={label}
                                className="rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden transition-all hover:scale-[1.03]"
                                style={{ background: 'var(--bg-elevated)', border: `1px solid ${color}30` }}>
                                <div className="absolute inset-0 pointer-events-none rounded-2xl"
                                    style={{ background: `radial-gradient(ellipse at 50% 0%, ${glow} 0%, transparent 70%)` }} />
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center relative"
                                    style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                                    <Icon size={14} style={{ color }} />
                                </div>
                                <p className="text-xl font-bold text-white relative" style={{ fontFamily: 'Space Grotesk' }}>
                                    <AnimNum target={value} decimals={decimals} prefix={prefix ?? ''} suffix={suffix} />
                                </p>
                                <div className="relative">
                                    <p className="text-[11px] font-semibold" style={{ color }}>{label}</p>
                                    <p className="text-[10px] leading-4 mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Share summary */}
                <div className="rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
                    style={{ background: 'rgba(132,204,22,0.06)', border: '1px solid rgba(132,204,22,0.15)' }}>
                    <Sparkles size={15} style={{ color: '#84cc16' }} className="shrink-0" />
                    <p className="text-xs leading-5 flex-1" style={{ color: 'var(--text-secondary)' }}>
                        <span className="font-bold text-white">{items.toLocaleString('en-IN')} items</span> scanned →{' '}
                        <span className="font-bold" style={{ color: '#34d399' }}>{result.co2Kg.toFixed(1)} kg CO₂</span> diverted ·{' '}
                        <span className="font-bold" style={{ color: '#84cc16' }}>{result.treesYear.toFixed(1)} tree-years</span> saved ·{' '}
                        <span className="font-bold" style={{ color: '#60a5fa' }}>{Math.round(result.kmAvoided).toLocaleString('en-IN')} km</span> of driving avoided ·{' '}
                        <span className="font-bold" style={{ color: '#a78bfa' }}>₹{Math.round(result.valueINR).toLocaleString('en-IN')}</span> scrap value recovered
                    </p>
                    <button
                        onClick={handleShare}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80 shrink-0"
                        style={{ background: 'rgba(132,204,22,0.15)', color: '#84cc16', border: '1px solid rgba(132,204,22,0.25)' }}>
                        <Share2 size={11} />
                        {shared ? 'Copied!' : 'Copy'}
                    </button>
                </div>

                {/* Methodology footnote */}
                <p className="text-[10px] leading-5" style={{ color: 'var(--text-muted)' }}>
                    Methodology: EPA / IPCC emission factors (Al 9.16, Cu 3.40, E-waste 3.65, Plastic 2.53, Steel 1.46, Paper 1.10 kg CO₂/kg).
                    Tree absorption: 21.77 kg CO₂/yr. Car: 192 g CO₂/km. Coal power: 0.82 kg CO₂/kWh.
                    Average item masses and Indian scrap prices (LME + local market indices, Aug 2026).
                </p>
            </div>
        </section>
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

                {/* ══════════════ CO₂ FOOTPRINT ESTIMATOR ══════════════ */}
                <CarbonEstimator platformScans={t?.scans} />

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
