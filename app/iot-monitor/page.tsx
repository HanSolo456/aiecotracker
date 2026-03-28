'use client';

import { useEffect, useState } from 'react';
import { Wifi, Wind, Thermometer, Droplets, Package, AlertTriangle, CheckCircle, Activity, Cpu, ChevronLeft, MapPin, Route } from 'lucide-react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/lib/authContext';
import type { HackathonWasteCategory } from '@/types';

interface SensorReading {
    id: string;
    deviceId: string;
    wasteCategory?: HackathonWasteCategory;
    fillLevel: number;
    gasPpm: number;
    coPpm: number;
    temperature: number;
    humidity: number;
    itemDropped: boolean;
    gasAlert: boolean;
    alertLevel: 'normal' | 'warning' | 'danger';
    createdAt: string;
}

interface BinLocation {
    deviceId: string;
    displayName: string;
    latitude: number | null;
    longitude: number | null;
    fillPct: number;
    lastSeen: string;
    needsCollection: boolean;
    wasteCategory: HackathonWasteCategory;
}

let iotCache: {
    rawReadings: SensorReading[];
    connected: boolean;
} | null = null;

function relativeTime(ts: string) {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60)   return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
}

function wasteCategoryColor(category?: HackathonWasteCategory) {
    switch (category) {
        case 'biodegradable':
            return '#22c55e';
        case 'hazardous':
            return '#ef4444';
        case 'recyclable':
        default:
            return '#3b82f6';
    }
}

function wasteCategoryLabel(category?: HackathonWasteCategory) {
    switch (category) {
        case 'biodegradable':
            return 'Biodegradable';
        case 'hazardous':
            return 'Hazardous';
        case 'recyclable':
        default:
            return 'Recyclable';
    }
}

function fillPalette(fillPct: number) {
    if (fillPct >= 80) return '#EF4444';
    if (fillPct >= 60) return '#F59E0B';
    if (fillPct >= 40) return '#FACC15';
    return '#22C55E';
}

function BinGeoMap({ bins }: { bins: BinLocation[] }) {
    const located = bins.filter(
        (bin) => typeof bin.latitude === 'number' && typeof bin.longitude === 'number',
    );

    if (located.length === 0) {
        return (
            <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <p className="text-sm font-semibold text-white">No GPS-tagged bins yet</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Set bin coordinates in Collection Routes to visualize the network here.
                </p>
            </div>
        );
    }

    const W = 360;
    const H = 220;
    const PAD = 28;
    const latitudes = located.map((bin) => bin.latitude as number);
    const longitudes = located.map((bin) => bin.longitude as number);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);
    const latRange = maxLat - minLat || 0.01;
    const lonRange = maxLon - minLon || 0.01;

    function toSvg(lat: number, lon: number): [number, number] {
        const x = PAD + ((lon - minLon) / lonRange) * (W - PAD * 2);
        const y = H - PAD - ((lat - minLat) / latRange) * (H - PAD * 2);
        return [x, y];
    }

    const collectionPins = located.filter((bin) => bin.needsCollection);

    return (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#07111f', border: '1px solid var(--border)' }}>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
                {[0.25, 0.5, 0.75].map((t) => (
                    <g key={t}>
                        <line x1={PAD + t * (W - PAD * 2)} y1={PAD} x2={PAD + t * (W - PAD * 2)} y2={H - PAD}
                            stroke="#142132" strokeWidth="1" />
                        <line x1={PAD} y1={PAD + t * (H - PAD * 2)} x2={W - PAD} y2={PAD + t * (H - PAD * 2)}
                            stroke="#142132" strokeWidth="1" />
                    </g>
                ))}

                {collectionPins.length > 1 && (
                    <polyline
                        points={collectionPins.map((bin) => {
                            const [x, y] = toSvg(bin.latitude as number, bin.longitude as number);
                            return `${x},${y}`;
                        }).join(' ')}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="3"
                        strokeDasharray="6 6"
                        opacity="0.9"
                    />
                )}

                {located.map((bin, index) => {
                    const [x, y] = toSvg(bin.latitude as number, bin.longitude as number);
                    const fillColor = fillPalette(bin.fillPct);
                    const ringColor = wasteCategoryColor(bin.wasteCategory);
                    return (
                        <g key={bin.deviceId}>
                            <circle cx={x} cy={y} r="12" fill="#020617" stroke={ringColor} strokeWidth="2.5" />
                            <circle cx={x} cy={y} r="6" fill={fillColor} />
                            <text x={x} y={y - 18} textAnchor="middle" fill="#cbd5e1"
                                style={{ fontSize: '8px', fontWeight: 700 }}>
                                {index + 1}
                            </text>
                        </g>
                    );
                })}
            </svg>
            <div className="px-4 py-3 border-t flex flex-wrap gap-3 text-[11px]" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#22c55e' }} />Low fill</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b' }} />Medium fill</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ef4444' }} />Needs collection</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#3b82f6' }} />Recyclable stream</span>
            </div>
        </div>
    );
}

