'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    MapPin, Navigation, Loader2, ChevronLeft,
    ExternalLink, AlertTriangle, RefreshCw, Recycle,
    Phone, Clock, CheckCircle2, Search, Filter, Compass,
    Zap, BatteryCharging, Wrench, Globe,
} from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import {
    VERIFIED_FACILITIES,
    haversineDistanceKm,
    type DropOffFacility,
} from '@/lib/dropOffFacilities';

// ── Types ─────────────────────────────────────────────────────────────────────

type GeoState = 'idle' | 'locating' | 'loading' | 'ready' | 'error';
type CategoryFilter = 'all' | 'e_waste' | 'metal_scrap' | 'battery' | 'general_recycling';

const MAJOR_CITIES = [
    { name: 'Delhi NCR', lat: 28.6139, lon: 77.2090 },
    { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
    { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
    { name: 'Pune', lat: 18.5204, lon: 73.8567 },
    { name: 'Hyderabad', lat: 17.3850, lon: 78.4867 },
    { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
    { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
];

const CATEGORY_OPTIONS: { id: CategoryFilter; label: string; icon: typeof Recycle; color: string }[] = [
    { id: 'all', label: 'All Types', icon: Recycle, color: '#84cc16' },
    { id: 'e_waste', label: 'E-Waste', icon: Zap, color: '#38bdf8' },
    { id: 'metal_scrap', label: 'Metal / Scrap', icon: Wrench, color: '#a78bfa' },
    { id: 'battery', label: 'Batteries', icon: BatteryCharging, color: '#f59e0b' },
    { id: 'general_recycling', label: 'Polymers & General', icon: Globe, color: '#34d399' },
];

function mapsUrl(lat: number, lon: number, name: string): string {
    return `https://maps.google.com/maps?q=${encodeURIComponent(name)}&ll=${lat},${lon}&z=16`;
}

// ── Leaflet Map Component ─────────────────────────────────────────────────────

function LeafletMap({
    userLat,
    userLon,
    points,
    onSelectPoint,
}: {
    userLat: number;
    userLon: number;
    points: DropOffFacility[];
    onSelectPoint?: (p: DropOffFacility) => void;
}) {
    const mapRef = useRef<HTMLDivElement>(null);
    const leafletMapRef = useRef<{ remove: () => void } | null>(null);

    useEffect(() => {
        if (!mapRef.current) return;
        let isMounted = true;

        if (leafletMapRef.current) {
            leafletMapRef.current.remove();
            leafletMapRef.current = null;
        }

        import('leaflet').then((L) => {
            if (!isMounted || !mapRef.current) return;

            const container = mapRef.current as HTMLDivElement & { _leaflet_id?: number | null };
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

            const map = L.map(mapRef.current, {
                zoomControl: true,
                attributionControl: false,
            });

            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                maxZoom: 19,
                subdomains: 'abcd',
            }).addTo(map);

            // User Location Marker
            const userIcon = L.divIcon({
                className: '',
                html: `
                    <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
                        <div style="position:absolute;width:100%;height:100%;border-radius:50%;background:rgba(132,204,22,0.35);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
                        <div style="width:22px;height:22px;border-radius:50%;background:#84cc16;border:3px solid #ffffff;box-shadow:0 3px 8px rgba(0,0,0,0.3);z-index:2;"></div>
                    </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
            });

            L.marker([userLat, userLon], { icon: userIcon, zIndexOffset: 1000 })
                .addTo(map)
                .bindPopup('<div style="font-family:sans-serif;font-size:12px;font-weight:700;color:#1e293b;">📍 Your Location</div>');

            // Facility Pins
            points.forEach((p, idx) => {
                const badgeColor =
                    p.category === 'e_waste' ? '#0284c7' :
                    p.category === 'metal_scrap' ? '#7c3aed' :
                    p.category === 'battery' ? '#d97706' : '#059669';

                const pinIcon = L.divIcon({
                    className: '',
                    html: `
                        <div style="width:30px;height:30px;border-radius:15px;background:${badgeColor};border:2.5px solid #ffffff;display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:11px;font-weight:800;box-shadow:0 4px 10px rgba(0,0,0,0.35);cursor:pointer;">
                            ${idx + 1}
                        </div>
                    `,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                });

                const distText = p.distKm !== undefined ? (p.distKm < 1 ? `${Math.round(p.distKm * 1000)} m` : `${p.distKm.toFixed(1)} km`) : '';

                const marker = L.marker([p.lat, p.lon], { icon: pinIcon })
                    .addTo(map)
                    .bindPopup(`
                        <div style="font-family:sans-serif;min-width:180px;padding:2px 0;">
                            <div style="font-size:12px;font-weight:700;color:#0f172a;line-height:1.3;margin-bottom:3px;">${p.name}</div>
                            <div style="font-size:10px;color:#64748b;margin-bottom:6px;">${p.area || p.city} • <b>${distText} away</b></div>
                            <a href="${mapsUrl(p.lat, p.lon, p.name)}" target="_blank" rel="noreferrer" 
                               style="display:inline-block;background:#84cc16;color:#0f172a;padding:4px 8px;border-radius:6px;font-size:10px;font-weight:700;text-decoration:none;">
                               Open in Maps →
                            </a>
                        </div>
                    `);

                marker.on('click', () => onSelectPoint?.(p));
            });

            // Fit map bounds
            const allCoords: [number, number][] = [
                [userLat, userLon],
                ...points.map(p => [p.lat, p.lon] as [number, number]),
            ];

            if (allCoords.length > 0) {
                map.fitBounds(allCoords, { padding: [40, 40], maxZoom: 14 });
            }

            leafletMapRef.current = map;
        });

        return () => {
            isMounted = false;
            if (leafletMapRef.current) {
                leafletMapRef.current.remove();
                leafletMapRef.current = null;
            }
        };
    }, [userLat, userLon, points, onSelectPoint]);

    return (
        <div className="rounded-2xl overflow-hidden shadow-lg" style={{ height: 280, position: 'relative', border: '1px solid var(--border)' }}>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
            <div ref={mapRef} style={{ height: '100%', width: '100%', background: '#0b1120' }} />
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2 pointer-events-none"
                style={{ background: 'linear-gradient(to top, rgba(15,23,42,0.92) 0%, transparent 100%)' }}>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#84cc16' }} />
                        <span className="text-[11px] font-semibold text-white">Your Location</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#0284c7' }} />
                        <span className="text-[11px] font-semibold text-white">Drop-Off Center ({points.length})</span>
                    </div>
                </div>
                <span className="text-[10px] font-mono text-slate-400">OpenStreetMap / CPCB</span>
            </div>
        </div>
    );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function DropOffPage() {
    const router = useRouter();
    const [geoState, setGeoState] = useState<GeoState>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [userLat, setUserLat] = useState<number>(28.6139); // Default to Delhi center
    const [userLon, setUserLon] = useState<number>(77.2090);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
    const [radiusKm, setRadiusKm] = useState<number>(35);
    const [osmPoints, setOsmPoints] = useState<DropOffFacility[]>([]);
    const [activeCity, setActiveCity] = useState<string>('Delhi NCR');
    const [isLocating, setIsLocating] = useState(false);

    // Fetch OSM live recycling nodes around coordinates
    async function queryOsmOverpass(lat: number, lon: number, radiusMeters: number) {
        setGeoState('loading');
        const q = `[out:json][timeout:6];(node["amenity"="recycling"](around:${radiusMeters},${lat},${lon});node["shop"="recycling"](around:${radiusMeters},${lat},${lon});node["recycling:electrical_appliances"="yes"](around:${radiusMeters},${lat},${lon});way["amenity"="recycling"](around:${radiusMeters},${lat},${lon}););out center 15;`;

        try {
            const res = await fetch(`/api/overpass?data=${encodeURIComponent(q)}`);
            if (res.ok) {
                const data = await res.json();
                const elements = data?.elements ?? [];
                
                const mapped: DropOffFacility[] = elements.map((el: any) => {
                    const elLat = el.lat ?? el.center?.lat ?? lat;
                    const elLon = el.lon ?? el.center?.lon ?? lon;
                    return {
                        id: `osm-${el.id}`,
                        name: el.tags?.name || el.tags?.operator || 'Local Recycling Facility',
                        category: (el.tags?.['recycling:electrical_appliances'] === 'yes' ? 'e_waste' : 'general_recycling') as any,
                        categoryLabel: el.tags?.['recycling:electrical_appliances'] === 'yes' ? 'E-Waste' : 'Recycling Center',
                        lat: elLat,
                        lon: elLon,
                        distKm: Math.round(haversineDistanceKm(lat, lon, elLat, elLon) * 10) / 10,
                        address: el.tags?.['addr:street'] || el.tags?.['addr:full'] || 'OpenStreetMap Facility',
                        area: el.tags?.['addr:suburb'] || el.tags?.['addr:city'] || 'Nearby',
                        city: el.tags?.['addr:city'] || 'Local Area',
                        state: el.tags?.['addr:state'] || '',
                        verifiedCpcb: false,
                        acceptedMaterials: ['Scrap', 'Recyclables', 'Household Sorting'],
                        tags: el.tags || {},
                    };
                });
                setOsmPoints(mapped);
            }
        } catch (err) {
            console.warn('[DropOff] OSM fetch failed, using verified directory:', err);
        } finally {
            setGeoState('ready');
        }
    }

    // Geolocation trigger
    function locateMe() {
        if (!navigator.geolocation) {
            setErrorMsg('Geolocation not supported by your browser. You can select a city above.');
            return;
        }

        setIsLocating(true);
        setGeoState('locating');
        setErrorMsg('');

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                setUserLat(latitude);
                setUserLon(longitude);
                setActiveCity('My Location');
                setIsLocating(false);
                queryOsmOverpass(latitude, longitude, radiusKm * 1000);
            },
            (err) => {
                setIsLocating(false);
                setGeoState('ready');
                if (err.code === 1) {
                    setErrorMsg('Location permission denied. Showing nearest facilities in Delhi NCR.');
                } else {
                    setErrorMsg('Could not detect location. Showing default metro centers.');
                }
            },
            { enableHighAccuracy: false, timeout: 7000, maximumAge: 120000 }
        );
    }

    // City Selector
    function selectCity(city: typeof MAJOR_CITIES[0]) {
        setActiveCity(city.name);
        setUserLat(city.lat);
        setUserLon(city.lon);
        setErrorMsg('');
        queryOsmOverpass(city.lat, city.lon, radiusKm * 1000);
    }

    // Initial mount: try auto-locate, or fallback to Delhi NCR gracefully
    useEffect(() => {
        locateMe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Combine verified facilities with OSM points & apply filters
    const filteredPoints = useMemo(() => {
        // Calculate verified facilities distance from active center
        const verifiedWithDist: DropOffFacility[] = VERIFIED_FACILITIES.map(f => ({
            ...f,
            distKm: Math.round(haversineDistanceKm(userLat, userLon, f.lat, f.lon) * 10) / 10,
        }));

        // Merge verified directory + OSM points
        const merged = [...verifiedWithDist, ...osmPoints];

        // Deduplicate close points by coordinates
        const unique: DropOffFacility[] = [];
        const seen = new Set<string>();

        for (const pt of merged) {
            const key = `${pt.lat.toFixed(3)}_${pt.lon.toFixed(3)}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(pt);
            }
        }

        return unique
            .filter(p => {
                // Radius filter
                if (radiusKm !== 0 && (p.distKm ?? 0) > radiusKm) return false;
                // Category filter
                if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
                // Search query filter
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase();
                    const matchName = p.name.toLowerCase().includes(q);
                    const matchArea = p.area.toLowerCase().includes(q);
                    const matchCity = p.city.toLowerCase().includes(q);
                    const matchMat = p.acceptedMaterials?.some(m => m.toLowerCase().includes(q));
                    return matchName || matchArea || matchCity || matchMat;
                }
                return true;
            })
            .sort((a, b) => (a.distKm ?? 0) - (b.distKm ?? 0));
    }, [userLat, userLon, osmPoints, selectedCategory, radiusKm, searchQuery]);

    return (
        <div className="flex flex-col min-h-screen pb-28 lg:pb-12" style={{ background: 'var(--bg-primary)' }}>

            {/* Header */}
            <div className="safe-top px-5 pt-6 pb-4 lg:px-10 lg:pt-8">
                <div className="flex items-center justify-between gap-3 mb-3">
                    <button
                        onClick={() => router.back()}
                        className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform active:scale-95"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <ChevronLeft size={18} style={{ color: 'var(--text-secondary)' }} />
                    </button>

                    <button
                        onClick={locateMe}
                        disabled={isLocating}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                        style={{ background: 'rgba(132,204,22,0.15)', border: '1px solid rgba(132,204,22,0.3)', color: '#84cc16' }}>
                        {isLocating ? <Loader2 size={13} className="animate-spin" /> : <Compass size={13} />}
                        {isLocating ? 'Locating…' : 'Locate Me'}
                    </button>
                </div>

                <div className="flex items-center gap-2 mb-1">
                    <MapPin size={15} style={{ color: '#84cc16' }} />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
                        Facility Directory & GPS
                    </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
                    Recycling & Drop-off Locator
                </h1>
                <p className="text-xs lg:text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
                    Find CPCB/DPCC authorized e-waste processing hubs, scrap collection centers & drop boxes.
                </p>
            </div>

            {/* City Selector Quick Chips */}
            <div className="px-5 lg:px-10 mb-4 overflow-x-auto no-scrollbar flex items-center gap-2 pb-1">
                <span className="text-xs font-bold shrink-0 text-slate-400 mr-1">City:</span>
                {MAJOR_CITIES.map((c) => (
                    <button
                        key={c.name}
                        onClick={() => selectCity(c)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all ${
                            activeCity === c.name
                                ? 'bg-lime-500 text-slate-950 shadow-md shadow-lime-500/20'
                                : 'text-slate-300 hover:text-white border border-slate-700 bg-slate-900/60'
                        }`}>
                        {c.name}
                    </button>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="px-5 lg:px-10 flex flex-col gap-4 max-w-4xl mx-auto w-full">

                {/* Error Banner */}
                {errorMsg && (
                    <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-xs"
                        style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}>
                        <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                {/* Leaflet Interactive Map */}
                <LeafletMap
                    userLat={userLat}
                    userLon={userLon}
                    points={filteredPoints}
                />

                {/* Search & Filter Controls */}
                <div className="rounded-2xl p-4 flex flex-col gap-3.5"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    
                    {/* Search input */}
                    <div className="relative">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search facility name, material (e.g. PCB, copper, battery), or area..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all"
                            style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)' }}
                        />
                    </div>

                    {/* Category Filter Chips */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                        {CATEGORY_OPTIONS.map((cat) => {
                            const Icon = cat.icon;
                            const isSelected = selectedCategory === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                                        isSelected
                                            ? 'shadow-sm'
                                            : 'opacity-70 hover:opacity-100'
                                    }`}
                                    style={{
                                        background: isSelected ? `${cat.color}20` : 'rgba(255,255,255,0.03)',
                                        border: isSelected ? `1px solid ${cat.color}` : '1px solid var(--border)',
                                        color: isSelected ? cat.color : 'var(--text-secondary)',
                                    }}>
                                    <Icon size={12} style={{ color: cat.color }} />
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Radius Slider & Count Stats */}
                    <div className="flex items-center justify-between pt-1 text-xs border-t border-slate-800">
                        <div className="flex items-center gap-2">
                            <Filter size={12} className="text-slate-400" />
                            <span className="text-slate-400 font-medium">Search Radius:</span>
                            {[15, 35, 75].map((r) => (
                                <button
                                    key={r}
                                    onClick={() => setRadiusKm(r)}
                                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                        radiusKm === r
                                            ? 'bg-lime-500/20 text-lime-400 border border-lime-500/40'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}>
                                    {r} km
                                </button>
                            ))}
                        </div>

                        <div className="text-slate-400 font-mono text-[11px]">
                            Showing <strong className="text-white font-bold">{filteredPoints.length}</strong> centers
                        </div>
                    </div>
                </div>

                {/* List of Facilities */}
                {geoState === 'loading' ? (
                    <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <Loader2 size={28} className="animate-spin text-lime-400" />
                        <p className="text-sm font-semibold text-white">Updating nearby drop-off points…</p>
                        <p className="text-xs text-slate-400">Verifying CPCB registry & OpenStreetMap coordinates</p>
                    </div>
                ) : filteredPoints.length === 0 ? (
                    <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <MapPin size={32} className="text-slate-600" />
                        <p className="text-base font-bold text-white">No facilities found in this range</p>
                        <p className="text-xs text-slate-400 max-w-sm">
                            Try expanding your search radius to 75 km or switch to a major metro hub like Delhi NCR or Bengaluru.
                        </p>
                        <button
                            onClick={() => { setRadiusKm(75); setSelectedCategory('all'); setSearchQuery(''); }}
                            className="mt-2 px-4 py-2 rounded-xl text-xs font-bold bg-lime-500 text-slate-950">
                            Reset Filters & Expand Radius
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {filteredPoints.map((point, index) => (
                            <div
                                key={point.id}
                                className="rounded-2xl p-4 lg:p-5 flex flex-col gap-3 transition-all hover:border-slate-700"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 mt-0.5"
                                            style={{
                                                background: point.verifiedCpcb ? 'rgba(132,204,22,0.15)' : 'rgba(56,189,248,0.15)',
                                                color: point.verifiedCpcb ? '#84cc16' : '#38bdf8',
                                                border: point.verifiedCpcb ? '1px solid rgba(132,204,22,0.3)' : '1px solid rgba(56,189,248,0.3)',
                                            }}>
                                            {index + 1}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-sm lg:text-base font-bold text-white">
                                                    {point.name}
                                                </h3>
                                                {point.verifiedCpcb && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-lime-500/10 text-lime-400 border border-lime-500/20">
                                                        <CheckCircle2 size={10} /> CPCB Authorised
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {point.address}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Distance & Action */}
                                    <div className="text-right shrink-0">
                                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 border border-slate-700 text-lime-400">
                                            <Navigation size={10} />
                                            {point.distKm !== undefined ? `${point.distKm} km` : '—'}
                                        </div>
                                    </div>
                                </div>

                                {/* Accepted Materials Chips */}
                                {point.acceptedMaterials && point.acceptedMaterials.length > 0 && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Accepts:</span>
                                        {point.acceptedMaterials.map((mat) => (
                                            <span
                                                key={mat}
                                                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-900/80 text-slate-300 border border-slate-800">
                                                {mat}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Bottom Info Row & Action Button */}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs flex-wrap gap-2">
                                    <div className="flex items-center gap-4 text-slate-400 text-[11px]">
                                        {point.timings && (
                                            <span className="flex items-center gap-1">
                                                <Clock size={11} className="text-slate-400" />
                                                {point.timings}
                                            </span>
                                        )}
                                        {point.phone && (
                                            <a href={`tel:${point.phone}`} className="flex items-center gap-1 text-slate-300 hover:text-lime-400 transition-colors">
                                                <Phone size={11} className="text-lime-400" />
                                                {point.phone}
                                            </a>
                                        )}
                                    </div>

                                    <a
                                        href={mapsUrl(point.lat, point.lon, point.name)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-lime-500 text-slate-950 hover:bg-lime-400 transition-all active:scale-95 shadow-sm">
                                        Directions <ExternalLink size={11} />
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <BottomNav />
        </div>
    );
}
