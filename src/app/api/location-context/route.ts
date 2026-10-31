import { NextRequest, NextResponse } from "next/server";
import { isLandmarksFeatureEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OverpassElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

type NearbyFeature = {
  id: string;
  name: string | null;
  category: "school" | "clinic" | "market" | "church" | "wetland" | "water" | "lake" | "road" | "other";
  latitude: number;
  longitude: number;
  distance_m: number;
};

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function classify(tags: Record<string, string>): NearbyFeature["category"] | null {
  const amenity = (tags.amenity ?? "").toLowerCase();
  const shop = (tags.shop ?? "").toLowerCase();
  const natural = (tags.natural ?? "").toLowerCase();
  const waterway = (tags.waterway ?? "").toLowerCase();
  const water = (tags.water ?? "").toLowerCase();
  const highway = (tags.highway ?? "").toLowerCase();

  if (amenity === "school" || amenity === "kindergarten" || tags.building === "school") return "school";
  if (["hospital", "clinic", "doctors", "health_post"].includes(amenity)) return "clinic";
  if (["marketplace", "market"].includes(amenity) || ["supermarket", "convenience"].includes(shop)) return "market";
  if (amenity === "place_of_worship") return "church";
  if (natural === "wetland" || tags.landuse === "wetland" || tags.wetland) return "wetland";
  if (water === "lake" || natural === "water" || ["river", "stream", "canal"].includes(waterway)) return water === "lake" ? "lake" : "water";
  if (["primary", "secondary", "trunk"].includes(highway)) return "road";
  return null;
}

/**
 * Returns only features present in OpenStreetMap. Unnamed water/wetland features
 * may be identified by type, but no place name is ever invented.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isLandmarksFeatureEnabled()) {
    return NextResponse.json({ disabled: true, status: "disabled", features: [], source: null }, { status: 200 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid location request." }, { status: 400 });
  }

  const input = body as { latitude?: unknown; longitude?: unknown };
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -3.2 || latitude > -0.7 ||
    longitude < 28.5 || longitude > 31.2
  ) {
    return NextResponse.json({ status: "error", message: "Coordinates outside supported Rwanda area." }, { status: 400 });
  }

  // Round to ~100 m before querying OSM to reduce precision leakage and cache churn.
  const queryLat = Math.round(latitude * 1000) / 1000;
  const queryLon = Math.round(longitude * 1000) / 1000;
  const radiusMeters = 3_000;

  const ql = "[out:json][timeout:10];\n(" +
    "nwr(around:" + radiusMeters + "," + queryLat + "," + queryLon + ")[\"name\"][\"amenity\"~\"school|kindergarten|hospital|clinic|doctors|health_post|marketplace|place_of_worship\"];\n" +
    "nwr(around:" + radiusMeters + "," + queryLat + "," + queryLon + ")[\"name\"][\"shop\"~\"supermarket|convenience\"];\n" +
    "nwr(around:" + radiusMeters + "," + queryLat + "," + queryLon + ")[\"natural\"=\"wetland\"];\n" +
    "nwr(around:" + radiusMeters + "," + queryLat + "," + queryLon + ")[\"landuse\"=\"wetland\"];\n" +
    "nwr(around:" + radiusMeters + "," + queryLat + "," + queryLon + ")[\"natural\"=\"water\"];\n" +
    "nwr(around:" + radiusMeters + "," + queryLat + "," + queryLon + ")[\"waterway\"~\"river|stream|canal\"];\n" +
    "nwr(around:" + radiusMeters + "," + queryLat + "," + queryLon + ")[\"highway\"~\"primary|secondary|trunk\"];\n" +
    ");out center tags 100;";

  const upstreamUrl = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(ql);
  try {
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "IwacuRwanda2/1.0 (location-context; public civic service)",
      },
      cache: "force-cache",
      next: { revalidate: 21_600 },
      signal: AbortSignal.timeout(12_000),
    });
    if (!upstream.ok) {
      return NextResponse.json({
        status: "unavailable",
        message: "OpenStreetMap context service is temporarily unavailable.",
        features: [],
        source: "OpenStreetMap",
      }, {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800" },
      });
    }

    const payload = await upstream.json() as { elements?: OverpassElement[] };
    const seen = new Set<string>();
    const features: NearbyFeature[] = [];
    for (const element of payload.elements ?? []) {
      const tags = element.tags ?? {};
      const category = classify(tags);
      if (!category) continue;
      const point = element.center ?? { lat: element.lat, lon: element.lon };
      const lat = Number(point.lat);
      const lon = Number(point.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const distance = haversineMeters(queryLat, queryLon, lat, lon);
      if (distance > radiusMeters) continue;
      const key = (element.type ?? "item") + ":" + (element.id ?? "");
      if (seen.has(key)) continue;
      seen.add(key);
      const name = typeof tags.name === "string" && tags.name.trim() ? tags.name.trim() : null;
      // Named public landmarks first; unnamed water/wetland features remain
      // visible as verified feature types, never as fabricated names.
      if (!name && !["wetland", "water", "lake"].includes(category)) continue;
      features.push({
        id: key,
        name,
        category,
        latitude: lat,
        longitude: lon,
        distance_m: Math.round(distance),
      });
    }

    const categoryOrder: NearbyFeature["category"][] = [
      "school", "clinic", "market", "church", "wetland", "water", "lake", "road",
    ];
    features.sort((a, b) =>
      a.distance_m - b.distance_m ||
      categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
    );
    return NextResponse.json({
      status: "ok",
      source: "OpenStreetMap",
      queried_radius_m: radiusMeters,
      query_precision_m: 100,
      features: features.slice(0, 30),
    }, {
      headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    console.warn("[location-context] OpenStreetMap query unavailable:", error);
    return NextResponse.json({
      status: "unavailable",
      message: "OpenStreetMap context service is temporarily unavailable.",
      features: [],
      source: "OpenStreetMap",
    }, {
      status: 200,
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800" },
    });
  }
}
