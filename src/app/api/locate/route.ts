/**
 * POST /api/locate
 *
 * Geospatial Confidence Algorithm (PostGIS).
 * Input : { latitude, longitude, accuracy }
 * Output: LocateSuccess | LocateError (all 15 error states handled)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabasePublicClient, isSupabasePublicConfigured } from "@/lib/supabase/server";
import { createLocateError } from "@/lib/utils/errors";
import { listOfficialNationalLocationIndex, locateFromOfficialNationalBoundaries } from "@/lib/national-boundaries";
import type { ConfidenceMatch } from "@/types/boundary";
import type { LeaderPublic } from "@/types/leader";
import type { LocateResponse, LocateSuccess } from "@/types/location";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LocateBodySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().max(50_000),
});

interface RpcRow {
  scope_code: string;
  name_kiny: string;
  name_eng: string | null;
  level: string;
  confidence: number;
  intersection_area_m2: number;
  path: string;
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<LocateResponse>> {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        createLocateError("NETWORK_ERROR", { reason: "invalid_json" }),
        { status: 400 }
      );
    }

    if (body && typeof body === "object" && (body as { mode?: unknown }).mode === "manual") {
      const scopeCode = (body as { scope_code?: unknown }).scope_code;
      if (typeof scopeCode !== "string" || !/^RW(?:-[0-9A-Z]+)*$/.test(scopeCode)) {
        return NextResponse.json(createLocateError("NOT_FOUND"), { status: 400 });
      }
      if (!isSupabasePublicConfigured()) {
        return NextResponse.json(createLocateError("NETWORK_ERROR", { reason: "database_not_configured" }), { status: 503 });
      }
      return respondWithManualSelection(createSupabasePublicClient(), scopeCode);
    }

    const parsed = LocateBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createLocateError("GPS_DENIED", {
          validation: parsed.error.flatten(),
        }),
        { status: 400 }
      );
    }

    const { latitude, longitude, accuracy } = parsed.data;

    if (!isSupabasePublicConfigured()) {
      // No database is configured: resolve against the official national NISR
      // village polygons rather than returning a fabricated sample village.
      return respondWithOfficialFallback(latitude, longitude, accuracy);
    }

    const supabase = createSupabasePublicClient();

    // --- Call PostGIS confidence function ---
    const { data: rows, error: rpcError } = await supabase.rpc(
      "calculate_location_confidence",
      {
        p_lng: longitude,
        p_lat: latitude,
        p_accuracy_m: accuracy,
      }
    );

    if (rpcError) {
      console.warn("[locate] PostGIS RPC failed; trying the official NISR boundary service:", rpcError.message);
      return respondWithOfficialFallback(latitude, longitude, accuracy);
    }

    // Ignore an old sample polygon if it remains in a database that has
    // not yet been re-imported; never present demo data as a real village.
    const realRows = ((rows as RpcRow[]) ?? []).filter((row) => {
      const lowerName = row.name_kiny.toLowerCase();
      return row.scope_code !== "RW-01-01-01-001" &&
        !lowerName.includes("umudugudu w'urugero") &&
        !lowerName.includes("sample village");
    });

    const matches: ConfidenceMatch[] = realRows.map((r) => ({
      scope_code: r.scope_code,
      name_kiny: r.name_kiny,
      name_eng: r.name_eng,
      level: r.level as ConfidenceMatch["level"],
      confidence: Number(r.confidence),
      intersection_area_m2: Number(r.intersection_area_m2),
    }));

    // --- Error: Point in gap (no intersection) ---
    if (matches.length === 0) {
      // A valid national match may still exist when the database has not yet
      // been imported or contains only partial district coverage.
      return respondWithOfficialFallback(latitude, longitude, accuracy);
    }

    // The SQL function returns top intersecting matches or nearest-village estimates.
    matches.sort((a, b) => b.confidence - a.confidence);
    matches.splice(3);

    // Normalise overlapping percentages so they sum ≈ 100
    if (matches.length > 1) {
      const total = matches.reduce((s, m) => s + m.confidence, 0);
      if (total > 100) {
        for (const m of matches) {
          m.confidence =
            Math.round((m.confidence / total) * 10000) / 100;
        }
      }
    }

    // --- Point in overlap flag (informational, still success) ---
    const isOverlap = matches.length > 1 && matches[1].confidence > 5;

    // Build hierarchy from the top match
    const hierarchy = await buildHierarchy(supabase, matches[0]);

    // Fetch active leaders for the relevant scopes (phones masked)
    const scopeCodes = collectScopeCodes(hierarchy, matches);
    const leaders = await fetchLeadersMasked(supabase, scopeCodes);

    const isNearestEstimate = matches[0].intersection_area_m2 === 0;
    const response: LocateSuccess = {
      status: "success",
      matches,
      hierarchy,
      leaders,
      source: isNearestEstimate ? "nearest" : "gps",
    };

    if (isNearestEstimate) {
      (response as LocateSuccess & { warning?: string }).warning =
        "NEAREST_VILLAGE_ESTIMATE";
    } else if (isOverlap) {
      (response as LocateSuccess & { warning?: string }).warning =
        "POINT_IN_OVERLAP";
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error("[locate] Unexpected error:", err);
    return NextResponse.json(
      createLocateError("NETWORK_ERROR", {
        reason: err instanceof Error ? err.message : "unknown",
      }),
      { status: 502 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildHierarchy(
  supabase: ReturnType<typeof createSupabasePublicClient>,
  topVillage: ConfidenceMatch
): Promise<LocateSuccess["hierarchy"]> {
  const hierarchy: LocateSuccess["hierarchy"] = {
    village: topVillage,
  };

  const parts = topVillage.scope_code.split("-");

  const prefixes: {
    level: "province" | "district" | "sector" | "cell";
    code: string;
  }[] = [];

  // Canonical NISR-derived codes preserve source IDs, e.g. RW-P1-D11-S1101-C110101-V11010101.
  if (parts[1]?.startsWith("P") && parts[2]?.startsWith("D")) {
    if (parts.length >= 2) prefixes.push({ level: "province", code: parts.slice(0, 2).join("-") });
    if (parts.length >= 3) prefixes.push({ level: "district", code: parts.slice(0, 3).join("-") });
    if (parts.length >= 4) prefixes.push({ level: "sector", code: parts.slice(0, 4).join("-") });
    if (parts.length >= 5) prefixes.push({ level: "cell", code: parts.slice(0, 5).join("-") });
  } else {
    // Compatibility for older local test data.
    if (parts.length >= 4) prefixes.push({ level: "cell", code: parts.slice(0, 4).join("-") });
    if (parts.length >= 3) prefixes.push({ level: "sector", code: parts.slice(0, 3).join("-") });
    if (parts.length >= 2) prefixes.push({ level: "district", code: parts.slice(0, 2).join("-") });
  }

  for (const { level, code } of prefixes) {
    const { data } = await supabase
      .from("boundaries")
      .select("scope_code, name_kiny, name_eng, level")
      .eq("scope_code", code)
      .eq("level", level)
      .is("valid_to", null)
      .maybeSingle();

    if (data) {
      hierarchy[level] = {
        scope_code: data.scope_code,
        name_kiny: data.name_kiny,
        name_eng: data.name_eng,
        level: data.level as ConfidenceMatch["level"],
        // Hierarchy Rule: inherit the village confidence — never force 100 %
        confidence: topVillage.confidence,
        intersection_area_m2: topVillage.intersection_area_m2,
      };
    }
  }

  return hierarchy;
}

function collectScopeCodes(
  hierarchy: LocateSuccess["hierarchy"],
  matches: ConfidenceMatch[]
): string[] {
  const codes = new Set<string>();
  for (const m of matches) codes.add(m.scope_code);
  if (hierarchy.province) codes.add(hierarchy.province.scope_code);
  if (hierarchy.village) codes.add(hierarchy.village.scope_code);
  if (hierarchy.cell) codes.add(hierarchy.cell.scope_code);
  if (hierarchy.sector) codes.add(hierarchy.sector.scope_code);
  if (hierarchy.district) codes.add(hierarchy.district.scope_code);
  return Array.from(codes);
}

async function fetchLeadersMasked(
  supabase: ReturnType<typeof createSupabasePublicClient>,
  scopeCodes: string[]
): Promise<LeaderPublic[]> {
  if (scopeCodes.length === 0) return [];

  const { data, error } = await supabase
    .from("leaders")
    .select(
      `
      id,
      scope_code,
      first_name,
      last_name,
      role,
      email,
      photo_url,
      valid_from,
      valid_to,
      version,
      boundaries!inner ( name_kiny, name_eng, level )
    `
    )
    .in("scope_code", scopeCodes)
    .is("valid_to", null);

  if (error || !data) {
    console.error("[locate] leaders fetch error:", error);
    return [];
  }

  return data.map((row: Record<string, unknown>) => {
    const rawB = row.boundaries;
    const boundaries = (Array.isArray(rawB) ? rawB[0] : rawB) as {
      name_kiny: string;
      name_eng: string | null;
      level: string;
    } | null;

    return {
      id: row.id as string,
      scope_code: row.scope_code as string,
      first_name: row.first_name as string,
      last_name: row.last_name as string,
      role: row.role as LeaderPublic["role"],
      email: (row.email as string) ?? null,
      photo_url: (row.photo_url as string) ?? null,
      valid_from: row.valid_from as string,
      valid_to: (row.valid_to as string) ?? null,
      version: row.version as number,
      boundary_name_kiny: boundaries?.name_kiny ?? "",
      boundary_name_eng: boundaries?.name_eng ?? null,
      level: boundaries?.level ?? "",
      phone_masked: null,
    };
  });
}


/**
 * Resolve a missing database match against NISR's official 2022 village
 * polygons. The result contains no sample names or unverified leader contacts.
 */
