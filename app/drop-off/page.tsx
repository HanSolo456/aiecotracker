'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    MapPin, Navigation, Loader2, ChevronLeft,
    ExternalLink, AlertTriangle, RefreshCw, Recycle,
} from 'lucide-react';
import BottomNav from '@/components/BottomNav';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DropOffPoint {
    id: number;
    name: string;
    lat: number;
    lon: number;
    distKm: number;
    tags: Record<string, string>;
}

type GeoState = 'idle' | 'locating' | 'loading' | 'ready' | 'error';

// ── Static fallback — CPCB-registered e-waste recyclers ───────────────────────

const STATIC_FALLBACK: Omit<DropOffPoint, 'distKm'>[] = [
    { id: -1, name: 'Attero Recycling Pvt. Ltd.', lat: 28.5355, lon: 77.3910, tags: { city: 'Noida, UP' } },
    { id: -2, name: 'E-Parisaraa Pvt. Ltd.', lat: 12.9716, lon: 77.5946, tags: { city: 'Bengaluru, KA' } },
    { id: -3, name: 'Eco Recycling Ltd. (Ecoreco)', lat: 19.0760, lon: 72.8777, tags: { city: 'Mumbai, MH' } },
    { id: -4, name: 'Trishyiraya Recycling India', lat: 12.8408, lon: 80.1534, tags: { city: 'Chennai, TN' } },
    { id: -5, name: 'Digital Impact Square (HDFC)', lat: 21.1458, lon: 79.0882, tags: { city: 'Nagpur, MH' } },
    { id: -6, name: 'Cerebra Integrated Technologies', lat: 12.9352, lon: 77.6245, tags: { city: 'Bengaluru, KA' } },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapsUrl(lat: number, lon: number, name: string): string {
    return `https://maps.google.com/maps?q=${encodeURIComponent(name)}&ll=${lat},${lon}&z=16`;
}

// ── SVG Minimap ───────────────────────────────────────────────────────────────

function Minimap({
    userLat, userLon, points,
}: { userLat: number; userLon: number; points: DropOffPoint[] }) {
    const W = 340, H = 200;
    const PAD = 28;

    // Bounding box including user position
    const allLats = [userLat, ...points.map(p => p.lat)];
    const allLons = [userLon, ...points.map(p => p.lon)];
    const minLat = Math.min(...allLats), maxLat = Math.max(...allLats);
    const minLon = Math.min(...allLons), maxLon = Math.max(...allLons);
    const latRange = maxLat - minLat || 0.01;
    const lonRange = maxLon - minLon || 0.01;

    function toSvg(lat: number, lon: number): [number, number] {
        const x = PAD + ((lon - minLon) / lonRange) * (W - PAD * 2);
        // lat increases upward on map, SVG y downward — flip
        const y = H - PAD - ((lat - minLat) / latRange) * (H - PAD * 2);
        return [x, y];
    }

    const [ux, uy] = toSvg(userLat, userLon);

    return (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#111827', border: '1px solid var(--border)' }}>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
                {/* grid lines */}
                {[0.25, 0.5, 0.75].map(t => (
                    <g key={t}>
                        <line x1={PAD + t * (W - PAD * 2)} y1={PAD} x2={PAD + t * (W - PAD * 2)} y2={H - PAD}
                            stroke="#1f2937" strokeWidth="1" />
                        <line x1={PAD} y1={PAD + t * (H - PAD * 2)} x2={W - PAD} y2={PAD + t * (H - PAD * 2)}
                            stroke="#1f2937" strokeWidth="1" />
                    </g>
                ))}

                {/* lines from user to each point */}
                {points.map(p => {
                    const [px, py] = toSvg(p.lat, p.lon);
                    return (
                        <line key={p.id} x1={ux} y1={uy} x2={px} y2={py}
                            stroke="#374151" strokeWidth="1" strokeDasharray="3 3" />
                    );
                })}

                {/* drop-off pins */}
                {points.map((p, i) => {
                    const [px, py] = toSvg(p.lat, p.lon);
                    return (
                        <g key={p.id}>
                            <circle cx={px} cy={py} r="7" fill="#1d4ed8" stroke="#60a5fa" strokeWidth="1.5" />
                            <text x={px} y={py + 4} textAnchor="middle" fill="white"
                                style={{ fontSize: '8px', fontWeight: 700 }}>{i + 1}</text>
                        </g>
                    );
                })}

                {/* user dot */}
                <circle cx={ux} cy={uy} r="10" fill="#84cc1630" />
                <circle cx={ux} cy={uy} r="5" fill="#84cc16" stroke="white" strokeWidth="1.5" />
                <text x={ux} y={uy - 13} textAnchor="middle" fill="#84cc16"
                    style={{ fontSize: '8px', fontWeight: 700 }}>YOU</text>
            </svg>
            <div className="flex items-center gap-3 px-4 py-2 border-t"
                style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>You</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>Drop-off point</span>
                </div>
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DropOffPage() {
    const router = useRouter();
    const [geoState, setGeoState] = useState<GeoState>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [userLat, setUserLat] = useState<number | null>(null);
    const [userLon, setUserLon] = useState<number | null>(null);
    const [points, setPoints] = useState<DropOffPoint[]>([]);
    const [usedFallback, setUsedFallback] = useState(false);

    async function fetchNearby(lat: number, lon: number) {
        setGeoState('loading');

        // Three public Overpass mirrors — try fastest first
        const MIRRORS = [
            'https://overpass.kumi.systems/api/interpreter',
            'https://overpass.openstreetmap.ru/api/interpreter',
            'https://overpass-api.de/api/interpreter',
        ];

        const q = `[out:json][timeout:8];(node["amenity"="recycling"](around:5000,${lat},${lon});node["shop"="recycling"](around:5000,${lat},${lon});node["recycling:electrical_appliances"="yes"](around:5000,${lat},${lon}););out body 20;`;

        let data: { elements: { id: number; lat: number; lon: number; tags?: Record<string, string> }[] } | null = null;

        for (const mirror of MIRRORS) {
            try {
                const res = await fetch(
                    `${mirror}?data=${encodeURIComponent(q)}`,
                    { signal: AbortSignal.timeout(10000) },
                );
                if (!res.ok) continue; // try next mirror
                data = await res.json();
                break; // success — stop trying
            } catch {
                // timeout or network error → try next mirror
                continue;
            }
        }

        try {
            const fetched: DropOffPoint[] = (data?.elements ?? []).map(el => ({
                id: el.id,
                name: el.tags?.name ?? el.tags?.['operator'] ?? 'Recycling Point',
                lat: el.lat,
                lon: el.lon,
                distKm: haversineKm(lat, lon, el.lat, el.lon),
                tags: el.tags ?? {},
            })).sort((a, b) => a.distKm - b.distKm).slice(0, 10);

            if (fetched.length === 0) {
                setUsedFallback(true);
                setPoints(STATIC_FALLBACK.map(p => ({
                    ...p,
                    distKm: haversineKm(lat, lon, p.lat, p.lon),
                })).sort((a, b) => a.distKm - b.distKm));
            } else {
                setPoints(fetched);
            }
            setGeoState('ready');
        } catch (e) {
            console.error('[DropOff] failed:', e);
            setUsedFallback(true);
            setPoints(STATIC_FALLBACK.map(p => ({
                ...p,
                distKm: haversineKm(lat, lon, p.lat, p.lon),
            })).sort((a, b) => a.distKm - b.distKm));
            setGeoState('ready');
        }
    }


    function locate() {
        if (!navigator.geolocation) {
            setGeoState('error');
            setErrorMsg('Geolocation is not supported by your browser.');
            return;
        }
        setGeoState('locating');
        navigator.geolocation.getCurrentPosition(
            pos => {
                const { latitude, longitude } = pos.coords;
                setUserLat(latitude);
                setUserLon(longitude);
                fetchNearby(latitude, longitude);
            },
            err => {
                setGeoState('error');
                setErrorMsg(
                    err.code === 1
                        ? 'Location access denied. Showing nationwide drop-off centres.'
                        : 'Could not determine your location. Try again.',
                );
                // On deny — still show static list
                setUsedFallback(true);
                setPoints(STATIC_FALLBACK.map(p => ({ ...p, distKm: 999 })));
                setGeoState('ready');
            },
            { enableHighAccuracy: true, timeout: 10000 },
        );
    }

    // Auto-locate on mount
    useEffect(() => { locate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const canShowMap = geoState === 'ready' && userLat !== null && userLon !== null && !usedFallback;

    return (
        <div className="flex flex-col min-h-screen pb-28 lg:pb-0" style={{ background: 'var(--bg-primary)' }}>

            {/* Header */}
            <div className="safe-top px-5 pt-6 pb-5 lg:px-10 lg:pt-10 lg:pb-8">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => router.back()}
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <ChevronLeft size={16} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                    {(geoState === 'error' || usedFallback) && (
                        <button onClick={() => { setUsedFallback(false); setErrorMsg(''); locate(); }}
                            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                            <RefreshCw size={11} /> Retry
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2 mb-1">
                    <MapPin size={15} style={{ color: '#84cc16' }} />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
                        E-Waste Drop-off
                    </span>
                </div>
                <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>
                    Nearby Drop-off Points
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
                    {geoState === 'locating' && 'Detecting your location…'}
                    {geoState === 'loading' && 'Finding nearby recycling centres…'}
                    {geoState === 'ready' && !usedFallback && `${points.length} location${points.length !== 1 ? 's' : ''} within 5 km`}
                    {geoState === 'ready' && usedFallback && 'Showing nationwide CPCB-registered recyclers'}
                    {geoState === 'idle' && 'Tap to find drop-off points near you'}
                </p>
            </div>

            <div className="px-5 lg:px-10 flex flex-col gap-4 max-w-2xl">

                {/* Loading spinner */}
                {(geoState === 'locating' || geoState === 'loading') && (
                    <div className="rounded-2xl p-10 flex flex-col items-center gap-3"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <Loader2 size={28} className="animate-spin" style={{ color: '#84cc16' }} />
                        <p className="text-sm font-semibold text-white">
                            {geoState === 'locating' ? 'Getting your location…' : 'Searching nearby…'}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                            {geoState === 'loading' ? 'Querying OpenStreetMap Overpass API' : 'Please allow location access'}
                        </p>
                    </div>
                )}

                {/* Error notice */}
                {errorMsg && (
                    <div className="flex items-start gap-2 rounded-xl px-4 py-3"
                        style={{ background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.2)' }}>
                        <AlertTriangle size={13} className="shrink-0 mt-0.5" style={{ color: '#facc15' }} />
                        <p className="text-xs" style={{ color: '#facc15' }}>{errorMsg}</p>
                    </div>
                )}

                {/* SVG minimap */}
                {canShowMap && points.length > 0 && (
                    <Minimap userLat={userLat!} userLon={userLon!} points={points} />
                )}

                {/* Fallback notice */}
                {usedFallback && (
                    <div className="flex items-start gap-2 rounded-xl px-4 py-3"
                        style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
                        <Recycle size={13} className="shrink-0 mt-0.5" style={{ color: '#60a5fa' }} />
                        <p className="text-xs" style={{ color: '#60a5fa' }}>
                            Showing CPCB-registered e-waste recyclers. Enable location for nearby results.
                        </p>
                    </div>
                )}

                {/* Results list */}
                {geoState === 'ready' && points.length === 0 && (
                    <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <MapPin size={28} style={{ color: '#374151' }} />
                        <p className="text-sm font-semibold text-white">No drop-off points found nearby</p>
                        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                            Try expanding your search or check the CPCB website for certified recyclers.
                        </p>
                        <a href="https://cpcb.nic.in/e-waste-recyclers.php" target="_blank" rel="noreferrer"
                            className="mt-2 text-xs font-semibold flex items-center gap-1"
                            style={{ color: '#84cc16' }}>
                            CPCB Recycler Directory <ExternalLink size={11} />
                        </a>
                    </div>
                )}

                {geoState === 'ready' && points.length > 0 && (
                    <div className="flex flex-col gap-3">
                        {points.map((p, i) => {
                            const addr = [
                                p.tags['addr:street'],
                                p.tags['addr:city'],
                                p.tags['addr:state'],
                                p.tags['city'],
                            ].filter(Boolean).join(', ');

                            const distLabel = usedFallback
                                ? (p.tags['city'] ?? '')
                                : p.distKm < 1
                                    ? `${Math.round(p.distKm * 1000)} m away`
                                    : `${p.distKm.toFixed(1)} km away`;

                            return (
                                <div key={p.id}
                                    className="rounded-xl p-4 flex items-start gap-4"
                                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                    {/* index badge */}
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                                        style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                                        {addr && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-dim)' }}>{addr}</p>}
                                        <div className="flex items-center gap-1 mt-1">
                                            <Navigation size={10} style={{ color: '#84cc16' }} />
                                            <span className="text-xs font-semibold" style={{ color: '#84cc16' }}>{distLabel}</span>
                                        </div>
                                    </div>
                                    <a href={mapsUrl(p.lat, p.lon, p.name)} target="_blank" rel="noreferrer"
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all hover:opacity-80"
                                        style={{ background: 'rgba(132,204,22,0.12)', color: '#84cc16', border: '1px solid rgba(132,204,22,0.2)' }}>
                                        <ExternalLink size={10} /> Maps
                                    </a>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Idle state — button */}
                {geoState === 'idle' && (
                    <div className="rounded-2xl p-8 flex flex-col items-center gap-4"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                            style={{ background: 'rgba(132,204,22,0.1)', border: '1px solid rgba(132,204,22,0.2)' }}>
                            <MapPin size={24} style={{ color: '#84cc16' }} />
                        </div>
                        <div className="text-center">
                            <p className="text-base font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>
                                Find Drop-off Points
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                                We&apos;ll use your location to find nearby e-waste recycling centres.
                            </p>
                        </div>
                        <button onClick={locate}
                            className="px-6 py-2.5 rounded-xl text-sm font-bold"
                            style={{ background: '#84cc16', color: 'var(--bg-primary)' }}>
                            Use My Location
                        </button>
                    </div>
                )}
            </div>

            <BottomNav />
        </div>
    );
}
