'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
    ArrowRight, Camera, QrCode, Leaf, Shield, Zap, BarChart2,
    MapPin, Award, CheckCircle2, ChevronRight, Cpu, Globe2,
    TrendingUp, Users, Menu, X, Recycle, Factory,
} from 'lucide-react';

// ── Platform stats ─────────────────────────────────────────────────────────
interface PlatformTotals {
    scans: number;
    massKg: number;
    co2Kg: number;
    valueINR: number;
    activeOrgs: number;
}

function usePlatformStats() {
    const [data, setData] = useState<PlatformTotals | null>(null);
    useEffect(() => {
        fetch('/api/platform-stats')
            .then(r => r.ok ? r.json() : null)
            .then(d => d?.totals && setData(d.totals))
            .catch(() => {});
    }, []);
    return data;
}

// ── Impact ticker in nav ────────────────────────────────────────────────────
function ImpactTicker() {
    const stats = usePlatformStats();
    const [open, setOpen] = useState(false);

    if (!stats) return null;

    function fmtINR(n: number) {
        if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
        if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`;
        if (n >= 1_000)      return `₹${(n / 1_000).toFixed(0)}K`;
        return `₹${n}`;
    }

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all hover:opacity-90"
                style={{ background: 'rgba(132,204,22,0.1)', border: '1px solid rgba(132,204,22,0.25)', color: 'var(--lime)' }}
            >
                <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
                <span>Impact</span>
                <ChevronRight size={10} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>

            {open && (
                <div className="absolute top-full right-0 mt-2 w-72 rounded-2xl p-4 z-50 space-y-3"
                    style={{ background: 'var(--bg-card)', border: '1px solid rgba(132,204,22,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--lime)' }}>Live Platform Impact</p>
                    {[
                        { label: 'Items classified', value: stats.scans.toLocaleString('en-IN'), color: '#84cc16' },
                        { label: 'CO₂ diverted', value: `${stats.co2Kg.toFixed(1)} kg`, color: '#34d399' },
                        { label: 'Recovery value', value: fmtINR(stats.valueINR), color: '#60a5fa' },
                        { label: 'Mass processed', value: `${stats.massKg.toFixed(0)} kg`, color: '#a78bfa' },
                        { label: 'Active organisations', value: `${stats.activeOrgs}`, color: '#f59e0b' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="flex items-center justify-between">
                            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{label}</span>
                            <span className="text-xs font-bold" style={{ color }}>{value}</span>
                        </div>
                    ))}
                    <Link href="/impact"
                        className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90 mt-2"
                        style={{ background: 'rgba(132,204,22,0.12)', color: 'var(--lime)', border: '1px solid rgba(132,204,22,0.2)' }}
                        onClick={() => setOpen(false)}>
                        View full impact dashboard
                        <ArrowRight size={11} />
                    </Link>
                </div>
            )}
        </div>
    );
}

type ScrollFadeProps = {
    children: React.ReactNode;
    className?: string;
    delayMs?: number;
};

function ScrollFade({ children, className = '', delayMs = 0 }: ScrollFadeProps) {
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const obs = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                obs.disconnect();
            }
        }, { threshold: 0.2 });

        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className={`fade-on-scroll ${isVisible ? 'is-visible' : ''} ${className}`}
            style={{ transitionDelay: `${delayMs}ms` }}
        >
            {children}
        </div>
    );
}

// ── Animated counter hook ─────────────────────────────────────────────────────
function useCounter(target: number, duration = 1800) {
    const [val, setVal] = useState(0);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            obs.disconnect();
            const start = performance.now();
            const step = (now: number) => {
                const p = Math.min((now - start) / duration, 1);
                const ease = 1 - Math.pow(1 - p, 3);
                setVal(Math.round(ease * target));
                if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }, { threshold: 0.3 });
        obs.observe(el);
        return () => obs.disconnect();
    }, [target, duration]);
    return { val, ref };
}

// ── Scan Demo Terminal ────────────────────────────────────────────────────────
function ScanDemo() {
    const [step, setStep] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setStep(s => (s + 1) % 5), 1800);
        return () => clearInterval(id);
    }, []);

    const lines = [
        { label: '▸ Capturing frame …', color: '#94a3b8', done: step > 0 },
        { label: '✓ Part class: Gate Valve  [0.94]', color: 'var(--lime)', done: step > 1 },
        { label: '✓ Material: 316L Stainless Steel', color: 'var(--lime)', done: step > 2 },
        { label: '⚠  Hazard: pressurized system', color: '#f59e0b', done: step > 3 },
        { label: '✓ WRI score: A  |  ₹4,820 recovery', color: '#60a5fa', done: step > 4 },
    ];

    return (
        <div className="relative rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid rgba(132,204,22,0.2)', boxShadow: '0 0 60px rgba(132,204,22,0.06)' }}>
            {/* window bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
                <span className="ml-3 text-xs font-mono" style={{ color: '#475569' }}>ai-ecotrack › scan</span>
                <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{ background: 'rgba(132,204,22,0.12)', color: 'var(--lime)', border: '1px solid rgba(132,204,22,0.2)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    LIVE
                </div>
            </div>

            {/* camera viewfinder mockup */}
            <div className="relative mx-4 mt-4 rounded-xl overflow-hidden"
                style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.06)', aspectRatio: '16/7' }}>
                {/* fake image content */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-2 rounded-2xl flex items-center justify-center"
                            style={{ background: 'var(--lime-glow)', border: '1px solid rgba(132,204,22,0.15)' }}>
                            <Camera size={28} style={{ color: 'var(--lime)' }} />
                        </div>
                        <p className="text-xs font-mono" style={{ color: '#334155' }}>gate_valve_01.jpg</p>
                    </div>
                </div>
                {/* scanning crosshair */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-20 relative" style={{ border: '1px solid rgba(132,204,22,0.4)', borderRadius: 4 }}>
                        {/* corner brackets */}
                        {['top-0 left-0','top-0 right-0','bottom-0 left-0','bottom-0 right-0'].map((pos, i) => (
                            <div key={i} className={`absolute w-3 h-3 ${pos}`}
                                style={{
                                    borderTop: i < 2 ? '2px solid #84cc16' : 'none',
                                    borderBottom: i >= 2 ? '2px solid #84cc16' : 'none',
                                    borderLeft: i % 2 === 0 ? '2px solid #84cc16' : 'none',
                                    borderRight: i % 2 !== 0 ? '2px solid #84cc16' : 'none',
                                }} />
                        ))}
                        {/* scan line */}
                        <div className="absolute left-0 right-0 h-px"
                            style={{
                                background: 'rgba(132,204,22,0.6)',
                                top: `${30 + Math.round(Math.sin(step) * 30)}%`,
                                transition: 'top 1.8s ease-in-out',
                                boxShadow: '0 0 8px rgba(132,204,22,0.4)',
                            }} />
                    </div>
                </div>
                {/* confidence chip */}
                {step > 1 && (
                    <div className="absolute top-2 right-2 px-2 py-1 rounded-lg text-[10px] font-bold font-mono animate-in fade-in"
                        style={{ background: 'rgba(132,204,22,0.15)', color: 'var(--lime)', border: '1px solid rgba(132,204,22,0.25)' }}>
                        GATE VALVE · 94%
                    </div>
                )}
            </div>

            {/* terminal output */}
            <div className="p-4 font-mono text-xs space-y-2">
                {lines.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 transition-all duration-500"
                        style={{ opacity: l.done ? 1 : 0, transform: l.done ? 'translateX(0)' : 'translateX(-4px)' }}>
                        <span style={{ color: l.color }}>{l.label}</span>
                    </div>
                ))}
            </div>

            {/* bottom passport strip */}
            <div className="h-16 px-4 mb-4">
                <div className={`h-full rounded-xl px-4 flex items-center gap-3 transition-all duration-500 delay-200 ${step > 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
                    style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.18)' }}>
                    <QrCode size={20} style={{ color: '#60a5fa' }} />
                    <div className="flex-1">
                        <p className="text-xs font-semibold text-white">Digital Passport generated</p>
                        <p className="text-[10px]" style={{ color: '#60a5fa' }}>DPP-2024-GV-001 · traceable · shareable</p>
                    </div>
                    <ChevronRight size={14} style={{ color: '#60a5fa' }} />
                </div>
            </div>
        </div>
    );
}