async function respondWithOfficialFallback(
  latitude: number,
  longitude: number,
  accuracy: number
): Promise<NextResponse<LocateResponse>> {
  const result = await locateFromOfficialNationalBoundaries(
    latitude,
    longitude,
    accuracy
  );
  const status =
    result.status === "success"
      ? 200
      : result.code === "NETWORK_ERROR"
        ? 502
        : result.code === "POINT_IN_GAP" || result.code === "CONFIDENCE_TOO_LOW"
          ? 422
          : 400;
  return NextResponse.json(result, { status });
}


async function respondWithManualSelection(
  supabase: ReturnType<typeof createSupabasePublicClient>,
  scopeCode: string
): Promise<NextResponse<LocateResponse>> {
  const { data, error } = await supabase
    .from("boundaries")
    .select("scope_code, name_kiny, name_eng, level")
    .eq("scope_code", scopeCode)
    .eq("level", "village")
    .is("valid_to", null)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json(createLocateError("NOT_FOUND"), { status: 404 });
  }
  const selected: ConfidenceMatch = {
    scope_code: data.scope_code,
    name_kiny: data.name_kiny,
    name_eng: data.name_eng,
    level: "village",
    confidence: 100,
    intersection_area_m2: 0,
  };
  const hierarchy = await buildHierarchy(supabase, selected);
  const response: LocateSuccess = {
    status: "success",
    matches: [selected],
    hierarchy,
    leaders: [],
    source: "manual",
    warning: "USER_CONFIRMED",
  };
  return NextResponse.json(response);
}

