import { NextRequest, NextResponse } from "next/server";
import { getOfficialVillagePolygonsForBbox } from "@/lib/national-boundaries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;
  const west = Number(params.get("west"));
  const south = Number(params.get("south"));
  const east = Number(params.get("east"));
  const north = Number(params.get("north"));

  if (![west, south, east, north].every(Number.isFinite)) {
    return NextResponse.json({ status: "error", message: "Map bounds are required." }, { status: 400 });
  }

  try {
    const featureCollection = await getOfficialVillagePolygonsForBbox(west, south, east, north);
    return NextResponse.json(featureCollection, {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.warn("[location-map] Official boundary overlay unavailable:", error);
    return NextResponse.json(
      { status: "error", message: "Official village boundary overlay is temporarily unavailable." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