function GasWaveform({ ppm, status }: { ppm: number; status: string }) {
    const color = status === 'danger' ? '#EF4444' : status === 'warning' ? '#F59E0B' : '#84cc16';
    return (
        <div className="flex items-end gap-0.5 h-8">
            {Array.from({ length: 8 }).map((_, i) => (
                <div
                    key={i}
                    className="wave-bar"
                    style={{ height: '100%', background: color, opacity: 0.7 }}
                />
            ))}
        </div>
    );
}

// ── Sparkline Chart ────────────────────────────────────────────────────────
function Sparkline({
    data, color, label, unit, warningThreshold, dangerThreshold,
}: {
    data: number[];
    color: string;
    label: string;
    unit: string;
    warningThreshold?: number;
    dangerThreshold?: number;
}) {
    const W = 280, H = 72, PAD = 8;
    if (data.length < 2) return (
        <div className="flex items-center justify-center h-[88px]" style={{ color: 'var(--text-muted)' }}>
            <span className="text-xs">Collecting data…</span>
        </div>
    );

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) => {
        const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
        const y = PAD + (1 - (v - min) / range) * (H - PAD * 2);
        return [x, y];
    });

    const latestVal = data[data.length - 1];
    const gradientId = `grad-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const lineColor = dangerThreshold && latestVal >= dangerThreshold ? '#EF4444'
        : warningThreshold && latestVal >= warningThreshold ? '#F59E0B'
        : color;

    const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const fillD = `${d} L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`;
    const lastPt = pts[pts.length - 1];

    return (
        <div className="card p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span className="font-heading text-sm font-700" style={{ color: lineColor }}>
                    {latestVal.toFixed(1)}{unit}
                </span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: 'visible' }}>
                {/* Fill gradient */}
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={lineColor} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <path d={fillD} fill={`url(#${gradientId})`} />
                <path d={d} fill="none" stroke={lineColor} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                {/* Latest dot */}
                <circle cx={lastPt[0]} cy={lastPt[1]} r={3} fill={lineColor} />
            </svg>
            <div className="flex justify-between mt-1">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>min {min.toFixed(1)}{unit}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>max {max.toFixed(1)}{unit}</span>
            </div>
        </div>
    );
}