/** Search official village names, or browse the hierarchy from province to village. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const params = new URL(req.url).searchParams;

    if (params.get("index") === "1") {
      const cacheHeaders = {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      };

      if (isSupabasePublicConfigured()) {
        const supabase = createSupabasePublicClient();
        const pageSize = 1000;
        const starts = Array.from({ length: 18 }, (_, index) => index * pageSize);
        const pageResults = await Promise.all(starts.map(async (start) => {
          const result = await supabase.from("boundaries")
            .select("scope_code, name_kiny, name_eng, level")
            .is("valid_to", null)
            .order("scope_code", { ascending: true })
            .range(start, start + pageSize - 1);
          return { start, ...result };
        }));
        const failedPage = pageResults.find((page) => page.error);
        const rows = failedPage ? [] : pageResults.flatMap((page) => page.data ?? []);
        if (!failedPage && rows.length > 0) {
          const choices = rows
            .filter((row) => row.level !== "country")
            .map((row) => ({
              scope_code: row.scope_code,
              name_kiny: row.name_kiny,
              name_eng: row.name_eng,
              level: row.level,
              // Official scope codes are hierarchical; no private UUID fields needed.
              parent_scope_code: row.level === "province" ? null : row.scope_code.split("-").slice(0, -1).join("-"),
            }));
          return NextResponse.json({ status: "index", choices, source: "supabase" }, {
            headers: cacheHeaders,
          });
        }
        console.error("[locate] Supabase national index unavailable; trying official NISR index:",
          failedPage?.error?.message ?? "no active boundary rows");
      }

      try {
        const choices = await listOfficialNationalLocationIndex();
        return NextResponse.json({ status: "index", choices, source: "nisr-fallback" }, {
          headers: cacheHeaders,
        });
      } catch (error) {
        console.error("[locate] official NISR index fallback failed:", error);
        return NextResponse.json({ status: "error", message: "Location index unavailable." }, { status: 503 });
      }
    }

    if (!isSupabasePublicConfigured()) {
      return NextResponse.json({ status: "error", message: "Location data unavailable." }, { status: 503 });
    }
    const supabase = createSupabasePublicClient();
    const q = (params.get("q") ?? "").trim().replace(/[%,_()]/g, " ").slice(0, 80);
    const parentScopeCode = (params.get("parent_scope_code") ?? "").trim();
    const requestedLevel = (params.get("level") ?? "province").trim();
    const allowed = ["province", "district", "sector", "cell", "village"] as const;
    const level = allowed.includes(requestedLevel as (typeof allowed)[number]) ? requestedLevel : "province";

    let query = supabase.from("boundaries")
      .select("scope_code, name_kiny, name_eng, level")
      .is("valid_to", null);

    if (q) {
      query = query.eq("level", "village")
        .ilike("name_kiny", `%${q}%`)
        .order("name_kiny", { ascending: true })
        .limit(30);
    } else {
      query = query.eq("level", level).order("name_kiny", { ascending: true })
        .limit(level === "province" ? 10 : 120);
      if (parentScopeCode) {
        if (!/^RW(?:-[0-9A-Z]+)*$/.test(parentScopeCode)) {
          return NextResponse.json({ status: "choices", choices: [] });
        }
        query = query.like("scope_code", `${parentScopeCode}-%`);
      } else if (level !== "province") {
        return NextResponse.json({ status: "choices", choices: [] });
      }
    }
    const { data, error } = await query;
    if (error) {
      console.error("[locate] picker query failed:", error.message);
      return NextResponse.json({ status: "error", message: "Location choices unavailable." }, { status: 503 });
    }
    return NextResponse.json({ status: "choices", choices: data ?? [] }, {
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("[locate] picker error:", error);
    return NextResponse.json({ status: "error", message: "Location choices unavailable." }, { status: 503 });
  }
}
