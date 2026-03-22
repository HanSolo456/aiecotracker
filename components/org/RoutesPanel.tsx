'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/authContext';
import { MapPin, Navigation, LocateFixed, AlertTriangle, Leaf } from 'lucide-react';

interface Bin {
    deviceId: string; displayName: string; latitude: number | null; longitude: number | null;
    fillPct: number; temperature: number | null; humidity: number | null; lastSeen: string; urgent: boolean;
}

const fillColor = (p: number) => p >= 80 ? '#F87171' : p >= 60 ? '#FB923C' : p >= 40 ? '#FCD34D' : '#4ADE80';
const timeAgo   = (iso: string) => { const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`; };

export default function RoutesPanel() {
    const { user } = useAuth();
    const [bins, setBins]       = useState<Bin[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState('');
    const [savingId, setSavingId] = useState('');
    const mapRef        = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leafletMapRef = useRef<any>(null);

    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const token = await user.getIdToken();
                const res   = await fetch('/api/org/devices/locations', { headers: { Authorization: `Bearer ${token}` } });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                setBins((await res.json()).bins ?? []);
            } catch (e) { setError(String(e)); }
            finally { setLoading(false); }
        })();
    }, [user]);

    useEffect(() => {
        if (loading || !mapRef.current) return;
        if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; }
        const located = bins.filter(b => b.latitude != null && b.longitude != null);
        import('leaflet').then(L => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (L.Icon.Default.prototype as any)._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
                iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            });
            const center: [number, number] = located.length > 0 ? [located[0].latitude!, located[0].longitude!] : [20.5937, 78.9629];
            const map = L.map(mapRef.current!).setView(center, located.length > 0 ? 14 : 5);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://carto.com/">CARTO</a>', subdomains: 'abcd', maxZoom: 20,
            }).addTo(map);
            for (const bin of located) {
                const color = fillColor(bin.fillPct);
                const icon  = L.divIcon({ className: '', iconSize: [32, 32], iconAnchor: [16, 16],
                    html: `<div style="background:${color};width:32px;height:32px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;color:#0f172a;box-shadow:0 2px 8px rgba(0,0,0,0.4)">${bin.fillPct}%</div>` });
                L.marker([bin.latitude!, bin.longitude!], { icon }).addTo(map)
                    .bindPopup(`<b>${bin.displayName}</b><br/>Fill: <b style="color:${color}">${bin.fillPct}%</b><br/>Last seen: ${timeAgo(bin.lastSeen)}`);
            }
            leafletMapRef.current = map;
        });
        return () => { if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; } };
    }, [bins, loading]);

    async function handleSetLocation(deviceId: string) {
        setSavingId(deviceId);
        try {
            const pos = await new Promise<GeolocationPosition>((res, rej) =>
                navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 }));
            const { latitude, longitude } = pos.coords;
            const token = await user!.getIdToken();
            const r = await fetch('/api/org/devices/locations', { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId, latitude, longitude }) });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            setBins(prev => prev.map(b => b.deviceId === deviceId ? { ...b, latitude, longitude } : b));
        } catch (e) { alert(`Could not set location: ${e}`); }
        finally { setSavingId(''); }
    }

    function handleOptimizeRoute() {
        const urgent = bins.filter(b => b.urgent && b.latitude != null && b.longitude != null);
        if (urgent.length === 0) { alert('No urgent bins with locations set.'); return; }
        const coords = urgent.map(b => `${b.latitude},${b.longitude}`);
        const url = `https://www.google.com/maps/dir/?api=1&origin=${coords[0]}&destination=${coords[coords.length - 1]}&travelmode=driving${coords.length > 2 ? `&waypoints=${encodeURIComponent(coords.slice(1, -1).join('|'))}` : ''}`;
        window.open(url, '_blank');
    }

    const urgentCount  = bins.filter(b => b.urgent).length;
    const locatedCount = bins.filter(b => b.latitude != null).length;
    const co2SavedEst  = urgentCount > 1 ? (urgentCount * 0.3 * 0.12).toFixed(2) : '0';

    if (loading) return (
        <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: '#84cc16' }} />
        </div>
    );

    return (
        <div className="flex flex-col gap-4">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />

            {error && <div className="card p-3 text-sm" style={{ color: '#fca5a5', borderColor: 'rgba(239,68,68,0.35)' }}>{error}</div>}

            {/* Action bar */}
            <div className="card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={14} style={{ color: '#FB923C' }} />
                        <span className="text-sm font-semibold text-white">{urgentCount} bins need collection</span>
                    </div>
                    {urgentCount > 1 && (
                        <div className="flex items-center gap-1.5 text-xs" style={{ color: '#4ADE80' }}>
                            <Leaf size={11} />
                            <span>~{co2SavedEst} kg CO₂ saved vs unoptimized route</span>
                        </div>
                    )}
                </div>
                <button onClick={handleOptimizeRoute} disabled={urgentCount === 0 || locatedCount === 0}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 whitespace-nowrap"
                    style={{ background: urgentCount > 0 ? 'var(--lime-glow)' : 'var(--bg-elevated)', border: '1px solid var(--lime-border)', color: 'var(--lime)' }}>
                    <Navigation size={14} /> Optimize Route →
                </button>
            </div>

            {/* Map */}
            <div className="card overflow-hidden" style={{ height: '320px', position: 'relative' }}>
                {locatedCount === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-2" style={{ background: 'var(--bg-card)' }}>
                        <MapPin size={32} style={{ color: 'var(--text-muted)' }} />
                        <p className="text-sm text-white font-semibold">No bin locations set yet</p>
                        <p className="text-xs text-center px-6" style={{ color: 'var(--text-dim)' }}>Click "Set My Location" on a bin below to place it on the map.</p>
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
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No active devices found. Provision an ESP32 device first.</p>
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
                                            style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171' }}>URGENT</span>
                                    )}
                                </div>
                                <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                                    {bin.latitude != null ? `${bin.latitude.toFixed(4)}, ${bin.longitude!.toFixed(4)}` : 'No location set'} · {timeAgo(bin.lastSeen)}
                                </p>
                            </div>
                            <div className="shrink-0 flex flex-col items-center gap-1">
                                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold"
                                    style={{ background: `${fillColor(bin.fillPct)}18`, border: `2px solid ${fillColor(bin.fillPct)}` }}>
                                    <span style={{ color: fillColor(bin.fillPct) }}>{bin.fillPct}%</span>
                                </div>
                                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>fill</span>
                            </div>
                        </div>
                        <div className="h-2 rounded-full" style={{ background: 'var(--border)' }}>
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${bin.fillPct}%`, background: fillColor(bin.fillPct) }} />
                        </div>
                        {(bin.temperature != null || bin.humidity != null) && (
                            <div className="flex gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {bin.temperature != null && <span>🌡 {bin.temperature}°C</span>}
                                {bin.humidity    != null && <span>💧 {bin.humidity}%</span>}
                            </div>
                        )}
                        <button onClick={() => handleSetLocation(bin.deviceId)} disabled={savingId === bin.deviceId}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 self-start"
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                            <LocateFixed size={12} />
                            {savingId === bin.deviceId ? 'Getting GPS...' : bin.latitude != null ? '📍 Update Location' : '📍 Set My Location'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
