import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy route for Overpass API (OpenStreetMap).
 *
 * Why this exists:
 * Overpass API (overpass-api.de) does not send Access-Control-Allow-Origin headers,
 * so browsers block direct fetch calls from the frontend (CORS policy).
 * This server-side proxy forwards the request and returns the result safely.
 *
 * Usage from frontend:
 *   const res = await fetch(`/api/overpass?data=<encoded_overpass_query>`);
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const data = searchParams.get("data");

  if (!data) {
    return NextResponse.json(
      { error: "Missing required 'data' query parameter." },
      { status: 400 }
    );
  }

  const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(data)}`;

  try {
    const response = await fetch(overpassUrl, {
      headers: {
        // Overpass requires a proper User-Agent, browser-sent headers cause 406
        "User-Agent": "AIEcoTracker/1.0 (aiecotracker.vercel.app)",
        Accept: "application/json",
      },
      // 10 second timeout
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Overpass API error: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const json = await response.json();
    return NextResponse.json(json);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[overpass proxy] fetch failed:", message);
    return NextResponse.json(
      { error: "Failed to reach Overpass API.", details: message },
      { status: 502 }
    );
  }
}
