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
import { rankVillageCandidates } from "@/lib/location-ranking";
import { listOfficialNationalLocationIndex, locateFromOfficialNationalBoundaries } from "@/lib/national-boundaries";
import { nearestVillageEstimateFromIndex } from "@/lib/representative-location";
import offlineLocationIndex from "../../../../public/offline/location-index.json";
import type { ConfidenceMatch } from "@/types/boundary";
import type { LeaderPublic } from "@/types/leader";
import type { LocateResponse, LocateSuccess } from "@/types/location";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LocateBodySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().max(50_000),
  method: z.enum(["gps", "map"]).optional().default("gps"),
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
        return respondWithStaticManualSelection(scopeCode);
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

    const { latitude, longitude, accuracy, method } = parsed.data;

    if (!isSupabasePublicConfigured()) {
      // No database is configured: resolve against the official national NISR
      // village polygons rather than returning a fabricated sample village.
      return respondWithOfficialFallback(latitude, longitude, accuracy, method);
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
      return respondWithOfficialFallback(latitude, longitude, accuracy, method);
    }

    // Ignore an old sample polygon if it remains in a database that has
    // not yet been re-imported; never present demo data as a real village.
    const realRows = ((rows as RpcRow[]) ?? []).filter((row) => {
      const lowerName = row.name_kiny.toLowerCase();
      return row.scope_code !== "RW-01-01-01-001" &&
        !lowerName.includes("umudugudu w'urugero") &&
        !lowerName.includes("sample village");
    });

    let matches: ConfidenceMatch[] = realRows.map((r) => ({
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
      return respondWithOfficialFallback(latitude, longitude, accuracy, method);
    }

    // Keep raw overlap scores intact; they are geometric overlap scores, not
    // calibrated probabilities. Use coarse IP geography only as a weak
    // district-level prior for GPS results, never as the sole location source.
    if (method === "gps" && matches.length > 1) {
      const ipPrior = await getIpDistrictPrior(req, supabase);
      if (ipPrior.size > 0) {
        matches = rankVillageCandidates(matches, ipPrior);
      } else {
        matches.sort((a, b) => b.confidence - a.confidence);
      }
    } else {
      matches.sort((a, b) => b.confidence - a.confidence);
    }
    matches.splice(3);

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
      source: isNearestEstimate ? "nearest" : method,
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
  accuracy: number,
  method: "gps" | "map" = "gps"
): Promise<NextResponse<LocateResponse>> {
  const officialResult = await locateFromOfficialNationalBoundaries(
    latitude,
    longitude,
    accuracy
  );

  // Keep the citizen out of a dead end when the official polygon service has
  // a coverage gap or is unavailable. This uses a real village in the bundled
  // index and marks it as an estimate based on representative points.
  const staticEstimate = officialResult.status === "error"
    ? nearestVillageEstimateFromIndex(
        offlineLocationIndex,
        latitude,
        longitude,
        accuracy,
        "STATIC_REPRESENTATIVE_POINT_ESTIMATE"
      )
    : null;
  const result: LocateResponse = staticEstimate ?? officialResult;
  const response: LocateResponse =
    result.status === "success" && method === "map" && result.source !== "nearest"
      ? { ...result, source: "map" }
      : result;
  const status =
    response.status === "success"
      ? 200
      : response.code === "NETWORK_ERROR"
        ? 502
        : response.code === "POINT_IN_GAP" || response.code === "CONFIDENCE_TOO_LOW"
          ? 422
          : 400;
  return NextResponse.json(response, { status });
}



/**
 * Convert Vercel's IP geolocation into a weak district-only prior. IP data is
 * not precise enough to select a village and is never returned to the browser.
 * No IP address or IP-derived coordinates are stored.
 */
async function getIpDistrictPrior(
  req: NextRequest,
  supabase: ReturnType<typeof createSupabasePublicClient>
): Promise<Map<string, number>> {
  const headers = req.headers;
  if (headers.get("x-vercel-ip-country") !== "RW") return new Map();

  const latitude = Number(headers.get("x-vercel-ip-latitude"));
  const longitude = Number(headers.get("x-vercel-ip-longitude"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return new Map();

  // Only consider IP hints in Rwanda. Use a wide radius so it remains a district
  // prior rather than pretending IP geolocation identifies the person's village.
  if (longitude < 28.85 || longitude > 30.9 || latitude < -2.85 || latitude > -1.05) {
    return new Map();
  }

  try {
    const { data, error } = await supabase.rpc("calculate_location_confidence", {
      p_lng: longitude,
      p_lat: latitude,
      p_accuracy_m: 15_000,
    });
    if (error || !Array.isArray(data)) {
      if (error) console.warn("[locate] IP district prior unavailable:", error.message);
      return new Map();
    }

    const totals = new Map<string, number>();
    for (const row of data as RpcRow[]) {
      const lowerName = (row.name_kiny ?? "").toLowerCase();
      if (
        row.scope_code === "RW-01-01-01-001" ||
        lowerName.includes("umudugudu w'urugero") ||
        lowerName.includes("sample village")
      ) continue;

      const parts = String(row.scope_code).split("-");
      if (parts.length < 3 || !parts[1]?.startsWith("P") || !parts[2]?.startsWith("D")) continue;
      const districtCode = parts.slice(0, 3).join("-");
      totals.set(districtCode, (totals.get(districtCode) ?? 0) + Math.max(Number(row.confidence) || 0, 0));
    }

    const sum = Array.from(totals.values()).reduce((total, value) => total + value, 0);
    if (sum <= 0) return new Map();
    return new Map(Array.from(totals, ([code, value]) => [code, value / sum]));
  } catch (error) {
    console.warn("[locate] IP district prior failed:", error);
    return new Map();
  }
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
    // This bundled index is also the source for the offline picker. If the
    // database is absent or points to an empty project, let the citizen confirm
    // a real name from this verified index instead of hitting a dead end.
    return respondWithStaticManualSelection(scopeCode);
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


type StaticLocationChoice = {
  scope_code: string;
  name_kiny: string;
  name_eng: string | null;
  level: "province" | "district" | "sector" | "cell" | "village";
  parent_scope_code: string | null;
};

function getStaticLocationChoices(): StaticLocationChoice[] {
  const rawChoices = (offlineLocationIndex as { choices?: unknown[] }).choices;
  if (!Array.isArray(rawChoices)) return [];
  const levels = new Set(["province", "district", "sector", "cell", "village"]);
  return rawChoices.flatMap((raw): StaticLocationChoice[] => {
    if (!Array.isArray(raw) || raw.length < 5) return [];
    const level = String(raw[3]);
    const scopeCode = String(raw[0] ?? "");
    const nameKiny = String(raw[1] ?? "");
    if (!levels.has(level) || !scopeCode || !nameKiny) return [];
    return [{
      scope_code: scopeCode,
      name_kiny: nameKiny,
      name_eng: raw[2] == null ? null : String(raw[2]),
      level: level as StaticLocationChoice["level"],
      parent_scope_code: raw[4] == null ? null : String(raw[4]),
    }];
  });
}

function respondWithStaticManualSelection(scopeCode: string): NextResponse<LocateResponse> {
  const choices = getStaticLocationChoices();
  const selected = choices.find((item) => item.scope_code === scopeCode && item.level === "village");
  if (!selected) {
    return NextResponse.json(createLocateError("NOT_FOUND"), { status: 404 });
  }

  const byCode = new Map(choices.map((item) => [item.scope_code, item]));
  const hierarchy: LocateSuccess["hierarchy"] = {};
  let current: StaticLocationChoice | undefined = selected;
  let village: ConfidenceMatch | null = null;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const match: ConfidenceMatch = {
      scope_code: current.scope_code,
      name_kiny: current.name_kiny,
      name_eng: current.name_eng,
      level: current.level,
      confidence: 100,
      intersection_area_m2: 0,
    };
    if (current.level === "province") hierarchy.province = match;
    if (current.level === "district") hierarchy.district = match;
    if (current.level === "sector") hierarchy.sector = match;
    if (current.level === "cell") hierarchy.cell = match;
    if (current.level === "village") {
      hierarchy.village = match;
      village = match;
    }
    current = current.parent_scope_code ? byCode.get(current.parent_scope_code) : undefined;
  }

  if (!village) {
    return NextResponse.json(createLocateError("NOT_FOUND"), { status: 404 });
  }
  const response: LocateSuccess = {
    status: "success",
    matches: [village],
    hierarchy,
    leaders: [],
    source: "manual",
    warning: "USER_CONFIRMED_STATIC_INDEX",
  };
  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
  });
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