// ── Stat card with counter ────────────────────────────────────────────────────
function StatCard({ target, suffix, label }: { target: number; suffix: string; label: string }) {
    const { val, ref } = useCounter(target);
    return (
        <div ref={ref} className="text-center">
            <p className="text-3xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>
                {val.toLocaleString('en-IN')}{suffix}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>{label}</p>
        </div>
    );
}

// ── Live Impact Strip ─────────────────────────────────────────────────────────
function ImpactStrip() {
    const stats = usePlatformStats();

    function fmtINR(n: number) {
        if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
        if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`;
        if (n >= 1_000)      return `₹${(n / 1_000).toFixed(0)}K`;
        return `₹${n}`;
    }

    const items = stats ? [
        { icon: BarChart2, label: 'Items AI-classified', value: stats.scans.toLocaleString('en-IN'), accent: '#84cc16' },
        { icon: Globe2,    label: 'CO₂ Diverted',        value: `${stats.co2Kg.toFixed(0)} kg`,      accent: '#34d399' },
        { icon: TrendingUp, label: 'Recovery Value',    value: fmtINR(stats.valueINR),              accent: '#60a5fa' },
        { icon: Factory,   label: 'Active Orgs',         value: `${stats.activeOrgs}`,               accent: '#a78bfa' },
    ] : null;

    return (
        <section className="relative z-10 px-5 pb-4 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-6xl">
                <div className="rounded-3xl overflow-hidden"
                    style={{ background: 'var(--bg-card)', border: '1px solid rgba(132,204,22,0.18)' }}>
                    {/* Header */}
                    <div className="px-6 pt-5 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                        style={{ borderBottom: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
                            <p className="text-sm font-semibold text-white" style={{ fontFamily: 'Space Grotesk' }}>
                                Platform Impact — Live
                            </p>
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(132,204,22,0.1)', color: 'var(--lime)' }}>
                                Updated every 10 min
                            </span>
                        </div>
                        <Link href="/impact"
                            className="flex items-center gap-1.5 text-xs font-semibold transition-all hover:opacity-80"
                            style={{ color: 'var(--lime)' }}>
                            View full dashboard
                            <ArrowRight size={12} />
                        </Link>
                    </div>
                    {/* Stats row */}
                    <div className="grid grid-cols-2 md:grid-cols-4">
                        {items ? items.map(({ icon: Icon, label, value, accent }, i) => (
                            <div key={label}
                                className={`px-6 py-5 flex flex-col gap-2 ${i < items.length - 1 ? 'border-r' : ''} ${i >= 2 ? 'border-t md:border-t-0' : ''}`}
                                style={{ borderColor: 'var(--border)' }}>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
                                    <Icon size={15} style={{ color: accent }} />
                                </div>
                                <p className="text-xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>{value}</p>
                                <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{label}</p>
                            </div>
                        )) : (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="px-6 py-5 flex flex-col gap-3">
                                    <div className="w-8 h-8 rounded-lg shimmer" />
                                    <div className="w-16 h-5 rounded shimmer" />
                                    <div className="w-24 h-3 rounded shimmer" />
                                </div>
                            ))
                        )}
                    </div>
                    {/* Footer context */}
                    <div className="px-6 py-3 flex items-center gap-2"
                        style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}>
                        <Recycle size={12} style={{ color: 'var(--text-muted)' }} />
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            India generates 3.2M tonnes of e-waste/year — only 22% formally recycled.
                            AI-EcoTrack creates a traceable, EPR-compliant path for every item.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}

// ── Data ──────────────────────────────────────────────────────────────────────

const features = [
    {
        icon: Camera,
        color: 'var(--lime)',
        bg: 'var(--lime-glow)',
        border: 'var(--lime-border)',
        title: 'AI Visual Identification',
        body: 'Photograph any industrial part or e-waste — Gemini & Groq VLMs classify material, alloy grade, surface condition, and confidence in seconds.',
    },
    {
        icon: Shield,
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.08)',
        border: 'rgba(245,158,11,0.18)',
        title: 'Hazard Flagging',
        body: 'Automatically surface pressurized systems, lead solder likelihood, asbestos era flags, and fluid risks before any tool touches the item.',
    },
    {
        icon: QrCode,
        color: '#60a5fa',
        bg: 'rgba(96,165,250,0.08)',
        border: 'rgba(96,165,250,0.18)',
        title: 'Digital Product Passports',
        body: 'Generate a QR-linked, shareable passport with WRI score, recovery value in ₹, CO₂ saved, material chain, and regulatory references.',
    },
    {
        icon: BarChart2,
        color: '#a78bfa',
        bg: 'rgba(167,139,250,0.08)',
        border: 'rgba(167,139,250,0.18)',
        title: 'Org-level Analytics',
        body: 'Grade distribution donuts, scan activity bars, cumulative recovery sparklines, and hazard summary — all live, no third-party BI tools.',
    },
    {
        icon: Cpu,
        color: '#34d399',
        bg: 'rgba(52,211,153,0.08)',
        border: 'rgba(52,211,153,0.18)',
        title: 'IoT + Raspberry Pi',
        body: 'Connect fill-level sensors, gas detectors, and a Pi camera for automated scanning directly from the shop floor.',
    },
    {
        icon: Award,
        color: '#fbbf24',
        bg: 'rgba(251,191,36,0.08)',
        border: 'rgba(251,191,36,0.18)',
        title: 'Worker Badge System',
        body: '10 progressive badges — First Scan to Points Legend — keep field workers motivated with transparent progress and achievements.',
    },
    {
        icon: MapPin,
        color: '#f472b6',
        bg: 'rgba(244,114,182,0.08)',
        border: 'rgba(244,114,182,0.18)',
        title: 'Drop-off Locator',
        body: 'Geolocation + OpenStreetMap Overpass API finds the nearest e-waste recycling centres within 5 km, with "Open in Maps" links.',
    },
    {
        icon: Globe2,
        color: '#38bdf8',
        bg: 'rgba(56,189,248,0.08)',
        border: 'rgba(56,189,248,0.18)',
        title: 'Multilingual TTS Guide',
        body: 'Step-by-step disassembly guides are read aloud in English or Hindi using GCP WaveNet voices for workers who need hands-free guidance.',
    },
];

const steps = [
    {
        n: '01',
        icon: Camera,
        title: 'Capture the part',
        body: 'Take a single photo or use multi-view mode. AI identifies part class, material, and condition instantly.',
        color: 'var(--lime)',
    },
    {
        n: '02',
        icon: Shield,
        title: 'Review hazards & guide',
        body: 'Safety flags surface automatically. Read the step-by-step disassembly guide or listen via TTS.',
        color: '#f59e0b',
    },
    {
        n: '03',
        icon: QrCode,
        title: 'Generate passport',
        body: 'A scannable QR passport is created with WRI score, material data, CO₂ impact, and recovery value.',
        color: '#60a5fa',
    },
    {
        n: '04',
        icon: TrendingUp,
        title: 'Track & report',
        body: 'Org dashboards, worker leaderboards, badge progress, and CSV/PDF export for compliance reporting.',
        color: '#a78bfa',
    },
];

const benefits = [
    'Zero barcode or label dependency',
    'Grade A/B/C WRI scoring per scan',
    'CO₂ saved calculation on every item',
    'Recovery value in ₹ (India scrap pricing)',
    'Compliant with EU ESPR 2024 & India E-Waste Rules 2022',
    'OSHA 1910.147 & RoHS / REACH references built-in',
    'Works offline-first with progressive enhancement',
    'Anonymous guest access + org team flows',
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const navLinks: Array<{ label: string; href: string }> = [
        { label: 'Features', href: '#features' },
        { label: 'How it Works', href: '#how' },
        { label: 'Benefits', href: '#benefits' },
    ];

    return (
        <main className="relative min-h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

            {/* ── ambient glow orbs ── */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-48 -top-48 w-[600px] h-[600px] rounded-full blur-[120px]"
                    style={{ background: 'radial-gradient(circle, rgba(132,204,22,0.12) 0%, transparent 70%)' }} />
                <div className="absolute -right-32 top-32 w-[500px] h-[500px] rounded-full blur-[100px]"
                    style={{ background: 'radial-gradient(circle, rgba(96,165,250,0.1) 0%, transparent 70%)' }} />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full blur-[120px]"
                    style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.07) 0%, transparent 70%)' }} />
                <div className="absolute inset-0 bg-grid opacity-60" />
            </div>

            {/* ══════════════════════════════ NAV ══════════════════════════════ */}
            <nav className="fixed top-0 inset-x-0 z-40 px-4 pt-4 sm:px-8 lg:px-12">
                <div className="mx-auto max-w-6xl flex items-center justify-between rounded-2xl px-3 py-2 sm:px-5 sm:py-3"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0"
                            style={{ background: 'rgba(132,204,22,0.12)', border: '1px solid rgba(132,204,22,0.25)' }}>
                            <Leaf size={18} style={{ color: 'var(--lime)' }} />
                        </div>
                        <div className="flex flex-col justify-center min-w-0">
                            <p className="font-bold text-white text-[15px] leading-tight" style={{ fontFamily: 'Space Grotesk' }}>AI-EcoTrack</p>
                            <p className="hidden sm:block text-[9px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-muted)' }}>Circular Recovery Intelligence</p>
                        </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-6">
                        {navLinks.map(({ label, href }) => (
                            <a key={label} href={href} className="text-sm font-medium transition-colors hover:text-white"
                                style={{ color: 'var(--text-dim)' }}>{label}</a>
                        ))}
                        <ImpactTicker />
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/auth" className="hidden sm:inline-flex items-center justify-center h-10 px-4 rounded-full text-sm font-semibold transition-all hover:opacity-80"
                            style={{ color: 'var(--text-secondary)' }}>Login</Link>
                        <Link href="/auth" className="flex items-center justify-center h-10 px-4 sm:px-5 rounded-full text-sm font-bold transition-all hover:opacity-90 gap-1.5"
                            style={{ background: 'var(--lime)', color: '#0f172a' }}>
                            <span className="hidden sm:inline">Get Started</span>
                            <span className="sm:hidden">Start</span>
                            <ArrowRight size={16} />
                        </Link>
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(v => !v)}
                            className="sm:hidden w-10 h-10 rounded-[14px] flex items-center justify-center ml-1"
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                            aria-label="Toggle navigation menu"
                        >
                            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </div>

                {/* Mobile dropdown links */}
                <div className={`sm:hidden mx-auto max-w-6xl mt-2 rounded-[18px] overflow-hidden transition-all duration-300 ${mobileMenuOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', backdropFilter: 'blur(24px)' }}>
                    <div className="p-2 flex flex-col gap-1">
                        {navLinks.map(({ label, href }) => (
                            <a
                                key={label}
                                href={href}
                                onClick={() => setMobileMenuOpen(false)}
                                className="px-4 py-3 rounded-xl text-sm font-semibold"
                                style={{ color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}
                            >
                                {label}
                            </a>
                        ))}
                        <Link
                            href="/auth"
                            onClick={() => setMobileMenuOpen(false)}
                            className="px-4 py-3 rounded-xl text-sm font-semibold"
                            style={{ color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}
                        >
                            Login
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Spacer for fixed nav */}
            <div className="h-24 sm:h-20" />

            {/* ══════════════════════════════ HERO ═════════════════════════════ */}
            <section className="relative z-10 px-5 pt-16 pb-12 sm:px-8 lg:px-12">
                <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-12 lg:items-center">

                    {/* left — copy */}
                    <div>
                        <ScrollFade>
                            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-tight"
                                style={{ fontFamily: 'Space Grotesk' }}>
                                Turn industrial scrap into{' '}
                                <span style={{ background: 'linear-gradient(90deg,#84cc16,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                    smarter recovery
                                </span>
                            </h1>
                        </ScrollFade>
                        <ScrollFade delayMs={100}>
                            <p className="mt-6 text-base sm:text-lg leading-8" style={{ color: 'var(--text-secondary)' }}>
                                Point your camera at any part — AI identifies material, surfaces hazards, generates a digital passport, and calculates recovery value in seconds. No labels, no lab, no guesswork.
                            </p>
                        </ScrollFade>

                        <div className="mt-8 flex flex-col sm:flex-row gap-3">
                            <Link href="/auth"
                                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-bold text-sm transition-all hover:scale-105 hover:shadow-lg"
                                style={{ background: 'linear-gradient(135deg,#84cc16,#65a30d)', color: '#0f172a', boxShadow: '0 0 24px rgba(132,204,22,0.3)' }}>
                                Start Scanning Free
                                <ArrowRight size={16} />
                            </Link>
                            <Link href="/dashboard"
                                className="btn-secondary px-6 rounded-full w-auto">
                                View Demo Dashboard
                            </Link>
                        </div>

                        {/* trust badges */}
                        <div className="mt-8 flex flex-wrap gap-2">
                            {['EU ESPR 2024','India E-Waste Rules 2022','OSHA 1910.147','RoHS / REACH'].map(s => (
                                <span key={s} className="px-3 py-1 rounded-full text-[11px] font-semibold"
                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                                    {s}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* right — live scan demo */}
                    <div>
                        <ScanDemo />
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════ STATS ════════════════════════════ */}
            <section className="relative z-10 px-5 py-10 sm:px-8 lg:px-12">
                <div className="mx-auto max-w-6xl">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 rounded-2xl px-6 py-8"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <StatCard target={94} suffix="%" label="Avg part-class confidence" />
                        <StatCard target={8} suffix=" types" label="Hazard flags auto-detected" />
                        <StatCard target={10} suffix="" label="Badges to earn as worker" />
                        <StatCard target={5} suffix=" km" label="Drop-off search radius" />
                    </div>
                </div>
            </section>

            {/* ════════════════════════════════════════════ FEATURES ═══════════════════════ */}
            <section id="features" className="relative z-10 px-5 py-16 sm:px-8 lg:px-12">
                <div className="mx-auto max-w-6xl">
                    <div className="text-center mb-12">
                        <ScrollFade>
                            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--lime)' }}>Platform Features</p>
                        </ScrollFade>
                        <ScrollFade delayMs={80}>
                            <h2 className="text-3xl sm:text-4xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>
                                Everything you need for responsible recovery
                            </h2>
                        </ScrollFade>
                        <ScrollFade delayMs={140}>
                            <p className="mt-4 text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
                                From first photograph to compliance report — one platform, zero extra tooling.
                            </p>
                        </ScrollFade>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {features.map(({ icon: Icon, color, bg, border, title, body }) => (
                            <div key={title} className="rounded-2xl p-5 flex flex-col gap-4 transition-all hover:scale-[1.02] hover:shadow-xl"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: bg, border: `1px solid ${border}` }}>
                                    <Icon size={18} style={{ color }} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white text-sm mb-2" style={{ fontFamily: 'Space Grotesk' }}>{title}</h3>
                                    <p className="text-xs leading-6" style={{ color: 'var(--text-dim)' }}>{body}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════ HOW IT WORKS ════════════════════════ */}
            <section id="how" className="relative z-10 px-5 py-16 sm:px-8 lg:px-12">
                <div className="mx-auto max-w-6xl">
                    <div className="text-center mb-12">
                        <ScrollFade>
                            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#60a5fa' }}>How It Works</p>
                        </ScrollFade>
                        <ScrollFade delayMs={80}>
                            <h2 className="text-3xl sm:text-4xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>
                                From scan to passport in 4 steps
                            </h2>
                        </ScrollFade>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {steps.map(({ n, icon: Icon, title, body, color }, i) => (
                            <div key={n} className="relative rounded-2xl p-6"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                {/* connector line */}
                                {i < steps.length - 1 && (
                                    <div className="hidden lg:block absolute top-8 -right-3 w-6 h-px z-10"
                                        style={{ background: `linear-gradient(90deg, ${color}60, transparent)` }} />
                                )}
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                                        <Icon size={18} style={{ color }} />
                                    </div>
                                    <span className="text-2xl font-bold" style={{ color: `${color}40`, fontFamily: 'Space Grotesk' }}>{n}</span>
                                </div>
                                <h3 className="font-semibold text-white mb-2" style={{ fontFamily: 'Space Grotesk' }}>{title}</h3>
                                <p className="text-xs leading-6" style={{ color: 'var(--text-dim)' }}>{body}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ════════════════════════════ SCAN MOCKUP ════════════════════════ */}
            <section className="relative z-10 px-5 py-16 sm:px-8 lg:px-12">
                <div className="mx-auto max-w-6xl">
                    <div className="rounded-3xl overflow-hidden grid lg:grid-cols-2"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--lime-border)' }}>

                        {/* left — sample result card */}
                        <div className="p-8 flex flex-col justify-center gap-6 border-b lg:border-b-0 lg:border-r"
                            style={{ borderColor: 'var(--border)' }}>
                            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--lime)' }}>Sample Scan Result</p>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>Gate Valve · 316L SS</h3>
                                    <span className="px-2 py-1 rounded-lg text-xs font-bold"
                                        style={{ background: 'rgba(132,204,22,0.15)', color: 'var(--lime)', border: '1px solid rgba(132,204,22,0.25)' }}>Grade A</span>
                                </div>
                                <p className="text-sm" style={{ color: 'var(--text-dim)' }}>DN50 · moderate corrosion · bilateral symmetry</p>
                            </div>

                            {/* WRI bar */}
                            <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                    <span style={{ color: 'var(--text-dim)' }}>Waste Recovery Index</span>
                                    <span className="font-bold" style={{ color: 'var(--lime)' }}>0.91 / 1.0</span>
                                </div>
                                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                                    <div className="h-full rounded-full" style={{ width: '91%', background: 'linear-gradient(90deg,#84cc16,#34d399)' }} />
                                </div>
                            </div>

                            {/* metrics grid */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'Recovery Value', value: '₹4,820', color: 'var(--lime)' },
                                    { label: 'CO₂ Saved', value: '12.4 kg', color: '#34d399' },
                                    { label: 'Mass Est.', value: '8.5 kg', color: '#60a5fa' },
                                ].map(m => (
                                    <div key={m.label} className="rounded-xl p-3 text-center"
                                        style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                        <p className="text-base font-bold" style={{ color: m.color, fontFamily: 'Space Grotesk' }}>{m.value}</p>
                                        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{m.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* hazard flags */}
                            <div className="flex flex-wrap gap-2">
                                <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                                    style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                                    ⚠ Pressurized system
                                </span>
                                <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                                    style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }}>
                                    ⚠ Hydrocarbon residual
                                </span>
                            </div>
                        </div>

                        {/* right — passport + guide preview */}
                        <div className="p-8 flex flex-col gap-5">
                            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#60a5fa' }}>Auto-Generated Passport</p>

                            <div className="rounded-2xl p-5"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                                <div className="flex items-start gap-4">
                                    {/* fake QR */}
                                    <div className="w-16 h-16 rounded-xl shrink-0 grid grid-cols-4 gap-0.5 p-1.5"
                                        style={{ background: 'white' }}>
                                        {Array.from({ length: 16 }).map((_, i) => (
                                            <div key={i} className="rounded-[1px]"
                                                style={{ background: [0,1,4,5,2,7,8,10,12,15].includes(i) ? '#0a0f1e' : 'white' }} />
                                        ))}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white">DPP-2024-GV-001</p>
                                        <p className="text-xs mt-1" style={{ color: '#60a5fa' }}>Gate Valve · 316L Stainless Steel</p>
                                        <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
                                            EU ESPR compliant · India E-Waste Rules 2022
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>Disassembly Guide (excerpt)</p>
                                {[
                                    { step: '1', text: 'Don nitrile gloves + face shield — pressurized system', warn: true },
                                    { step: '2', text: 'Isolate and depressurize using LOTO procedure', warn: true },
                                    { step: '3', text: 'Remove bonnet bolts with 24mm spanner (torque: 85 Nm)', warn: false },
                                    { step: '4', text: 'Extract gate disc — separate SS body for scrap grading', warn: false },
                                ].map(s => (
                                    <div key={s.step} className="flex items-start gap-3 py-2 border-b last:border-0"
                                        style={{ borderColor: 'var(--border-subtle)' }}>
                                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                                            style={{ background: s.warn ? 'rgba(245,158,11,0.15)' : 'rgba(132,204,22,0.12)', color: s.warn ? '#f59e0b' : 'var(--lime)' }}>
                                            {s.step}
                                        </div>
                                        <p className="text-xs leading-5" style={{ color: s.warn ? '#fcd34d' : 'var(--text-secondary)' }}>{s.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ════════════════════════ LIVE IMPACT STRIP ═══════════════════ */}
            <section className="relative z-10 px-5 pt-6 pb-2 sm:px-8 lg:px-12">
                <div className="mx-auto max-w-6xl">
                    <ScrollFade>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--lime)' }}>
                            Real-World Impact
                        </p>
                    </ScrollFade>
                    <ScrollFade delayMs={60}>
                        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1" style={{ fontFamily: 'Space Grotesk' }}>
                            Every scan moves the needle
                        </h2>
                    </ScrollFade>
                    <ScrollFade delayMs={110}>
                        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                            Aggregated platform-wide data — across every organisation, every scan, every item recovered.
                        </p>
                    </ScrollFade>
                </div>
            </section>
            <ImpactStrip />

            {/* ════════════════════════════ BENEFITS ═══════════════════════════ */}
            <section id="benefits" className="relative z-10 px-5 py-16 sm:px-8 lg:px-12">
                <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-12 items-center">
                    <div>
                        <ScrollFade>
                            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#a78bfa' }}>Why AI-EcoTrack</p>
                        </ScrollFade>
                        <ScrollFade delayMs={80}>
                            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6" style={{ fontFamily: 'Space Grotesk' }}>
                                Built for the realities of the shop floor
                            </h2>
                        </ScrollFade>
                        <ScrollFade delayMs={140}>
                            <p className="text-base leading-8 mb-8" style={{ color: 'var(--text-secondary)' }}>
                                Most recycling platforms assume clean environments and readable labels. AI-EcoTrack is designed for corroded, unmarked, mixed industrial scrap — where visual intelligence matters most.
                            </p>
                        </ScrollFade>
                        <div className="flex gap-4">
                            <div className="text-center">
                                <p className="text-3xl font-bold" style={{ color: 'var(--lime)', fontFamily: 'Space Grotesk' }}>0</p>
                                <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>new npm deps<br />for core features</p>
                            </div>
                            <div className="w-px" style={{ background: 'var(--border)' }} />
                            <div className="text-center">
                                <p className="text-3xl font-bold" style={{ color: '#60a5fa', fontFamily: 'Space Grotesk' }}>10</p>
                                <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>API routes with<br />rate limiting</p>
                            </div>
                            <div className="w-px" style={{ background: 'var(--border)' }} />
                            <div className="text-center">
                                <p className="text-3xl font-bold" style={{ color: '#f59e0b', fontFamily: 'Space Grotesk' }}>2</p>
                                <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>VLM providers<br />with fallback</p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        {benefits.map(b => (
                            <div key={b} className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:opacity-90"
                                style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <CheckCircle2 size={16} className="shrink-0" style={{ color: 'var(--lime)' }} />
                                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{b}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════ CTA ══════════════════════════════ */}
            <section className="relative z-10 px-5 pb-20 pt-4 sm:px-8 lg:px-12">
                <div className="mx-auto max-w-6xl">
                    <div className="relative rounded-3xl overflow-hidden px-8 py-14 text-center"
                        style={{
                            background: 'var(--bg-card)',
                            border: '1px solid rgba(132,204,22,0.15)',
                        }}>
                        {/* background glow */}
                        <div className="absolute inset-0 pointer-events-none"
                            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(132,204,22,0.08) 0%, transparent 60%)' }} />

                        <div className="relative">
                            <div className="flex items-center justify-center gap-2 mb-4">
                                <Users size={16} style={{ color: 'var(--lime)' }} />
                                <p className="text-sm font-semibold" style={{ color: 'var(--lime)' }}>
                                    For workers, org managers &amp; compliance teams
                                </p>
                            </div>
                            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4" style={{ fontFamily: 'Space Grotesk' }}>
                                Start recovering smarter today
                            </h2>
                            <p className="text-base max-w-2xl mx-auto mb-8" style={{ color: 'var(--text-secondary)' }}>
                                No setup fee. Guest access available instantly. Sign in with your org to unlock team dashboards, leaderboards, and worker badges.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <Link href="/auth"
                                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-bold transition-all hover:scale-105"
                                    style={{ background: 'linear-gradient(135deg,#84cc16,#65a30d)', color: '#0f172a', boxShadow: '0 0 32px rgba(132,204,22,0.3)' }}>
                                    Create Free Account
                                    <ArrowRight size={18} />
                                </Link>
                                <Link href="/dashboard"
                                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-semibold transition-all hover:opacity-90"
                                    style={{ background: 'var(--border)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                                    Explore Dashboard
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* footer */}
            <footer className="relative z-10 border-t px-5 py-6 sm:px-8 text-center" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    © 2024 AI-EcoTrack · Built for industrial circular economy ·{' '}
                    <a href="https://firebase.google.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Firebase</a>
                    {' · '}
                    <a href="https://vercel.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Vercel</a>
                </p>
            </footer>
        </main>
    );
}
