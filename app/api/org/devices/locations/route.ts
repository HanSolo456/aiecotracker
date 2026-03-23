import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { initializeAdmin } from "@/lib/firebaseAdmin";
import { requireUserProfile } from "@/lib/apiAuth";
import { COLLECTION_THRESHOLD_PCT } from "@/lib/routeOptimization";
import type { HackathonWasteCategory } from "@/types";

const VALID_WASTE_CATEGORIES = new Set<HackathonWasteCategory>([
  "biodegradable",
  "recyclable",
  "hazardous",
]);

// GET — returns all org devices with their last known location + latest fill level
export async function GET(req: NextRequest) {
  try {
    const profile = await requireUserProfile(req);
    if (!profile.orgId) {
      return NextResponse.json(
        { error: "Not linked to an org" },
        { status: 403 },
      );
    }

    initializeAdmin();
    const db = getFirestore();

    // Get all active ESP32 gateway devices for this org (collection bins only)
    const devicesSnap = await db
      .collection("devices")
      .where("orgId", "==", profile.orgId)
      .where("status", "==", "active")
      .where("deviceType", "==", "esp32_gateway")
      .get();

    // Get latest sensor readings (up to 100)
    const sensorSnap = await db
      .collection("sensor_readings")
      .where("orgId", "==", profile.orgId)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    // Build fill level map: deviceId → latest reading
    const latestFill: Record<
      string,
      {
        fillPct: number;
        temperature?: number;
        humidity?: number;
        lastSeen: string;
      }
    > = {};
    for (const doc of sensorSnap.docs) {
      const d = doc.data();
      const id = d.deviceId as string;
      if (!latestFill[id]) {
        latestFill[id] = {
          fillPct: d.fillPercentage ?? d.fill_pct ?? 0,
          temperature: d.temperature,
          humidity: d.humidity,
          lastSeen:
            d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        };
      }
    }

    const bins = devicesSnap.docs
      .map((doc) => {
        const d = doc.data();
        const fill = latestFill[doc.id] ?? {
          fillPct: 0,
          lastSeen: new Date().toISOString(),
        };
        return {
          deviceId: doc.id,
          displayName: d.displayName ?? doc.id,
          latitude: d.latitude ?? null,
          longitude: d.longitude ?? null,
          wasteCategory: d.wasteCategory ?? "recyclable",
          fillPct: fill.fillPct,
          temperature: fill.temperature ?? null,
          humidity: fill.humidity ?? null,
          lastSeen: fill.lastSeen,
          needsCollection: fill.fillPct >= COLLECTION_THRESHOLD_PCT,
          urgent: fill.fillPct >= COLLECTION_THRESHOLD_PCT,
        };
      })
      .sort(
        (a, b) =>
          Number(b.needsCollection) - Number(a.needsCollection) ||
          b.fillPct - a.fillPct ||
          a.displayName.localeCompare(b.displayName),
      );

    return NextResponse.json({ bins });
  } catch (err) {
    if (String(err).includes("MISSING_BEARER")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[devices/locations] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH — save lat/lng for a single device
export async function PATCH(req: NextRequest) {
  try {
    const profile = await requireUserProfile(req);
    if (!profile.orgId) {
      return NextResponse.json(
        { error: "Not linked to an org" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { deviceId, latitude, longitude, wasteCategory } = body;

    if (!deviceId) {
      return NextResponse.json(
        { error: "deviceId is required" },
        { status: 400 },
      );
    }

    const hasCoordinates = latitude != null && longitude != null;
    const hasWasteCategory = wasteCategory != null;

    if (!hasCoordinates && !hasWasteCategory) {
      return NextResponse.json(
        { error: "Provide latitude/longitude and/or wasteCategory" },
        { status: 400 },
      );
    }

    if (
      hasWasteCategory &&
      !VALID_WASTE_CATEGORIES.has(wasteCategory as HackathonWasteCategory)
    ) {
      return NextResponse.json(
        { error: "Invalid wasteCategory" },
        { status: 400 },
      );
    }

    initializeAdmin();
    const db = getFirestore();
    const ref = db.collection("devices").doc(deviceId as string);
    const snap = await ref.get();

    if (!snap.exists || snap.data()?.orgId !== profile.orgId) {
      return NextResponse.json(
        { error: "Device not found or not yours" },
        { status: 404 },
      );
    }

    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (hasCoordinates) {
      updatePayload.latitude = latitude;
      updatePayload.longitude = longitude;
    }
    if (hasWasteCategory) {
      updatePayload.wasteCategory = wasteCategory;
    }

    await ref.update(updatePayload);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (String(err).includes("MISSING_BEARER")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[devices/locations PATCH] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
