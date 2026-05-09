'use client';

import { useEffect, useState, useRef } from 'react';
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

type LeafletMapHandle = { remove: () => void };
type LeafletContainer = HTMLDivElement & { _leaflet_id?: number | null };

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

// ── Leaflet Map ───────────────────────────────────────────────────────────────

function LeafletMap({
    userLat, userLon, points,
}: { userLat: number; userLon: number; points: DropOffPoint[] }) {
    const mapRef = useRef<HTMLDivElement>(null);
    const leafletMapRef = useRef<LeafletMapHandle | null>(null);

    useEffect(() => {
        if (!mapRef.current) return;
        let isMounted = true;

        if (leafletMapRef.current) {
            leafletMapRef.current.remove();
            leafletMapRef.current = null;
        }

        import('leaflet').then((L) => {
            if (!isMounted || !mapRef.current) return;

            const container = mapRef.current as LeafletContainer;
            if (container._leaflet_id) {
                container._leaflet_id = null;
                container.innerHTML = '';
            }

            delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            });

            const map = L.map(mapRef.current);
            L.tileLayer(
                'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
                {
                    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
                    subdomains: 'abcd',
                    maxZoom: 20,
                },
            ).addTo(map);

            // User marker
            const userIcon = L.divIcon({
                className: '',
                html: `<div style="width:36px;height:36px;border-radius:18px;background:#84cc16;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(132,204,22,0.5)">
                    <div style="width:10px;height:10px;border-radius:5px;background:white"></div>
                </div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 18],
            });
            L.marker([userLat, userLon], { icon: userIcon })
                .addTo(map)
                .bindPopup('<b>You are here</b>');

            // Drop-off markers
            points.forEach((p, i) => {
                const pinIcon = L.divIcon({
                    className: '',
                    html: `<div style="width:34px;height:34px;border-radius:17px;background:#1d4ed8;border:3px solid #60a5fa;display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:800;box-shadow:0 4px 12px rgba(29,78,216,0.45)">${i + 1}</div>`,
                    iconSize: [34, 34],
                    iconAnchor: [17, 17],
                });
                L.marker([p.lat, p.lon], { icon: pinIcon })
                    .addTo(map)
                    .bindPopup(`<b>${p.name}</b><br/>${p.distKm < 1 ? `${Math.round(p.distKm * 1000)} m away` : `${p.distKm.toFixed(1)} km away`}`);
            });

            // Fit bounds to show all markers
            const allLatLngs: [number, number][] = [
                [userLat, userLon],
                ...points.map(p => [p.lat, p.lon] as [number, number]),
            ];
            map.fitBounds(allLatLngs, { padding: [36, 36] });

            leafletMapRef.current = map;
        });

        return () => {
            isMounted = false;
            if (leafletMapRef.current) {
                leafletMapRef.current.remove();
                leafletMapRef.current = null;
            }
        };
    }, [userLat, userLon, points]);

    return (
        <div className="rounded-2xl overflow-hidden" style={{ height: 260, position: 'relative', isolation: 'isolate', border: '1px solid var(--border)' }}>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
            <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
            <div className="absolute bottom-0 left-0 right-0 flex items-center gap-4 px-4 py-2 pointer-events-none"
                style={{ background: 'linear-gradient(to top, rgba(17,24,39,0.85) 0%, transparent 100%)' }}>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#84cc16' }} />
                    <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>You</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#3b82f6' }} />
                    <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>Drop-off point</span>
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
    // Prevent double-fetch (React StrictMode fires effects twice in dev)
    const fetchingRef = useRef(false);
    const abortRef = useRef<AbortController | null>(null);

    async function fetchNearby(lat: number, lon: number) {
        if (fetchingRef.current) return; // already in flight — skip
        fetchingRef.current = true;

        // Cancel any previous in-flight requests
        abortRef.current?.abort();
        abortRef.current = new AbortController();
        const { signal } = abortRef.current;

        setGeoState('loading');

        const q = `[out:json][timeout:8];(node["amenity"="recycling"](around:5000,${lat},${lon});node["shop"="recycling"](around:5000,${lat},${lon});node["recycling:electrical_appliances"="yes"](around:5000,${lat},${lon}););out body 20;`;

        let data: { elements: { id: number; lat: number; lon: number; tags?: Record<string, string> }[] } | null = null;

        // Use our server-side proxy (/api/overpass) to avoid CORS & 406 errors.
        // Direct browser → overpass-api.de calls are blocked by CORS policy.
        try {
            const res = await fetch(`/api/overpass?data=${encodeURIComponent(q)}`, { signal });
            if (res.ok) {
                data = await res.json();
            }
        } catch (err) {
            if ((err as Error)?.name === 'AbortError') return; // superceded by a newer call
            // Proxy failed — data stays null, fallback kicks in below
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
        } finally {
            fetchingRef.current = false;
        }
    }

    function locate() {
        if (!navigator.geolocation) {
            setGeoState('error');
            setErrorMsg('Geolocation is not supported by your browser.');
            return;
        }
        setGeoState('locating');

        // Fast low-accuracy pass first — gives a result almost instantly
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
                setUsedFallback(true);
                setPoints(STATIC_FALLBACK.map(p => ({ ...p, distKm: 999 })));
                setGeoState('ready');
            },
            // Low accuracy = much faster (uses network/cell instead of GPS)
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
        );
    }

    // Auto-locate on mount
    useEffect(() => { locate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Show the real map whenever we have the user's coordinates — even in fallback mode
    const canShowMap = geoState === 'ready' && userLat !== null && userLon !== null;

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

                {/* Leaflet map */}
                {canShowMap && (
                    <LeafletMap
                        userLat={userLat!}
                        userLon={userLon!}
                        // Don't plot nationwide fallback pins — they'd be 1000s of km away
                        points={usedFallback ? [] : points}
                    />
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

                {/* Empty state */}
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

                {/* Results list */}
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

                {/* Idle state */}
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
