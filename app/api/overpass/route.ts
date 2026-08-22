import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy route for Overpass API (OpenStreetMap).
 *
 * Why this exists:
 * Overpass API servers do not send Access-Control-Allow-Origin headers,
 * so browsers block direct fetch calls from the frontend (CORS policy).
 * This server-side proxy tries multiple reliable mirrors in parallel with
 * in-memory caching and returns clean JSON.
 */

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const HEADERS = {
  "User-Agent": "AIEcoTracker/2.0 (aiecotracker.vercel.app; contact@aiecotracker.app)",
  Accept: "application/json",
};

// Simple LRU/in-memory cache to prevent thrashing public Overpass servers (10 min TTL)
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

/** Fetch from a single mirror with an individual timeout */
async function fetchMirror(
  mirror: string,
  data: string,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(
      `${mirror}?data=${encodeURIComponent(data)}`,
      { headers: HEADERS, signal: controller.signal }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${mirror}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const data = searchParams.get("data");

  if (!data) {
    return NextResponse.json(
      { error: "Missing required 'data' query parameter.", elements: [] },
      { status: 400 }
    );
  }

  // Check cache first
  const cacheKey = data.trim();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data);
  }

  // Race mirrors in parallel with a 6-second timeout for snappy UX
  let json: unknown = null;
  let lastError = "All Overpass mirrors failed";

  try {
    const response = await Promise.any(
      MIRRORS.map((mirror) => fetchMirror(mirror, data, 6500))
    );
    json = await response.json();
    
    // Store in cache
    cache.set(cacheKey, { data: json, expiresAt: Date.now() + CACHE_TTL_MS });
  } catch (err) {
    if (err instanceof AggregateError) {
      lastError = err.errors.map((e: Error) => e.message).join(" | ");
    } else if (err instanceof Error) {
      lastError = err.message;
    }
    console.warn("[overpass proxy] mirrors unavailable or timed out:", lastError);

    // Return empty elements with 200 rather than hard 502 so client can blend offline verified CPCB centers
    return NextResponse.json(
      { elements: [], warning: "Overpass API temporarily unavailable. Using verified directory.", details: lastError },
      { status: 200 }
    );
  }

  return NextResponse.json(json);
}