function BinTank({ fill, color }: { fill: number; color: string }) {
    return (
        <div className="flex flex-col items-center gap-2">
            {/* Tank body */}
            <div className="relative" style={{ width: 64, height: 120 }}>
                {/* Outer shell */}
                <div
                    className="absolute inset-0 rounded-2xl"
                    style={{ background: 'var(--bg-elevated)', border: '2px solid var(--border)' }}
                />
                {/* Liquid fill */}
                <div
                    className="absolute bottom-0 left-0 right-0 rounded-b-2xl transition-all duration-1000"
                    style={{ height: `${fill}%`, background: color, opacity: 0.85 }}
                />
                {/* Shine overlay */}
                <div
                    className="absolute top-0 left-0 bottom-0 rounded-2xl pointer-events-none"
                    style={{ width: '30%', background: 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent)' }}
                />
                {/* Percentage label */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-heading text-sm font-700 text-white">{fill}%</span>
                </div>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Bin Fill</p>
        </div>
    );
}

export default function IoTMonitorPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [rawReadings,      setRawReadings]      = useState<SensorReading[]>(() => iotCache?.rawReadings ?? []);
    const [connected,        setConnected]        = useState(() => iotCache?.connected ?? false);
    const [loading,          setLoading]          = useState(() => (iotCache?.rawReadings.length ?? 0) === 0);
    const [bins,             setBins]             = useState<BinLocation[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

    // Redirect anonymous users
    useEffect(() => {
        if (!authLoading && user?.isAnonymous) router.replace('/dashboard');
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!user || user.isAnonymous) return;
        const currentUser = user;
        let cancelled = false;

        async function fetchReadings() {
            try {
                const idToken = await currentUser.getIdToken();
                const res = await fetch('/api/sensor-readings', {
                    headers: { Authorization: `Bearer ${idToken}` },
                });
                if (!res.ok) return;
                const { readings } = await res.json() as { readings: SensorReading[] };
                if (cancelled) return;
                setRawReadings(readings);
                setConnected(readings.length > 0);
                iotCache = { rawReadings: readings, connected: readings.length > 0 };
                setLoading(false);
            } catch { if (!cancelled) setLoading(false); }
        }

        fetchReadings();
        const interval = setInterval(fetchReadings, 5000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [user]);

    useEffect(() => {
        if (!user || user.isAnonymous) return;
        const currentUser = user;
        let cancelled = false;

        async function fetchBins() {
            try {
                const idToken = await currentUser.getIdToken();
                const res = await fetch('/api/org/devices/locations', {
                    headers: {
                        Authorization: `Bearer ${idToken}`,
                    },
                });
                if (!res.ok) return;
                const data = await res.json() as { bins?: BinLocation[] };
                if (!cancelled) {
                    setBins(data.bins ?? []);
                }
            } catch {
                if (!cancelled) setBins([]);
            }
        }

        fetchBins();
        const interval = setInterval(fetchBins, 15000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [user]);

    // ── Per-device derivation ─────────────────────────────────────────────────
    const deviceIds = [...new Set(rawReadings.map(r => r.deviceId))];

    // Auto-select first device; keep current selection if it's still present
    useEffect(() => {
        setSelectedDeviceId(prev => {
            if (deviceIds.length === 0) return null;
            if (prev && deviceIds.includes(prev)) return prev;
            return deviceIds[0];
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deviceIds.join(',')]);

    const deviceReadings = selectedDeviceId
        ? rawReadings.filter(r => r.deviceId === selectedDeviceId)
        : rawReadings;

    const latest  = deviceReadings[0] ?? null;
    const history = deviceReadings.slice(1, 20);

    // Map deviceId → display name using the bin locations list
    const binDisplayName = (id: string) =>
        bins.find(b => b.deviceId === id)?.displayName ?? id;

    const fillColor = !latest ? '#84cc16'
        : latest.fillLevel > 80 ? '#EF4444'
        : latest.fillLevel > 50 ? '#F59E0B'
        : '#84cc16';

    // Device considered offline if last reading is older than 5 minutes
    const isStale = !!latest && (Date.now() - new Date(latest.createdAt).getTime()) > 5 * 60 * 1000;
    const isLive  = connected && !isStale;

    const gasStatus = !latest ? 'normal'
        : latest.gasPpm > 400 ? 'danger'
        : latest.gasPpm > 250 ? 'warning'
        : 'normal';

    const gasColor = gasStatus === 'danger' ? '#EF4444' : gasStatus === 'warning' ? '#F59E0B' : '#84cc16';

    return (
        <div className="flex flex-col min-h-screen pb-28 lg:pb-0">

            {/* ── Header ────────────────────────────────────────── */}
            <div className="safe-top px-5 pt-6 pb-5 lg:px-10 lg:pt-10 lg:pb-8 bg-grid">
                <div className="flex items-center justify-between mb-4">
                    <button
                        onClick={() => router.back()}
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                    >
                        <ChevronLeft size={16} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ml-auto ${
                        isLive ? 'bg-[rgba(132,204,22,0.1)] border-[rgba(132,204,22,0.2)]'
                        : isStale ? 'bg-[rgba(239,68,68,0.06)] border-[rgba(239,68,68,0.2)]'
                        : 'border-[var(--border)]'
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                            isLive ? 'bg-[#84cc16] animate-pulse'
                            : isStale ? 'bg-red-400'
                            : 'bg-[var(--text-muted)]'
                        }`} />
                        <span className="text-xs font-medium" style={{ color: isLive ? '#84cc16' : isStale ? '#F87171' : 'var(--text-secondary)' }}>
                            {isLive ? 'Live' : isStale ? 'Offline' : 'No Signal'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
                        <Cpu size={17} style={{ color: '#60A5FA' }} />
                    </div>
                    <h1 className="page-title text-3xl lg:text-4xl text-white">IoT Monitor</h1>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Live smart bin sensor readings — updates every 5 seconds</p>
            </div>

            {/* ── Device Selector — shown only when 2+ bins are reporting ── */}
            {deviceIds.length > 1 && (
                <div className="mx-5 lg:mx-10 mt-3 mb-1 rounded-2xl p-3"
                    style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.25)' }}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA] animate-pulse" />
                            <span className="text-xs font-semibold" style={{ color: '#60A5FA' }}>
                                {deviceIds.length} Bins Connected — Select a bin to view its live data
                            </span>
                        </div>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Map shows all</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {deviceIds.map(id => (
                            <button
                                key={id}
                                onClick={() => setSelectedDeviceId(id)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
                                style={selectedDeviceId === id
                                    ? { background: 'rgba(96,165,250,0.2)', border: '1px solid rgba(96,165,250,0.5)', color: '#93C5FD' }
                                    : { background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }
                                }
                            >
                                <Cpu size={12} />
                                {binDisplayName(id)}
                                {selectedDeviceId === id && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA] ml-0.5" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Content ───────────────────────────────────────── */}
            {loading ? (
                <div className="px-5 lg:px-10 flex flex-col gap-3 mt-2">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className="card h-20 animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
                    ))}
                </div>
            ) : !latest ? (
                <div className="px-5 lg:px-10 flex flex-col items-center justify-center gap-4 pt-24 text-center">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                        <Wifi size={28} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <p className="font-heading text-xl text-white">No Device Connected</p>
                    <p className="text-sm max-w-xs" style={{ color: 'var(--text-secondary)' }}>
                        Power on the ESP-32 sensor node to see live readings here
                    </p>
                </div>
            ) : (
                <div className="px-5 lg:px-10 mt-4">

                    {/* Gas Alert Banner */}
                    {latest.gasAlert && (
                        <div className="mb-4 p-4 rounded-xl flex items-center gap-3 animate-fade-in"
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)' }}>
                            <AlertTriangle size={18} className="text-red-400 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-red-400">Gas Alert Active</p>
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Toxic gas levels above safe threshold — ventilate area</p>
                            </div>
                        </div>
                    )}

                    {/* Desktop: side-by-side hero; Mobile: stacked */}
                    <div className="lg:grid lg:grid-cols-[auto_1fr] lg:gap-6 mb-5">

                        {/* Bin Tank Visual */}
                        <div className="hidden lg:flex items-start justify-center">
                            <BinTank fill={latest.fillLevel} color={fillColor} />
                        </div>

                        {/* Sensor Cards Grid */}
                        <div>
                            {/* Mobile fill bar */}
                            <div className="lg:hidden card p-4 mb-3">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Package size={15} style={{ color: fillColor }} />
                                        <span className="text-sm font-semibold text-white">Bin Fill Level</span>
                                    </div>
                                    <span className="font-heading text-2xl font-700" style={{ color: fillColor }}>
                                        {latest.fillLevel}%
                                    </span>
                                </div>
                                <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${latest.fillLevel}%`, background: fillColor }}
                                    />
                                </div>
                                <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                                    {latest.fillLevel > 80 ? '⚠️ Bin almost full — needs collection'
                                        : latest.fillLevel > 50 ? 'Bin at moderate capacity'
                                        : 'Bin has ample space'}
                                </p>
                            </div>

                            {/* 2-col / 4-col sensor grid */}
                            <div className="grid grid-cols-2 gap-3">

                                {/* Air Quality */}
                                <div className="stat-card p-4"
                                    style={{ borderColor: gasStatus !== 'normal' ? (gasStatus === 'danger' ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.3)') : undefined }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Wind size={14} style={{ color: gasColor }} />
                                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Air Quality</span>
                                        </div>
                                        <GasWaveform ppm={latest.gasPpm} status={gasStatus} />
                                    </div>
                                    <p className="font-heading text-3xl font-700" style={{ color: gasColor }}>
                                        {latest.gasPpm}
                                    </p>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>PPM · MQ-135</p>
                                    <div className="mt-2 inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                                        style={{
                                            background: `${gasColor}18`,
                                            border: `1px solid ${gasColor}40`,
                                            color: gasColor,
                                        }}>
                                        {gasStatus === 'danger' ? 'DANGER' : gasStatus === 'warning' ? 'Elevated' : 'Normal'}
                                    </div>
                                </div>

                                {/* Temperature */}
                                <div className="stat-card stat-card-amber p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Thermometer size={14} style={{ color: '#F59E0B' }} />
                                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Temperature</span>
                                    </div>
                                    <p className="font-heading text-3xl font-700 text-white">
                                        {latest.temperature.toFixed(1)}°
                                    </p>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Celsius · DHT-11</p>
                                </div>

                                {/* Humidity */}
                                <div className="stat-card stat-card-blue p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Droplets size={14} style={{ color: '#60A5FA' }} />
                                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Humidity</span>
                                    </div>
                                    <p className="font-heading text-3xl font-700 text-white">
                                        {latest.humidity.toFixed(1)}%
                                    </p>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Relative · DHT-11</p>
                                </div>

                                {/* IR Sensor */}
                                <div className="stat-card p-4"
                                    style={{ borderColor: latest.itemDropped ? 'rgba(132,204,22,0.3)' : undefined }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Activity size={14} style={{ color: latest.itemDropped ? '#84cc16' : '#60A5FA' }} />
                                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>IR Sensor</span>
                                    </div>
                                    <p className="font-heading text-3xl font-700"
                                        style={{ color: latest.itemDropped ? '#84cc16' : 'var(--text-primary)' }}>
                                        {latest.itemDropped ? 'ON' : 'OFF'}
                                    </p>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Item Detection</p>
                                    <div className="mt-2 inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                                        style={{
                                            background: latest.itemDropped ? 'rgba(132,204,22,0.1)' : 'var(--bg-elevated)',
                                            border: `1px solid ${latest.itemDropped ? 'rgba(132,204,22,0.3)' : 'var(--border)'}`,
                                            color: latest.itemDropped ? '#84cc16' : '#60A5FA',
                                        }}>
                                        {latest.itemDropped ? 'Detected' : 'Clear'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Item Deposit Status */}
                    <div className="mb-4 card flex items-center gap-3 p-4"
                        style={{ borderColor: latest.itemDropped ? 'rgba(132,204,22,0.3)' : undefined }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                                background: latest.itemDropped ? 'rgba(132,204,22,0.1)' : 'var(--bg-elevated)',
                                border: `1px solid ${latest.itemDropped ? 'rgba(132,204,22,0.3)' : 'var(--border)'}`,
                            }}>
                            {latest.itemDropped
                                ? <CheckCircle size={18} style={{ color: '#84cc16' }} />
                                : <Package size={18} style={{ color: 'var(--text-muted)' }} />
                            }
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold" style={{ color: latest.itemDropped ? '#84cc16' : 'var(--text-secondary)' }}>
                                {latest.itemDropped ? 'Item Deposited!' : 'Awaiting Deposit'}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {latest.itemDropped ? 'E-waste detected — scan initiated' : 'No item detected in bin'}
                            </p>
                        </div>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{relativeTime(latest.createdAt)}</span>
                    </div>

                    {/* Device Info */}
                    <div className="mb-4 card p-3 flex items-center gap-3">
                        <Wifi size={14} style={{ color: '#60A5FA' }} className="shrink-0" />
                        <div className="flex-1">
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                Device: <span className="text-white font-medium">{latest.deviceId}</span>
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                Stream: <span style={{ color: wasteCategoryColor(latest.wasteCategory) }}>{wasteCategoryLabel(latest.wasteCategory)}</span>
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Last update: {relativeTime(latest.createdAt)}</p>
                        </div>
                        <div className="status-online">
                            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-[#84cc16] animate-pulse' : 'bg-red-400'}`} />
                            <span className="text-xs" style={{ color: isLive ? '#84cc16' : '#F87171' }}>
                                {isLive ? 'Live' : 'Offline'}
                            </span>
                        </div>
                    </div>

                    <div className="mb-5 card p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <MapPin size={15} style={{ color: '#38BDF8' }} />
                                    <p className="text-sm font-semibold text-white">Bin Map & Collection Readiness</p>
                                </div>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                                    {bins.filter((bin) => bin.needsCollection).length} bins ready for pickup across {bins.length} monitored bins
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/org/routes')}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
                                style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.25)', color: '#38BDF8' }}
                            >
                                <Route size={13} />
                                Plan Route
                            </button>
                        </div>
                        <BinGeoMap bins={bins} />
                        {bins.length > 0 && (
                            <div className="mt-3 flex flex-col gap-2">
                                {bins.slice(0, 4).map((bin) => (
                                    <div key={bin.deviceId} className="rounded-xl px-3 py-2 flex items-center justify-between gap-3"
                                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-white truncate">{bin.displayName}</p>
                                            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                                <span style={{ color: wasteCategoryColor(bin.wasteCategory) }}>{wasteCategoryLabel(bin.wasteCategory)}</span> · {relativeTime(bin.lastSeen)}
                                            </p>
                                        </div>
                                        <span className="text-xs font-bold px-2 py-1 rounded-full"
                                            style={{ background: `${fillPalette(bin.fillPct)}18`, color: fillPalette(bin.fillPct) }}>
                                            {bin.fillPct}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Analytics Trend Charts */}
                    {history.length >= 2 && (
                        <div className="mb-6">
                            <h2 className="font-heading text-base font-700 text-white mb-3">Sensor Trends</h2>
                            <Sparkline
                                data={[...history].reverse().map(r => r.gasPpm).concat(latest.gasPpm)}
                                color="#84cc16" label="Gas PPM (MQ-135)" unit=" ppm"
                                warningThreshold={250} dangerThreshold={400}
                            />
                            <Sparkline
                                data={[...history].reverse().map(r => r.temperature).concat(latest.temperature)}
                                color="#F59E0B" label="Temperature (DHT-11)" unit="°C"
                                warningThreshold={35} dangerThreshold={45}
                            />
                            <Sparkline
                                data={[...history].reverse().map(r => r.humidity).concat(latest.humidity)}
                                color="#60A5FA" label="Humidity (DHT-11)" unit="%"
                            />
                        </div>
                    )}

                    {/* Recent History Timeline */}
                    {history.length > 0 && (
                        <div className="mb-6">
                            <h2 className="font-heading text-base font-700 text-white mb-3">Reading History</h2>
                            <div className="relative flex flex-col gap-0">
                                {/* Timeline line */}
                                <div className="absolute left-[11px] top-3 bottom-3 w-px" style={{ background: 'var(--border)' }} />
                                {history.slice(0, 6).map((r, idx) => (
                                    <div key={r.id} className="flex items-start gap-4 pl-1 pb-3 last:pb-0">
                                        <div className={`w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 z-10 ${
                                            r.alertLevel === 'danger' ? 'bg-red-500' :
                                            r.alertLevel === 'warning' ? 'bg-amber-400' : 'bg-[#84cc16]'
                                        }`} />
                                        <div className="flex-1 card p-3">
                                            <div className="flex items-center gap-4 flex-wrap">
                                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                    Fill: <span className="text-white font-medium">{r.fillLevel}%</span>
                                                </span>
                                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                    Stream: <span style={{ color: wasteCategoryColor(r.wasteCategory) }}>{wasteCategoryLabel(r.wasteCategory)}</span>
                                                </span>
                                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                    Gas: <span className="text-white font-medium">{r.gasPpm} PPM</span>
                                                </span>
                                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                    Temp: <span className="text-white font-medium">{r.temperature.toFixed(0)}°C</span>
                                                </span>
                                                <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                                                    {relativeTime(r.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <BottomNav />
        </div>
    );
}
