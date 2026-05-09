import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy route for Overpass API (OpenStreetMap).
 *
 * Why this exists:
 * Overpass API (overpass-api.de) does not send Access-Control-Allow-Origin headers,
 * so browsers block direct fetch calls from the frontend (CORS policy).
 * This server-side proxy tries multiple mirrors in parallel and returns the
 * first successful response.
 *
 * Usage from frontend:
 *   const res = await fetch(`/api/overpass?data=<encoded_overpass_query>`);
 */

// Public Overpass mirrors — tried in parallel, first success wins
const MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

const HEADERS = {
  "User-Agent": "AIEcoTracker/1.0 (aiecotracker.vercel.app)",
  Accept: "application/json",
};

/** Fetch from a single mirror with a manual timeout (avoids AbortSignal.timeout compat issues) */
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
      { error: "Missing required 'data' query parameter." },
      { status: 400 }
    );
  }

  // Race all mirrors in parallel — first successful response wins
  let json: unknown = null;
  let lastError = "All Overpass mirrors failed";

  try {
    const response = await Promise.any(
      MIRRORS.map((mirror) => fetchMirror(mirror, data, 9000))
    );
    json = await response.json();
  } catch (err) {
    if (err instanceof AggregateError) {
      lastError = err.errors.map((e: Error) => e.message).join(" | ");
    } else if (err instanceof Error) {
      lastError = err.message;
    }
    console.error("[overpass proxy] all mirrors failed:", lastError);

    return NextResponse.json(
      { error: "All Overpass mirrors failed.", details: lastError },
      { status: 502 }
    );
  }

  return NextResponse.json(json);
}
