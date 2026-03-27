"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronLeft,
  Leaf,
  LocateFixed,
  MapPin,
  Navigation,
  Route,
  TrendingDown,
} from "lucide-react";
import { useAuth } from "@/lib/authContext";
import BottomNav from "@/components/BottomNav";
import type { HackathonWasteCategory } from "@/types";
import {
  buildGoogleMapsRouteUrl,
  COLLECTION_THRESHOLD_PCT,
  isLocated,
  planCollectionRoute,
  type RoutePlan,
  type RoutePoint,
  type RoutableBin,
} from "@/lib/routeOptimization";

interface Bin extends RoutableBin {
  wasteCategory: HackathonWasteCategory;
  temperature: number | null;
  humidity: number | null;
  lastSeen: string;
  needsCollection: boolean;
  urgent: boolean;
}

const WASTE_CATEGORY_OPTIONS: Array<{
  value: HackathonWasteCategory;
  label: string;
  color: string;
}> = [
    { value: "recyclable", label: "Recyclable", color: "#3B82F6" },
    { value: "biodegradable", label: "Biodegradable", color: "#22C55E" },
    { value: "hazardous", label: "Hazardous", color: "#EF4444" },
  ];

function wasteCategoryColor(category: HackathonWasteCategory) {
  return (
    WASTE_CATEGORY_OPTIONS.find((option) => option.value === category)?.color ??
    "#3B82F6"
  );
}

type LeafletMapHandle = {
  remove: () => void;
};

type LeafletContainer = HTMLDivElement & {
  _leaflet_id?: number | null;
};

