export const COLLECTION_THRESHOLD_PCT = 80;
export const ESTIMATED_VAN_EMISSIONS_KG_PER_KM = 0.21;
export const ESTIMATED_AVERAGE_SPEED_KMH = 24;
export const ESTIMATED_SERVICE_TIME_PER_STOP_MIN = 4;

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface RoutableBin {
  deviceId: string;
  displayName: string;
  latitude: number | null;
  longitude: number | null;
  fillPct: number;
  needsCollection?: boolean;
  urgent?: boolean;
}

export interface RouteStop<TBin extends RoutableBin = RoutableBin> {
  bin: TBin;
  order: number;
  legDistanceKm: number;
  cumulativeDistanceKm: number;
}

export interface RoutePlan<TBin extends RoutableBin = RoutableBin> {
  origin: RoutePoint | null;
  startLabel: string;
  stops: RouteStop<TBin>[];
  optimizedDistanceKm: number;
  baselineDistanceKm: number;
  distanceSavedKm: number;
  co2SavedKg: number;
  estimatedDurationMin: number;
  candidateCount: number;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function isLocated(
  point:
    | {
        latitude?: number | null;
        longitude?: number | null;
      }
    | null
    | undefined,
): point is RoutePoint {
  return (
    point != null &&
    typeof point.latitude === "number" &&
    Number.isFinite(point.latitude) &&
    typeof point.longitude === "number" &&
    Number.isFinite(point.longitude)
  );
}

export function shouldCollectBin(bin: RoutableBin) {
  return Boolean(
    bin.needsCollection ??
    bin.urgent ??
    bin.fillPct >= COLLECTION_THRESHOLD_PCT,
  );
}

export function haversineDistanceKm(start: RoutePoint, end: RoutePoint) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(end.latitude - start.latitude);
  const dLng = toRadians(end.longitude - start.longitude);
  const lat1 = toRadians(start.latitude);
  const lat2 = toRadians(end.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function toPoint(bin: RoutableBin): RoutePoint {
  return {
    latitude: bin.latitude!,
    longitude: bin.longitude!,
  };
}

function buildStops<TBin extends RoutableBin>(
  bins: TBin[],
  origin: RoutePoint | null,
) {
  const stops: RouteStop<TBin>[] = [];
  let cumulativeDistanceKm = 0;
  let previousPoint = origin;

  bins.forEach((bin, index) => {
    const currentPoint = toPoint(bin);
    const legDistanceKm = previousPoint
      ? haversineDistanceKm(previousPoint, currentPoint)
      : 0;
    cumulativeDistanceKm += legDistanceKm;

    stops.push({
      bin,
      order: index + 1,
      legDistanceKm,
      cumulativeDistanceKm,
    });

    previousPoint = currentPoint;
  });

  return {
    stops,
    totalDistanceKm: cumulativeDistanceKm,
  };
}

function sortBySeed<TBin extends RoutableBin>(bins: TBin[]) {
  return [...bins].sort((left, right) => {
    if (right.fillPct !== left.fillPct) {
      return right.fillPct - left.fillPct;
    }
    return left.displayName.localeCompare(right.displayName);
  });
}

function buildNearestNeighborOrder<TBin extends RoutableBin>(
  bins: TBin[],
  origin: RoutePoint | null,
) {
  const remaining = sortBySeed(bins);
  const ordered: TBin[] = [];
  let previousPoint = origin;

  while (remaining.length > 0) {
    let nextIndex = 0;

    if (previousPoint) {
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < remaining.length; index += 1) {
        const distance = haversineDistanceKm(
          previousPoint,
          toPoint(remaining[index]),
        );
        if (distance < bestDistance) {
          bestDistance = distance;
          nextIndex = index;
        }
      }
    }

    const [nextBin] = remaining.splice(nextIndex, 1);
    ordered.push(nextBin);
    previousPoint = toPoint(nextBin);
  }

  return ordered;
}

export function planCollectionRoute<TBin extends RoutableBin>(
  bins: TBin[],
  options?: { origin?: RoutePoint | null },
): RoutePlan<TBin> | null {
  const origin =
    options?.origin && isLocated(options.origin) ? options.origin : null;
  const candidates = bins.filter(
    (bin) =>
      shouldCollectBin(bin) &&
      isLocated({ latitude: bin.latitude, longitude: bin.longitude }),
  );

  if (candidates.length === 0) {
    return null;
  }

  const optimizedOrder = buildNearestNeighborOrder(candidates, origin);
  const baselineOrder = [...candidates];
  const optimized = buildStops(optimizedOrder, origin);
  const baseline = buildStops(baselineOrder, origin);
  const distanceSavedKm = Math.max(
    0,
    baseline.totalDistanceKm - optimized.totalDistanceKm,
  );

  return {
    origin,
    startLabel: origin ? "Driver GPS" : "Fullest bin",
    stops: optimized.stops,
    optimizedDistanceKm: optimized.totalDistanceKm,
    baselineDistanceKm: baseline.totalDistanceKm,
    distanceSavedKm,
    co2SavedKg: distanceSavedKm * ESTIMATED_VAN_EMISSIONS_KG_PER_KM,
    estimatedDurationMin:
      (optimized.totalDistanceKm / ESTIMATED_AVERAGE_SPEED_KMH) * 60 +
      optimized.stops.length * ESTIMATED_SERVICE_TIME_PER_STOP_MIN,
    candidateCount: candidates.length,
  };
}

export function buildGoogleMapsRouteUrl<TBin extends RoutableBin>(
  stops: TBin[],
  origin?: RoutePoint | null,
) {
  if (stops.length === 0) {
    return null;
  }

  const coords = stops.map((bin) => `${bin.latitude},${bin.longitude}`);
  const destination = coords[coords.length - 1];
  const routeOrigin = origin
    ? `${origin.latitude},${origin.longitude}`
    : coords[0];
  const intermediateStops = origin ? coords : coords.slice(1);
  const waypoints = intermediateStops.slice(0, -1).join("|");
  const params = new URLSearchParams({
    api: "1",
    origin: routeOrigin,
    destination,
    travelmode: "driving",
  });

  if (waypoints) {
    params.set("waypoints", waypoints);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
