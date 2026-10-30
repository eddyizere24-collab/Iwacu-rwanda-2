import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabasePublicClient, isSupabasePublicConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BboxSchema = z.object({
  west: z.coerce.number().min(28).max(32),
  south: z.coerce.number().min(-4).max(0),
  east: z.coerce.number().min(28).max(32),
  north: z.coerce.number().min(-4).max(0),
});

type Position = number[];
type PolygonGeometry = { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
type BoundaryRow = {
  scope_code: string;
  name_kiny: string;
  name_eng: string | null;
  level: string;
  geom: unknown;
};

function simplifyRing(value: unknown, tolerance: number): Position[] {
  if (!Array.isArray(value)) return [];
  const points = value.filter((point): point is Position =>
    Array.isArray(point) && point.length >= 2 &&
    Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]))
  );
  if (points.length <= 4) return points;
  const result: Position[] = [points[0]];
  let previous = points[0];
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    if (Math.hypot(Number(point[0]) - Number(previous[0]), Number(point[1]) - Number(previous[1])) >= tolerance) {
      result.push(point);
      previous = point;
    }
  }
  result.push(points[points.length - 1]);
  return result.length < 4 ? points : result;
}

function simplifyGeometry(raw: unknown, tolerance: number): PolygonGeometry | null {
  let value = raw;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return null; }
  }
  if (!value || typeof value !== "object") return null;
  const geometry = value as { type?: unknown; coordinates?: unknown };
  if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
    return { type: "Polygon", coordinates: geometry.coordinates.map((ring) => simplifyRing(ring, tolerance)) };
  }
  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    return {
      type: "MultiPolygon",
      coordinates: geometry.coordinates.map((polygon) =>
        Array.isArray(polygon) ? polygon.map((ring) => simplifyRing(ring, tolerance)) : []
      ),
    };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const parsed = BboxSchema.safeParse({
    west: req.nextUrl.searchParams.get("west"),
    south: req.nextUrl.searchParams.get("south"),
    east: req.nextUrl.searchParams.get("east"),
    north: req.nextUrl.searchParams.get("north"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Rwanda map bounds." }, { status: 400 });
  }

  const { west, south, east, north } = parsed.data;
  if (west >= east || south >= north || east - west > 1.8 || north - south > 1.8) {
    return NextResponse.json({ error: "Map bounds are too large or inverted." }, { status: 400 });
  }
  if (!isSupabasePublicConfigured()) {
    return NextResponse.json({ error: "Database map boundaries are unavailable." }, { status: 503 });
  }

  const envelope = `SRID=4326;POLYGON((${west} ${south},${east} ${south},${east} ${north},${west} ${north},${west} ${south}))`;
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase.from("boundaries")
    .select("scope_code, name_kiny, name_eng, level, geom")
    .eq("level", "village")
    .is("valid_to", null)
    .filter("geom", "st_intersects", envelope)
    .order("scope_code", { ascending: true })
    .limit(120);

  if (error) {
    console.error("[location-map] bbox query failed:", error.message);
    return NextResponse.json({ error: "Village boundary query is unavailable." }, { status: 503 });
  }

  const tolerance = Math.max(0.00005, Math.min(0.0005, Math.max(east - west, north - south) / 1_000));
  const features = ((data ?? []) as BoundaryRow[]).flatMap((row) => {
    // /api/locate uses boundaries.scope_code as the village ID. Keep that ID unchanged.
    if (row.level !== "village" || !row.scope_code || !row.name_kiny) return [];
    const geometry = simplifyGeometry(row.geom, tolerance);
    if (!geometry) return [];
    return [{
      type: "Feature" as const,
      id: row.scope_code,
      properties: { scope_code: row.scope_code, village: row.name_kiny, name_eng: row.name_eng, level: "village" },
      geometry,
    }];
  });

  return NextResponse.json({
    type: "FeatureCollection",
    features,
    source: "supabase-boundaries",
    simplified: true,
    tolerance_degrees: tolerance,
  }, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
