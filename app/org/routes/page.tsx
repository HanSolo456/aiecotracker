'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, MapPin, Navigation, LocateFixed, AlertTriangle, Leaf } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import BottomNav from '@/components/BottomNav';

interface Bin {
    deviceId: string;
    displayName: string;
    latitude: number | null;
    longitude: number | null;
    fillPct: number;
    temperature: number | null;
    humidity: number | null;
    lastSeen: string;
    urgent: boolean;
}

function fillColor(pct: number) {
    if (pct >= 80) return '#F87171';
    if (pct >= 60) return '#FB923C';
    if (pct >= 40) return '#FCD34D';
    return '#4ADE80';
}

function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
}

export default function RoutesPage() {
    const router = useRouter();
    const { user, profile, loading } = useAuth();
    const [bins, setBins] = useState<Bin[]>([]);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState('');
    const [savingId, setSavingId] = useState('');
    const mapRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leafletMapRef = useRef<any>(null);

    // Auth guard
    useEffect(() => {
        if (loading) return;
        if (!user || user.isAnonymous) { router.replace('/dashboard'); return; }
        if (!profile?.orgId) { router.replace('/dashboard'); return; }
    }, [user, profile, loading, router]);

    // Fetch bins
    useEffect(() => {
        if (!user || loading) return;
        async function load() {
            try {
                const token = await user!.getIdToken();
                const res = await fetch('/api/org/devices/locations', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                setBins(json.bins ?? []);
            } catch (e) {
                setError(String(e));
            } finally {
                setFetching(false);
            }
        }
        load();
    }, [user, loading]);

    // Initialize Leaflet map once bins are ready
    useEffect(() => {
        if (fetching || !mapRef.current) return;
        // Destroy previous instance if it exists
        if (leafletMapRef.current) {
            leafletMapRef.current.remove();
            leafletMapRef.current = null;
        }

        const binsWithLocation = bins.filter(b => b.latitude != null && b.longitude != null);

        // Dynamic import Leaflet (no SSR)
        import('leaflet').then(L => {
            // Fix default marker icons
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (L.Icon.Default.prototype as any)._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            });

            const center: [number, number] = binsWithLocation.length > 0
                ? [binsWithLocation[0].latitude!, binsWithLocation[0].longitude!]
                : [20.5937, 78.9629]; // India center fallback

            const map = L.map(mapRef.current!).setView(center, binsWithLocation.length > 0 ? 14 : 5);

            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
                subdomains: 'abcd',
                maxZoom: 20,
            }).addTo(map);

            for (const bin of binsWithLocation) {
                const color = fillColor(bin.fillPct);
                const icon = L.divIcon({
                    className: '',
                    html: `<div style="background:${color};width:32px;height:32px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;color:#0f172a;box-shadow:0 2px 8px rgba(0,0,0,0.5)">${bin.fillPct}%</div>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16],
                });
                L.marker([bin.latitude!, bin.longitude!], { icon })
                    .addTo(map)
                    .bindPopup(`
                        <b>${bin.displayName}</b><br/>
                        Fill: <b style="color:${color}">${bin.fillPct}%</b><br/>
                        ${bin.temperature != null ? `Temp: ${bin.temperature}°C<br/>` : ''}
                        Last seen: ${timeAgo(bin.lastSeen)}
                    `);
            }

            leafletMapRef.current = map;
        });

        return () => {
            if (leafletMapRef.current) {
                leafletMapRef.current.remove();
                leafletMapRef.current = null;
            }
        };
    }, [bins, fetching]);

    // Set device location via browser geolocation
    async function handleSetLocation(deviceId: string) {
        setSavingId(deviceId);
        try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
            );
            const { latitude, longitude } = pos.coords;
            const token = await user!.getIdToken();
            const res = await fetch('/api/org/devices/locations', {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId, latitude, longitude }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setBins(prev => prev.map(b =>
                b.deviceId === deviceId ? { ...b, latitude, longitude } : b
            ));
        } catch (e) {
            alert(`Could not set location: ${e}`);
        } finally {
            setSavingId('');
        }
    }

    // Build Google Maps optimized route from urgent bins
    function handleOptimizeRoute() {
        const urgentBins = bins.filter(b => b.urgent && b.latitude != null && b.longitude != null);
        if (urgentBins.length === 0) {
            alert('No urgent bins (≥70% full) with locations set. Set bin locations first.');
            return;
        }

        // Google Maps accepts: origin/destination + waypoints
        const coords = urgentBins.map(b => `${b.latitude},${b.longitude}`);
        const origin = coords[0];
        const destination = coords[coords.length - 1];
        const waypoints = coords.slice(1, -1).join('|');

        let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
        if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
        window.open(url, '_blank');
    }

    const urgentCount = bins.filter(b => b.urgent).length;
    const locatedCount = bins.filter(b => b.latitude != null).length;

    // Estimate CO₂ saved: assume route reduces total distance by 30% vs random order
    const co2SavedEst = urgentCount > 1 ? (urgentCount * 0.3 * 0.12).toFixed(2) : '0';

    if (loading || fetching) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--border)', borderTopColor: '#84cc16' }} />
        </div>
    );

    return (
        <div className="min-h-screen pb-28 lg:pb-10" style={{ background: 'var(--bg-primary)' }}>
            {/* Leaflet CSS */}
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />

            {/* Header */}
            <div className="safe-top px-5 pt-6 pb-5 lg:px-10 lg:pt-10 lg:pb-8 bg-grid">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => router.back()}
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                        <ChevronLeft size={16} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                </div>
                <div className="flex items-center gap-2 mb-1">
                    <Navigation size={14} style={{ color: '#38BDF8' }} />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
                        Fleet Optimization
                    </span>
                </div>
                <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>
                    Collection Routes
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
                    {urgentCount} urgent bins · {locatedCount}/{bins.length} located
                </p>
            </div>

            <div className="px-5 lg:px-10 flex flex-col gap-4 max-w-4xl">

                {error && (
                    <div className="card p-3 text-sm" style={{ color: '#fca5a5', borderColor: 'rgba(239,68,68,0.35)' }}>
                        {error}
                    </div>
                )}

                {/* Action bar */}
                <div className="card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={14} style={{ color: '#FB923C' }} />
                            <span className="text-sm font-semibold text-white">
                                {urgentCount} bins need collection
                            </span>
                        </div>
                        {urgentCount > 1 && (
                            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#4ADE80' }}>
                                <Leaf size={11} />
                                <span>~{co2SavedEst} kg CO₂ saved vs unoptimized route</span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleOptimizeRoute}
                        disabled={urgentCount === 0 || locatedCount === 0}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 whitespace-nowrap"
                        style={{ background: urgentCount > 0 ? 'var(--lime-glow)' : 'var(--bg-elevated)', border: '1px solid var(--lime-border)', color: 'var(--lime)' }}
                    >
                        <Navigation size={14} />
                        Optimize Route →
                    </button>
                </div>

                {/* Map */}
                <div className="card overflow-hidden" style={{ height: '340px', position: 'relative' }}>
                    {locatedCount === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-2"
                            style={{ background: 'var(--bg-card)' }}>
                            <MapPin size={32} style={{ color: 'var(--text-muted)' }} />
                            <p className="text-sm text-white font-semibold">No bin locations set yet</p>
                            <p className="text-xs text-center px-6" style={{ color: 'var(--text-dim)' }}>
                                Click "Set My Location" on a bin below to place it on the map using your phone's GPS.
                            </p>
                        </div>
                    )}
                    <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
                </div>

                {/* Legend */}
                <div className="flex gap-4 flex-wrap text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {[['#4ADE80', '< 40%'], ['#FCD34D', '40–60%'], ['#FB923C', '60–80%'], ['#F87171', '≥ 80%']].map(([color, label]) => (
                        <div key={label} className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                            <span>{label}</span>
                        </div>
                    ))}
                </div>

                {/* Bin list */}
                <div className="flex flex-col gap-3">
                    {bins.length === 0 && (
                        <div className="card p-8 text-center">
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                No active devices found. Provision an ESP32 device first.
                            </p>
                        </div>
                    )}
                    {bins.map(bin => (
                        <div key={bin.deviceId} className="card p-4 flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <MapPin size={12} style={{ color: fillColor(bin.fillPct), flexShrink: 0 }} />
                                        <p className="text-sm font-semibold text-white truncate">{bin.displayName}</p>
                                        {bin.urgent && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                                                style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171' }}>
                                                URGENT
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                                        {bin.latitude != null
                                            ? `${bin.latitude.toFixed(4)}, ${bin.longitude!.toFixed(4)}`
                                            : 'No location set'}
                                        {' · '}{timeAgo(bin.lastSeen)}
                                    </p>
                                </div>
                                {/* Fill gauge */}
                                <div className="shrink-0 flex flex-col items-center gap-1">
                                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold"
                                        style={{ background: `${fillColor(bin.fillPct)}18`, border: `2px solid ${fillColor(bin.fillPct)}` }}>
                                        <span style={{ color: fillColor(bin.fillPct) }}>{bin.fillPct}%</span>
                                    </div>
                                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>fill</span>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="h-2 rounded-full" style={{ background: 'var(--border)' }}>
                                <div className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${bin.fillPct}%`, background: fillColor(bin.fillPct) }} />
                            </div>

                            {/* Sensors */}
                            {(bin.temperature != null || bin.humidity != null) && (
                                <div className="flex gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    {bin.temperature != null && <span>🌡 {bin.temperature}°C</span>}
                                    {bin.humidity != null && <span>💧 {bin.humidity}%</span>}
                                </div>
                            )}

                            {/* Set location button */}
                            <button
                                onClick={() => handleSetLocation(bin.deviceId)}
                                disabled={savingId === bin.deviceId}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 self-start"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                            >
                                <LocateFixed size={12} />
                                {savingId === bin.deviceId ? 'Getting GPS...' :
                                    bin.latitude != null ? '📍 Update Location' : '📍 Set My Location'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <BottomNav />
        </div>
    );
}
