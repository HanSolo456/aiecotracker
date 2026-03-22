'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/authContext';
import { Leaf, TrendingUp, DollarSign, Recycle, Cpu, BarChart3, CircleDot } from 'lucide-react';

interface ImpactSummary {
    totalScans: number; totalMassKg: number; totalCO2Kg: number;
    totalValueINR: number; segregationPct: number; avgBinFillPct: number; activeBins: number;
}
interface MaterialRow { material: string; massKg: number; count: number; co2Kg: number; valueINR: number; }
interface TrendPoint  { date: string; massKg: number; co2Kg: number; }
interface ImpactData  { summary: ImpactSummary; materialBreakdown: MaterialRow[]; trend: TrendPoint[]; }

const MAT_COLORS: Record<string, string> = {
    aluminum: '#38BDF8', copper: '#F97316', pcb: '#A78BFA',
    plastic: '#34D399', glass: '#60A5FA', paper: '#FBBF24',
    battery: '#F87171', metal: '#94A3B8', ewaste: '#E879F9', default: '#6B7280',
};
const matColor = (m: string) => MAT_COLORS[m] ?? MAT_COLORS.default;

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) return null;
    const R = 54, CX = 70, CY = 70, STROKE = 18, circ = 2 * Math.PI * R;
    let cum = 0;
    const segs = data.map(d => {
        const pct = d.value / total;
        const dash = pct * circ;
        const offset = circ - cum * circ;
        cum += pct;
        return { ...d, dash, offset };
    });
    return (
        <svg viewBox="0 0 140 140" className="w-32 h-32">
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
            {segs.map((s, i) => (
                <circle key={i} cx={CX} cy={CY} r={R} fill="none" stroke={s.color}
                    strokeWidth={STROKE} strokeDasharray={`${s.dash} ${circ - s.dash}`}
                    strokeDashoffset={s.offset} transform={`rotate(-90 ${CX} ${CY})`} />
            ))}
            <text x={CX} y={CY - 6} textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">{total.toFixed(0)}</text>
            <text x={CX} y={CY + 12} textAnchor="middle" fill="var(--text-secondary)" fontSize="9">kg total</text>
        </svg>
    );
}

function Sparkline({ points, color }: { points: TrendPoint[]; color: 'co2' | 'mass' }) {
    const vals = points.map(p => color === 'co2' ? p.co2Kg : p.massKg);
    const max  = Math.max(...vals, 0.01);
    return (
        <div className="flex items-end gap-0.5 h-16 w-full">
            {vals.map((v, i) => (
                <div key={i} className="flex-1 rounded-t-sm min-h-[2px] transition-all duration-500"
                    style={{ height: `${Math.max(4, (v / max) * 100)}%`, background: color === 'co2' ? '#4ADE80' : '#38BDF8', opacity: 0.7 + 0.3 * (i / vals.length) }} />
            ))}
        </div>
    );
}

