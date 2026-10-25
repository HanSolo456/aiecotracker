'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLenis } from '@/components/SmoothScroll';
import {
    Bot, Cpu, Leaf, CheckCircle2, XCircle, ArrowRight,
    Scale, ShieldAlert, QrCode, Truck, Sparkles, AlertCircle,
    Layers, Zap, BarChart3, Database, ChevronDown,
} from 'lucide-react';

interface ComparisonRow {
    id: string;
    category: string;
    title: string;
    icon: typeof Bot;
    genericAI: {
        summary: string;
        details: string;
        badge: string;
    };
    aiEcoTrack: {
        summary: string;
        details: string;
        badge: string;
        highlightMetric?: string;
    };
}

const COMPARISON_DATA: ComparisonRow[] = [
    {
        id: 'sensing',
        category: 'Physical Integration',
        title: 'Sensory Input & Hardware',
        icon: Layers,
        genericAI: {
            summary: 'Isolated 2D image upload in a chat tab',
            details: 'Cannot sense real physical weight, volume, or environment. Struggles with corroded, oily scrap without pristine lighting and isolated backgrounds.',
            badge: 'Virtual Chat Only',
        },
        aiEcoTrack: {
            summary: 'Multi-view vision + IoT load cells & ultrasonic depth',
            details: 'Orchestrated with factory hardware (Raspberry Pi camera rigs, continuous load-cell weight scales, bin capacity sensors) designed specifically for corroded shop-floor scrap.',
            badge: 'IoT & Edge Native',
            highlightMetric: 'Multi-angle Pi rig + live scale sync',
        },
    },
    {
        id: 'valuation',
        category: 'Financial Intelligence',
        title: 'Scrap Valuation & Pricing',
        icon: Scale,
        genericAI: {
            summary: 'Vague qualitative remarks ("Copper is valuable")',
            details: 'Cannot calculate actual salvage revenue, doesn’t know local industrial scrap yard pricing, and provides zero weight-to-rupee valuation.',
            badge: 'Zero Financial Math',
        },
        aiEcoTrack: {
            summary: 'Live ₹ INR scrap pricing by alloy grade',
            details: 'Combines computer-vision alloy identification (e.g. 316L Stainless Steel, Copper Busbar, FR-4 PCB) with physical weight to instantly compute scrap value in ₹ with Waste Recovery Index (WRI 0–1.0).',
            badge: 'Dynamic ₹ Valuation',
            highlightMetric: 'Exact ₹/kg recovery math',
        },
    },
    {
        id: 'compliance',
        category: 'Regulatory & Custody',
        title: 'Digital Product Passports (DPP)',
        icon: QrCode,
        genericAI: {
            summary: 'Disappearing chat log with zero traceability',
            details: 'Outputs unstructured text that cannot be verified by auditors, regulatory inspectors, or downstream recyclers.',
            badge: 'No Audit Trail',
        },
        aiEcoTrack: {
            summary: 'Cryptographic serialized DPP with QR code',
            details: 'Generates permanent, auditable Digital Product Passports compliant with EU ESPR 2024 mandates and India E-Waste Management Rules 2022, complete with QR tracking.',
            badge: 'EU ESPR & India E-Waste Compliant',
            highlightMetric: 'Tamper-evident DPP-XXXX records',
        },
    },
    {
        id: 'safety',
        category: 'Safety & Execution',
        title: 'Hazard Detection & Disassembly Safety',
        icon: ShieldAlert,
        genericAI: {
            summary: 'Generic disclaimer: "Wear safety gloves and glasses"',
            details: 'Cannot identify industrial danger vectors like pressurized cylinders, residual hydrocarbons, capacitors, or toxic battery chemistry from mechanical markings.',
            badge: 'Generic Disclaimers',
        },
        aiEcoTrack: {
            summary: 'Contextual hazard flags + OSHA 1910.147 LOTO guides',
            details: 'Detects 8+ specific industrial hazards (residual pressure, PCB heavy metals, flammable residuals) and auto-generates step-by-step Lockout/Tagout (LOTO) disassembly protocols with torque specs.',
            badge: 'OSHA 1910.147 Standardized',
            highlightMetric: 'Step-by-step hazardous isolation',
        },
    },
    {
        id: 'carbon',
        category: 'ESG & Carbon',
        title: 'Carbon Diverted Accounting',
        icon: BarChart3,
        genericAI: {
            summary: 'Theoretical essay on recycling benefits',
            details: 'Provides high-level explanations without defensible Scope 3 emissions avoided metrics for corporate sustainability disclosures.',
            badge: 'Qualitative Only',
        },
        aiEcoTrack: {
            summary: 'Calibrated CO₂e saved per item & aggregated ledger',
            details: 'Calculates exact kilograms of virgin mineral extraction avoided based on identified alloy and mass, rolled up into real-time organisation and platform-wide ESG impact reports.',
            badge: 'Scope 3 Avoided CO₂e',
            highlightMetric: 'Auditable kg CO₂e offsets',
        },
    },
    {
        id: 'logistics',
        category: 'Supply Chain',
        title: 'Reverse Logistics & Recycler Network',
        icon: Truck,
        genericAI: {
            summary: 'Dead-end recommendation to "find a local recycler"',
            details: 'Has no access to real-time waste transit corridors, driver tracking, or verified circular drop-off facilities.',
            badge: 'No Actionable Logistics',
        },
        aiEcoTrack: {
            summary: 'Live geospatial dispatch & licensed hub routing',
            details: 'Uses Overpass / OpenStreetMap GIS routing to map nearest certified drop-off centers within custom radius, dispatch driver pickup routes, and track chain-of-custody.',
            badge: 'End-to-End Circular Supply',
            highlightMetric: 'Turn-by-turn waste transit routing',
        },
    },
];