function fillColor(pct: number) {
  if (pct >= COLLECTION_THRESHOLD_PCT) return "#F87171";
  if (pct >= 60) return "#FB923C";
  if (pct >= 40) return "#FCD34D";
  return "#4ADE80";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function formatDistance(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return `${hours}h ${remainingMinutes}m`;
}

function stopLookupFromPlan(routePlan: RoutePlan<Bin> | null) {
  return new Map(
    routePlan?.stops.map((stop) => [stop.bin.deviceId, stop]) ?? [],
  );
}

export default function RoutesPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [bins, setBins] = useState<Bin[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [savingCategoryId, setSavingCategoryId] = useState("");
  const [driverOrigin, setDriverOrigin] = useState<RoutePoint | null>(null);
  const [locatingDriver, setLocatingDriver] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<LeafletMapHandle | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || user.isAnonymous) {
      router.replace("/dashboard");
      return;
    }
    if (!profile?.orgId) {
      router.replace("/dashboard");
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!user || loading) return;
    const currentUser = user;

    async function load() {
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch("/api/org/devices/locations", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setBins(json.bins ?? []);
      } catch (fetchError) {
        setError(String(fetchError));
      } finally {
        setFetching(false);
      }
    }

    load();
  }, [user, loading]);

  const binsWithLocation = bins.filter((bin) =>
    isLocated({ latitude: bin.latitude, longitude: bin.longitude }),
  );
  const collectionBins = bins.filter((bin) => bin.needsCollection);
  const unlocatedCollectionBins = collectionBins.filter(
    (bin) => !isLocated({ latitude: bin.latitude, longitude: bin.longitude }),
  );
  const routePlan = planCollectionRoute(bins, { origin: driverOrigin });
  const routeLookup = stopLookupFromPlan(routePlan);
  const optimizedRouteUrl = routePlan
    ? buildGoogleMapsRouteUrl(
      routePlan.stops.map((stop) => stop.bin),
      routePlan.origin,
    )
    : null;

  useEffect(() => {
    if (fetching || !mapRef.current) return;

    let isMounted = true;
    const routePlanForMap = planCollectionRoute(bins, { origin: driverOrigin });
    const routeLookupForMap = stopLookupFromPlan(routePlanForMap);
    const binsWithLocationForMap = bins.filter((bin) =>
      isLocated({ latitude: bin.latitude, longitude: bin.longitude }),
    );

    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }

    import("leaflet").then((L) => {
      if (!isMounted || !mapRef.current) return;

      const container = mapRef.current as LeafletContainer | null;
      if (container && container._leaflet_id) {
        container._leaflet_id = null;
        container.innerHTML = "";
      }

      delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })
        ._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current);
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
          subdomains: "abcd",
          maxZoom: 20,
        },
      ).addTo(map);

      const routeLatLngs: [number, number][] = [];
      if (routePlanForMap?.origin) {
        routeLatLngs.push([
          routePlanForMap.origin.latitude,
          routePlanForMap.origin.longitude,
        ]);
      }
      routePlanForMap?.stops.forEach((stop) => {
        routeLatLngs.push([stop.bin.latitude!, stop.bin.longitude!]);
      });

      if (routeLatLngs.length > 1) {
        L.polyline(routeLatLngs, {
          color: "#38BDF8",
          weight: 4,
          opacity: 0.85,
          dashArray: "8 8",
        }).addTo(map);
      }

      if (routePlanForMap?.origin) {
        const startMarker = L.divIcon({
          className: "",
          html: `
                        <div style="width:40px;height:40px;border-radius:20px;background:#0f172a;border:3px solid #38BDF8;display:flex;align-items:center;justify-content:center;color:#38BDF8;font-weight:800;box-shadow:0 10px 25px rgba(15,23,42,0.35)">
                            S
                        </div>
                    `,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });
        L.marker(
          [routePlanForMap.origin.latitude, routePlanForMap.origin.longitude],
          { icon: startMarker },
        )
          .addTo(map)
          .bindPopup(
            "<b>Driver start</b><br/>Using live browser GPS as route origin.",
          );
      }

      binsWithLocationForMap.forEach((bin) => {
        const color = fillColor(bin.fillPct);
        const stop = routeLookupForMap.get(bin.deviceId);
        const icon = stop
          ? L.divIcon({
            className: "",
            html: `
                            <div style="width:40px;height:40px;border-radius:20px;background:#0f172a;border:3px solid ${color};display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:800;box-shadow:0 10px 25px rgba(15,23,42,0.35)">
                                ${stop.order}
                            </div>
                        `,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          })
          : L.divIcon({
            className: "",
            html: `
                            <div style="background:${color};width:32px;height:32px;border-radius:16px;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#0f172a;box-shadow:0 10px 25px rgba(15,23,42,0.25)">
                                ${bin.fillPct}%
                            </div>
                        `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });

        const routeDetails = stop
          ? `<br/>Stop #${stop.order} · Leg ${formatDistance(stop.legDistanceKm)}`
          : "";

        L.marker([bin.latitude!, bin.longitude!], { icon }).addTo(map)
          .bindPopup(`
                        <b>${bin.displayName}</b><br/>
                        Stream: <b style="color:${wasteCategoryColor(bin.wasteCategory)}">${bin.wasteCategory}</b><br/>
                        Fill: <b style="color:${color}">${bin.fillPct}%</b><br/>
                        ${bin.needsCollection ? `Ready for pickup (${COLLECTION_THRESHOLD_PCT}%+)` : "Monitoring only"}<br/>
                        Last seen: ${timeAgo(bin.lastSeen)}
                        ${routeDetails}
                    `);
      });

      if (routeLatLngs.length > 0) {
        map.fitBounds(routeLatLngs, { padding: [36, 36] });
      } else if (binsWithLocationForMap.length > 0) {
        map.fitBounds(
          binsWithLocationForMap.map(
            (bin) => [bin.latitude!, bin.longitude!] as [number, number],
          ),
          { padding: [36, 36] },
        );
      } else {
        map.setView([20.5937, 78.9629], 5);
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
  }, [bins, driverOrigin, fetching]);

  async function handleSetLocation(deviceId: string) {
    setSavingId(deviceId);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
        }),
      );
      const { latitude, longitude } = pos.coords;
      const token = await user!.getIdToken();
      const res = await fetch("/api/org/devices/locations", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceId, latitude, longitude }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBins((prev) =>
        prev.map((bin) =>
          bin.deviceId === deviceId ? { ...bin, latitude, longitude } : bin,
        ),
      );
    } catch (locationError) {
      alert(`Could not set location: ${locationError}`);
    } finally {
      setSavingId("");
    }
  }

  async function handleUseMyLocation() {
    setLocatingDriver(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        }),
      );
      setDriverOrigin({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch (locationError) {
      alert(`Could not read driver GPS: ${locationError}`);
    } finally {
      setLocatingDriver(false);
    }
  }

  function handleOpenRoute() {
    if (!optimizedRouteUrl) {
      alert(
        "No optimized route is available yet. Set locations on collection bins first.",
      );
      return;
    }
    window.open(optimizedRouteUrl, "_blank", "noopener,noreferrer");
  }

  const locatedCount = binsWithLocation.length;

  async function handleSetWasteCategory(
    deviceId: string,
    wasteCategory: HackathonWasteCategory,
  ) {
    setSavingCategoryId(deviceId);
    try {
      const token = await user!.getIdToken();
      const res = await fetch("/api/org/devices/locations", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceId, wasteCategory }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBins((prev) =>
        prev.map((bin) =>
          bin.deviceId === deviceId ? { ...bin, wasteCategory } : bin,
        ),
      );
    } catch (categoryError) {
      alert(`Could not save waste category: ${categoryError}`);
    } finally {
      setSavingCategoryId("");
    }
  }

  if (loading || fetching) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-primary)" }}
      >
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--border)", borderTopColor: "#84cc16" }}
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-32 lg:pb-10"
      style={{ background: "var(--bg-primary)" }}
    >
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />

      <div className="safe-top px-5 pt-6 pb-5 lg:px-10 lg:pt-10 lg:pb-8 bg-grid">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <ChevronLeft size={16} style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <Route size={14} style={{ color: "#38BDF8" }} />
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-dim)" }}
          >
            Fleet Optimization
          </span>
        </div>
        <h1
          className="text-2xl font-bold text-white"
          style={{ fontFamily: "Space Grotesk" }}
        >
          Collection Routes
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-dim)" }}>
          {collectionBins.length} bins at {COLLECTION_THRESHOLD_PCT}%+ fill ·{" "}
          {locatedCount}/{bins.length} located
        </p>
      </div>

      <div className="px-5 lg:px-10 flex flex-col gap-4 max-w-5xl">
        {error && (
          <div
            className="card p-3 text-sm"
            style={{ color: "#fca5a5", borderColor: "rgba(239,68,68,0.35)" }}
          >
            {error}
          </div>
        )}

        <div className="card p-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} style={{ color: "#FB923C" }} />
                <span className="text-sm font-semibold text-white">
                  {collectionBins.length} bins are ready for collection
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Nearest-neighbor planning starts from{" "}
                {routePlan?.startLabel.toLowerCase() ?? "the fullest bin"}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleUseMyLocation}
                disabled={locatingDriver}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                <LocateFixed size={13} />
                {locatingDriver
                  ? "Reading GPS..."
                  : driverOrigin
                    ? "Refresh Driver Start"
                    : "Use My Location"}
              </button>
              {driverOrigin && (
                <button
                  onClick={() => setDriverOrigin(null)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Clear Start
                </button>
              )}
              <button
                onClick={handleOpenRoute}
                disabled={!routePlan}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40"
                style={{
                  background: "var(--lime-glow)",
                  border: "1px solid var(--lime-border)",
                  color: "var(--lime)",
                }}
              >
                <Navigation size={14} />
                Open Optimized Route
              </button>
            </div>
          </div>

          {driverOrigin && (
            <p className="text-xs font-mono" style={{ color: "#38BDF8" }}>
              Driver start: {driverOrigin.latitude.toFixed(5)},{" "}
              {driverOrigin.longitude.toFixed(5)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4 min-h-[160px] flex flex-col justify-between">
            <p
              className="text-[11px] uppercase tracking-wider"
              style={{ color: "var(--text-dim)" }}
            >
              Stops
            </p>
            <div>
              <p
                className="text-2xl font-bold text-white mt-2"
                style={{ fontFamily: "Space Grotesk" }}
              >
                {routePlan?.candidateCount ?? 0}
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-secondary)" }}
              >
                collection-ready bins with GPS
              </p>
            </div>
          </div>
          <div className="card p-4 min-h-[160px] flex flex-col justify-between">
            <p
              className="text-[11px] uppercase tracking-wider"
              style={{ color: "var(--text-dim)" }}
            >
              Optimized Distance
            </p>
            <div>
              <p
                className="text-2xl font-bold text-white mt-2"
                style={{ fontFamily: "Space Grotesk" }}
              >
                {routePlan
                  ? formatDistance(routePlan.optimizedDistanceKm)
                  : "0 km"}
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-secondary)" }}
              >
                greedy nearest-neighbor route
              </p>
            </div>
          </div>
          <div className="card p-4 min-h-[160px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown size={13} style={{ color: "#4ADE80" }} />
              <p
                className="text-[11px] uppercase tracking-wider"
                style={{ color: "var(--text-dim)" }}
              >
                Distance Saved
              </p>
            </div>
            <div>
              <p
                className="text-2xl font-bold text-white mt-2"
                style={{ fontFamily: "Space Grotesk" }}
              >
                {routePlan ? formatDistance(routePlan.distanceSavedKm) : "0 km"}
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-secondary)" }}
              >
                vs current urgency-sorted order
              </p>
            </div>
          </div>
          <div className="card p-4 min-h-[160px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <Leaf size={13} style={{ color: "#4ADE80" }} />
              <p
                className="text-[11px] uppercase tracking-wider"
                style={{ color: "var(--text-dim)" }}
              >
                CO2 Impact
              </p>
            </div>
            <div>
              <p
                className="text-2xl font-bold text-white mt-2"
                style={{ fontFamily: "Space Grotesk" }}
              >
                {routePlan ? `${routePlan.co2SavedKg.toFixed(2)} kg` : "0 kg"}
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-secondary)" }}
              >
                est.{" "}
                {routePlan
                  ? formatDuration(routePlan.estimatedDurationMin)
                  : "0 min"}{" "}
                collection window
              </p>
            </div>
          </div>
        </div>

        {unlocatedCollectionBins.length > 0 && (
          <div
            className="card p-4 flex flex-col gap-2"
            style={{
              borderColor: "rgba(251,146,60,0.35)",
              background: "rgba(251,146,60,0.06)",
            }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} style={{ color: "#FB923C" }} />
              <p className="text-sm font-semibold text-white">
                {unlocatedCollectionBins.length} collection bin
                {unlocatedCollectionBins.length === 1 ? "" : "s"} missing GPS
              </p>
            </div>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Add bin coordinates to include them in the optimized route.
            </p>
          </div>
        )}

        <div
          className="card overflow-hidden mb-3 sm:mb-0 h-[280px] sm:h-[320px] lg:h-[360px]"
          style={{ position: "relative", isolation: "isolate" }}
        >
          {locatedCount === 0 && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-2"
              style={{ background: "var(--bg-card)" }}
            >
              <MapPin size={32} style={{ color: "var(--text-muted)" }} />
              <p className="text-sm text-white font-semibold">
                No bin locations set yet
              </p>
              <p
                className="text-xs text-center px-6"
                style={{ color: "var(--text-dim)" }}
              >
                Use the location action on each device card to place bins on the
                map before planning a route.
              </p>
            </div>
          )}
          <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
        </div>

        <div
          className="flex gap-4 flex-wrap text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: "#38BDF8" }}
            />
            <span>Optimized path</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: "#F87171" }}
            />
            <span>{COLLECTION_THRESHOLD_PCT}%+ fill</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: "#FB923C" }}
            />
            <span>60 to 79%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: "#4ADE80" }}
            />
            <span>Below 60%</span>
          </div>
        </div>

        <div className="card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">
                Optimized Pickup Order
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-secondary)" }}
              >
                Stops are sequenced by nearest-neighbor distance from the
                selected origin.
              </p>
            </div>
            {routePlan && (
              <p className="text-xs font-mono" style={{ color: "#38BDF8" }}>
                baseline {formatDistance(routePlan.baselineDistanceKm)}
              </p>
            )}
          </div>

          {!routePlan ? (
            <div
              className="rounded-2xl p-4"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
              }}
            >
              <p className="text-sm text-white">No optimized route yet.</p>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-secondary)" }}
              >
                You need at least one collection-ready bin with saved GPS
                coordinates.
              </p>
            </div>
          ) : (
            routePlan.stops.map((stop) => (
              <div
                key={stop.bin.deviceId}
                className="rounded-2xl p-4 flex flex-col gap-3"
                style={{
                  background: "var(--bg-elevated)",
                  border: `1px solid ${fillColor(stop.bin.fillPct)}33`,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          background: "#38BDF818",
                          border: "1px solid #38BDF855",
                          color: "#38BDF8",
                        }}
                      >
                        {stop.order}
                      </div>
                      <p className="text-sm font-semibold text-white truncate">
                        {stop.bin.displayName}
                      </p>
                    </div>
                    <p
                      className="text-[11px] font-mono mt-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {stop.bin.latitude!.toFixed(5)},{" "}
                      {stop.bin.longitude!.toFixed(5)}
                    </p>
                  </div>
                  <div
                    className="px-3 py-1 rounded-full text-xs font-bold shrink-0"
                    style={{
                      background: `${fillColor(stop.bin.fillPct)}18`,
                      color: fillColor(stop.bin.fillPct),
                    }}
                  >
                    {stop.bin.fillPct}%
                  </div>
                </div>
                <div
                  className="grid sm:grid-cols-3 gap-2 text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <div>
                    Stream:{" "}
                    <span style={{ color: wasteCategoryColor(stop.bin.wasteCategory) }}>
                      {stop.bin.wasteCategory}
                    </span>
                  </div>
                  <div>Leg distance: {formatDistance(stop.legDistanceKm)}</div>
                  <div>
                    Cumulative: {formatDistance(stop.cumulativeDistanceKm)}
                  </div>
                  <div>Last seen: {timeAgo(stop.bin.lastSeen)}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-3">
          {bins.length === 0 && (
            <div className="card p-8 text-center">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                No active devices found. Provision an ESP32 device first.
              </p>
            </div>
          )}
          {bins.map((bin) => {
            const stop = routeLookup.get(bin.deviceId);
            const color = fillColor(bin.fillPct);

            return (
              <div key={bin.deviceId} className="card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <MapPin size={12} style={{ color, flexShrink: 0 }} />
                      <p className="text-sm font-semibold text-white truncate">
                        {bin.displayName}
                      </p>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                        style={{
                          background: `${wasteCategoryColor(bin.wasteCategory)}18`,
                          color: wasteCategoryColor(bin.wasteCategory),
                        }}
                      >
                        {bin.wasteCategory.toUpperCase()}
                      </span>
                      {bin.needsCollection && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                          style={{
                            background: "rgba(248,113,113,0.15)",
                            color: "#F87171",
                          }}
                        >
                          READY
                        </span>
                      )}
                      {stop && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                          style={{
                            background: "rgba(56,189,248,0.15)",
                            color: "#38BDF8",
                          }}
                        >
                          STOP {stop.order}
                        </span>
                      )}
                    </div>
                    <p
                      className="text-[10px] font-mono"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {bin.latitude != null
                        ? `${bin.latitude.toFixed(4)}, ${bin.longitude!.toFixed(4)}`
                        : "No location set"}
                      {" · "}
                      {timeAgo(bin.lastSeen)}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-center gap-1">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold"
                      style={{
                        background: `${color}18`,
                        border: `2px solid ${color}`,
                      }}
                    >
                      <span style={{ color }}>{bin.fillPct}%</span>
                    </div>
                    <span
                      className="text-[9px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      fill
                    </span>
                  </div>
                </div>

                <div
                  className="h-2 rounded-full"
                  style={{ background: "var(--border)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${bin.fillPct}%`, background: color }}
                  />
                </div>

                {(bin.temperature != null || bin.humidity != null) && (
                  <div
                    className="flex gap-4 text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {bin.temperature != null && (
                      <span>Temp {bin.temperature}°C</span>
                    )}
                    {bin.humidity != null && (
                      <span>Humidity {bin.humidity}%</span>
                    )}
                  </div>
                )}

                <label
                  className="flex flex-col gap-1.5 text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span>Waste stream</span>
                  <select
                    value={bin.wasteCategory}
                    disabled={savingCategoryId === bin.deviceId}
                    onChange={(event) =>
                      handleSetWasteCategory(
                        bin.deviceId,
                        event.target.value as HackathonWasteCategory,
                      )
                    }
                    className="rounded-xl px-3 py-2 outline-none"
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {WASTE_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  onClick={() => handleSetLocation(bin.deviceId)}
                  disabled={savingId === bin.deviceId}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 self-start"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <LocateFixed size={12} />
                  {savingId === bin.deviceId
                    ? "Getting GPS..."
                    : bin.latitude != null
                      ? "Update Bin Location"
                      : "Set Bin Location"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