export default function ImpactPanel() {
    const { user } = useAuth();
    const [data, setData]       = useState<ImpactData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState('');

    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const token = await user.getIdToken();
                const res   = await fetch('/api/org/impact', { headers: { Authorization: `Bearer ${token}` } });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                setData(await res.json() as ImpactData);
            } catch (e) { setError(String(e)); }
            finally { setLoading(false); }
        })();
    }, [user]);

    const donutData = useMemo(() =>
        (data?.materialBreakdown ?? []).slice(0, 6).map(m => ({ label: m.material, value: m.massKg, color: matColor(m.material) })),
    [data]);
    const trend14 = useMemo(() => (data?.trend ?? []).slice(-14), [data]);

    if (loading) return (
        <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: '#84cc16' }} />
        </div>
    );

    const s = data?.summary;
    const stats = s ? [
        { icon: <Recycle size={15} />,    label: 'Waste Diverted',   value: `${s.totalMassKg} kg`,                               sub: 'from landfill',   color: '#4ADE80' },
        { icon: <Leaf size={15} />,       label: 'CO₂ Avoided',      value: `${s.totalCO2Kg} kg`,                                sub: 'lifetime',        color: '#34D399' },
        { icon: <DollarSign size={15} />, label: 'Recovery Value',   value: `₹${s.totalValueINR.toLocaleString('en-IN')}`,       sub: 'estimated',       color: '#FCD34D' },
        { icon: <TrendingUp size={15} />, label: 'Segregation Rate', value: `${s.segregationPct}%`,                              sub: 'Grade A scans',   color: s.segregationPct >= 70 ? '#4ADE80' : '#FB923C' },
        { icon: <BarChart3 size={15} />,  label: 'Total Scans',      value: String(s.totalScans),                                sub: 'items processed', color: '#84cc16' },
        { icon: <Cpu size={15} />,        label: 'Active Bins',      value: String(s.activeBins),                                sub: `avg ${s.avgBinFillPct}% fill`, color: '#38BDF8' },
    ] : [];

    return (
        <div className="flex flex-col gap-5">
            {error && <div className="card p-3 text-sm" style={{ color: '#fca5a5', borderColor: 'rgba(239,68,68,0.35)' }}>{error}</div>}

            {/* KPI grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {stats.map(({ icon, label, value, sub, color }) => (
                    <div key={label} className="card p-4 flex flex-col gap-2">
                        <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                                <span style={{ color }}>{icon}</span>
                            </div>
                            <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>{label}</span>
                        </div>
                        <p className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>{value}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{sub}</p>
                    </div>
                ))}
            </div>

            {/* Materials donut */}
            {donutData.length > 0 && (
                <div className="card p-5">
                    <p className="text-sm font-bold text-white mb-4" style={{ fontFamily: 'Space Grotesk' }}>Materials Recovered</p>
                    <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                        <div className="shrink-0 mx-auto sm:mx-0"><DonutChart data={donutData} /></div>
                        <div className="flex flex-col gap-2 flex-1 w-full">
                            {data?.materialBreakdown.slice(0, 7).map(m => {
                                const pct = Math.round((m.massKg / (data.summary.totalMassKg || 1)) * 100);
                                return (
                                    <div key={m.material} className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: matColor(m.material) }} />
                                        <span className="text-xs capitalize text-white w-16 shrink-0">{m.material}</span>
                                        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: matColor(m.material) }} />
                                        </div>
                                        <span className="text-[10px] w-12 text-right shrink-0" style={{ color: 'var(--text-secondary)' }}>{m.massKg} kg</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Sparklines */}
            {trend14.length > 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[{ title: 'CO₂ Avoided — Last 14 Days', color: 'co2' as const }, { title: 'Waste Diverted — Last 14 Days', color: 'mass' as const }].map(({ title, color }) => (
                        <div key={color} className="card p-4">
                            <p className="text-xs font-semibold text-white mb-3">{title}</p>
                            <Sparkline points={trend14} color={color} />
                            <div className="flex justify-between text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                <span>{trend14[0]?.date?.slice(5)}</span>
                                <span>{trend14[trend14.length - 1]?.date?.slice(5)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Segregation efficiency gauge */}
            {s && (
                <div className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>Org Segregation Efficiency</p>
                        <span className="text-xs font-bold px-3 py-1 rounded-full" style={{
                            background: s.segregationPct >= 85 ? 'rgba(250,204,21,0.15)' : s.segregationPct >= 70 ? 'rgba(74,222,128,0.12)' : 'rgba(251,146,60,0.12)',
                            color: s.segregationPct >= 85 ? '#FCD34D' : s.segregationPct >= 70 ? '#4ADE80' : '#FB923C',
                        }}>
                            {s.segregationPct >= 85 ? '🏆 Elite' : s.segregationPct >= 70 ? '✅ Good' : s.segregationPct >= 50 ? '⚠️ Needs Work' : '🔴 Critical'}
                        </span>
                    </div>
                    <div className="h-4 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full transition-all duration-700" style={{
                            width: `${s.segregationPct}%`,
                            background: s.segregationPct >= 85 ? 'linear-gradient(90deg,#FCD34D,#F59E0B)' : s.segregationPct >= 70 ? 'linear-gradient(90deg,#4ADE80,#22C55E)' : 'linear-gradient(90deg,#FB923C,#EF4444)',
                        }} />
                    </div>
                    <div className="flex justify-between mt-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        <span>0%</span>
                        <span className="font-bold" style={{ color: 'var(--text-secondary)' }}>{s.segregationPct}% Grade A</span>
                        <span>100%</span>
                    </div>
                </div>
            )}

            {!data && !loading && !error && (
                <div className="card p-10 flex flex-col items-center gap-3 text-center">
                    <CircleDot size={32} style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm font-semibold text-white">No data yet</p>
                    <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Start scanning items to see your circular economy impact.</p>
                </div>
            )}
        </div>
    );
}