export default function AIComparisonSection() {
    const [activeTab, setActiveTab] = useState<'all' | 'physical' | 'financial' | 'compliance'>('all');
    const lenis = useLenis();

    const handleSelectCategory = (tabId: typeof activeTab) => {
        setActiveTab(tabId);

        // Smoothly scroll down to the comparison breakdown with navbar offset
        requestAnimationFrame(() => {
            const target = document.getElementById('comparison-breakdown');
            if (!target) return;

            if (lenis) {
                lenis.scrollTo(target, {
                    offset: -90,
                    duration: 1.1,
                });
            } else {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    };

    const filteredRows = COMPARISON_DATA.filter(row => {
        if (activeTab === 'physical') return row.id === 'sensing' || row.id === 'safety';
        if (activeTab === 'financial') return row.id === 'valuation' || row.id === 'carbon';
        if (activeTab === 'compliance') return row.id === 'compliance' || row.id === 'logistics';
        return true;
    });

    return (
        <section id="comparison" className="relative z-10 px-5 py-20 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-6xl">
                {/* ── Section Header ── */}
                <div className="text-center max-w-3xl mx-auto mb-14">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
                        style={{
                            background: 'rgba(132, 204, 22, 0.1)',
                            border: '1px solid rgba(132, 204, 22, 0.25)',
                            color: 'var(--lime)',
                        }}>
                        <Sparkles size={14} />
                        <span>Not Just Another LLM Wrapper</span>
                    </div>

                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight"
                        style={{ fontFamily: 'Space Grotesk' }}>
                        How AI-EcoTrack differs from{' '}
                        <span style={{
                            background: 'linear-gradient(90deg, #84cc16 0%, #34d399 50%, #60a5fa 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>
                            ChatGPT or Gemini
                        </span>
                    </h2>

                    <p className="mt-5 text-base sm:text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        General AI chatbots can write essays about recycling. AI-EcoTrack is an <strong>industrial execution engine</strong> that identifies alloys, enforces worker safety, computes rupee scrap valuation, and generates legally compliant digital product passports on the shop floor.
                    </p>

                    {/* Filter Pills with Scroll Trigger */}
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
                        {[
                            { id: 'all', label: 'Full Comparison' },
                            { id: 'physical', label: 'Hardware & Safety' },
                            { id: 'financial', label: 'Economics & ESG' },
                            { id: 'compliance', label: 'Compliance & DPP' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => handleSelectCategory(tab.id as typeof activeTab)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 hover:scale-105"
                                style={{
                                    background: activeTab === tab.id ? 'var(--lime)' : 'var(--bg-card)',
                                    color: activeTab === tab.id ? '#0f172a' : 'var(--text-secondary)',
                                    border: `1px solid ${activeTab === tab.id ? 'var(--lime)' : 'var(--border)'}`,
                                    boxShadow: activeTab === tab.id ? '0 0 16px rgba(132, 204, 22, 0.3)' : 'none',
                                }}
                            >
                                <span>{tab.label}</span>
                                <ChevronDown size={12} className={`transition-transform duration-200 ${activeTab === tab.id ? 'opacity-80 rotate-0' : 'opacity-40 -rotate-90'}`} />
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Side-by-Side Hero Comparison Card ── */}
                <div className="grid md:grid-cols-2 gap-4 lg:gap-6 mb-12">
                    {/* General AI Card */}
                    <div className="relative rounded-3xl p-6 sm:p-8 flex flex-col justify-between overflow-hidden"
                        style={{
                            background: 'rgba(17, 24, 39, 0.7)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            backdropFilter: 'blur(16px)',
                        }}>
                        <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-[80px] pointer-events-none"
                            style={{ background: 'radial-gradient(circle, rgba(239, 68, 68, 0.08) 0%, transparent 70%)' }} />

                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                                    <Bot size={22} className="text-red-400" />
                                </div>
                                <span className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider text-red-400"
                                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                    Generic Chatbots
                                </span>
                            </div>

                            <h3 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Space Grotesk' }}>
                                ChatGPT / Claude / Gemini
                            </h3>
                            <p className="text-xs uppercase tracking-widest text-slate-400 mb-6 font-semibold">
                                Conversational Generalist · Virtual Web Interface
                            </p>

                            <ul className="space-y-3.5">
                                {[
                                    'Pure conversational text interface without shop-floor presence',
                                    'Hallucinates metal purity without mass or density data',
                                    'Cannot read live weight from industrial scales or bin depth sensors',
                                    'Zero compliance with EU ESPR 2024 or India E-Waste Rules 2022',
                                    'No connection to scrap markets, recycler networks, or logistics',
                                ].map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-300">
                                        <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="mt-8 pt-5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                            <span>Role in Waste Management</span>
                            <span className="font-semibold text-red-400">Passive Explainer</span>
                        </div>
                    </div>

                    {/* AI-EcoTrack Card */}
                    <div className="relative rounded-3xl p-6 sm:p-8 flex flex-col justify-between overflow-hidden shadow-2xl"
                        style={{
                            background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 14, 26, 0.98) 100%)',
                            border: '1.5px solid rgba(132, 204, 22, 0.4)',
                            boxShadow: '0 0 35px rgba(132, 204, 22, 0.12)',
                        }}>
                        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[90px] pointer-events-none"
                            style={{ background: 'radial-gradient(circle, rgba(132, 204, 22, 0.18) 0%, transparent 70%)' }} />

                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                                    style={{ background: 'rgba(132, 204, 22, 0.15)', border: '1px solid rgba(132, 204, 22, 0.4)' }}>
                                    <Leaf size={22} style={{ color: 'var(--lime)' }} />
                                </div>
                                <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
                                    style={{ background: 'rgba(132, 204, 22, 0.15)', border: '1px solid var(--lime)', color: 'var(--lime)' }}>
                                    Factory-Floor OS
                                </span>
                            </div>

                            <h3 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Space Grotesk' }}>
                                AI-EcoTrack Platform
                            </h3>
                            <p className="text-xs uppercase tracking-widest font-semibold mb-6" style={{ color: 'var(--lime)' }}>
                                Circular Waste Intelligence &amp; Physical IoT Rig
                            </p>

                            <ul className="space-y-3.5">
                                {[
                                    'Multi-view camera vision pipeline tailored for corroded, unmarked parts',
                                    'Syncs with physical Raspberry Pi rigs, scale load-cells, and bin gauges',
                                    'Live ₹ scrap valuation engine + calibrated Waste Recovery Index (WRI)',
                                    'Issues verifiable Digital Product Passports (DPP) with scannable QR',
                                    'End-to-end logistics with OSHA 1910.147 LOTO guides & GIS routing',
                                ].map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-100">
                                        <CheckCircle2 size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--lime)' }} />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="mt-8 pt-5 border-t border-slate-800 flex items-center justify-between text-xs">
                            <span style={{ color: 'var(--text-dim)' }}>Role in Waste Management</span>
                            <span className="font-bold flex items-center gap-1.5" style={{ color: 'var(--lime)' }}>
                                Active Industrial Execution
                                <Zap size={14} />
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Deep Dive Comparison Rows ── */}
                <div id="comparison-breakdown" className="scroll-mt-24 pt-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 px-1">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-lime-400 animate-pulse" />
                            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                                {activeTab === 'all' && 'All Comparison Dimensions'}
                                {activeTab === 'physical' && 'Hardware & Worker Safety Dimensions'}
                                {activeTab === 'financial' && 'Economics & Carbon Accounting Dimensions'}
                                {activeTab === 'compliance' && 'Regulatory DPP & Reverse Logistics Dimensions'}
                            </h3>
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                                {filteredRows.length} {filteredRows.length === 1 ? 'topic' : 'topics'}
                            </span>
                        </div>
                        {activeTab !== 'all' && (
                            <button
                                onClick={() => handleSelectCategory('all')}
                                className="text-xs font-semibold hover:underline text-left sm:text-right"
                                style={{ color: 'var(--lime)' }}
                            >
                                ← Reset to all 6 dimensions
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                    {filteredRows.map(row => {
                        const Icon = row.icon;
                        return (
                            <div
                                key={row.id}
                                className="rounded-2xl p-5 sm:p-6 transition-all duration-300 hover:border-lime-500/40"
                                style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border)',
                                }}
                            >
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800/80">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                            style={{ background: 'rgba(132, 204, 22, 0.1)', border: '1px solid rgba(132, 204, 22, 0.25)' }}>
                                            <Icon size={17} style={{ color: 'var(--lime)' }} />
                                        </div>
                                        <div>
                                            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">{row.category}</span>
                                            <h4 className="text-base sm:text-lg font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>
                                                {row.title}
                                            </h4>
                                        </div>
                                    </div>

                                    {row.aiEcoTrack.highlightMetric && (
                                        <div className="self-start lg:self-auto px-3 py-1 rounded-full text-[11px] font-semibold"
                                            style={{
                                                background: 'rgba(52, 211, 153, 0.1)',
                                                border: '1px solid rgba(52, 211, 153, 0.25)',
                                                color: '#34d399',
                                            }}>
                                            {row.aiEcoTrack.highlightMetric}
                                        </div>
                                    )}
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    {/* Generic AI Column */}
                                    <div className="rounded-xl p-4 flex flex-col justify-between"
                                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-semibold text-slate-400">ChatGPT / General AI</span>
                                                <span className="text-[10px] font-medium text-red-400 px-2 py-0.5 rounded-md"
                                                    style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                                                    {row.genericAI.badge}
                                                </span>
                                            </div>
                                            <p className="text-xs sm:text-sm font-medium text-slate-300 mb-1.5">
                                                {row.genericAI.summary}
                                            </p>
                                            <p className="text-xs leading-relaxed text-slate-400">
                                                {row.genericAI.details}
                                            </p>
                                        </div>
                                    </div>

                                    {/* AI-EcoTrack Column */}
                                    <div className="rounded-xl p-4 flex flex-col justify-between"
                                        style={{
                                            background: 'rgba(132, 204, 22, 0.04)',
                                            border: '1px solid rgba(132, 204, 22, 0.2)',
                                        }}>
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold" style={{ color: 'var(--lime)' }}>AI-EcoTrack Platform</span>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                                                    style={{
                                                        background: 'rgba(132, 204, 22, 0.15)',
                                                        color: 'var(--lime)',
                                                        border: '1px solid rgba(132, 204, 22, 0.25)',
                                                    }}>
                                                    {row.aiEcoTrack.badge}
                                                </span>
                                            </div>
                                            <p className="text-xs sm:text-sm font-semibold text-white mb-1.5">
                                                {row.aiEcoTrack.summary}
                                            </p>
                                            <p className="text-xs leading-relaxed text-slate-300">
                                                {row.aiEcoTrack.details}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    </div>
                </div>

                {/* ── Summary Takeaway Banner ── */}
                <div className="mt-12 rounded-3xl p-6 sm:p-8 relative overflow-hidden"
                    style={{
                        background: 'linear-gradient(90deg, rgba(15, 23, 42, 0.9) 0%, rgba(132, 204, 22, 0.08) 100%)',
                        border: '1px solid rgba(132, 204, 22, 0.3)',
                    }}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="max-w-2xl">
                            <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--lime)' }}>
                                The Takeaway
                            </p>
                            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Space Grotesk' }}>
                                &ldquo;ChatGPT describes waste. AI-EcoTrack recovers it.&rdquo;
                            </h3>
                            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                We use vision language models as one cog in a larger physical machine — combined with IoT weight scales, ultrasonic sensors, local scrap pricing databases, OSHA protocols, and verifiable Digital Product Passports.
                            </p>
                        </div>
                        <Link
                            href="/scan"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-bold text-sm shrink-0 transition-all hover:scale-105"
                            style={{
                                background: 'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)',
                                color: '#0f172a',
                                boxShadow: '0 0 20px rgba(132, 204, 22, 0.3)',
                            }}
                        >
                            Try A Test Scan
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}
