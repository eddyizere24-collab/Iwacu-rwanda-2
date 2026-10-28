/**
 * Download all available Rwanda village polygons from NISR's public 2022 layer.
 *
 * Output: public/offline/rwanda-village-boundaries.geojson
 *
 * Source notes: NISR describes 14,816 mapped villages from 2022, against
 * 14,837 gazetted villages. The layer excludes some Lake Kivu area, so it is
 * an authoritative base map, not a promise of 100% territorial coverage.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const QUERY_URL =
  process.env.RWANDA_BOUNDARY_SERVICE_URL ??
  "https://gis-server.statistics.gov.rw/server/rest/services/Hosted/Village_Boundary_2022/FeatureServer/3/query";
const OUTPUT =
  process.env.RWANDA_BOUNDARY_OUTPUT ??
  "public/offline/rwanda-village-boundaries.geojson";
const PAGE_SIZE = 1000;
const MIN_EXPECTED_FEATURES = 14_000;

type RawFeature = {
  type: "Feature";
  id?: string | number;
  properties?: Record<string, unknown>;
  geometry?: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
};
type RawCollection = { type: "FeatureCollection"; features: RawFeature[] };

function value(properties: Record<string, unknown>, key: string): string {
  const raw = properties[key] ?? properties[key.toLowerCase()] ?? properties[key.toUpperCase()];
  return raw === undefined || raw === null ? "" : String(raw).trim();
}

function getScopeCodes(properties: Record<string, unknown>) {
  const districtId = value(properties, "district_id");
  const sectorId = value(properties, "sector_id");
  const cellId = value(properties, "cell_id");
  const villageId = value(properties, "village_id");
  if (![districtId, sectorId, cellId, villageId].every((id) => /^\d+$/.test(id))) {
    throw new Error(`Official feature has incomplete administrative IDs: ${JSON.stringify(properties)}`);
  }

  const district = `RW-${districtId.padStart(2, "0")}`;
  const sector = `${district}-${sectorId.slice(-2).padStart(2, "0")}`;
  const cell = `${sector}-${cellId.slice(-2).padStart(2, "0")}`;
  const village = `${cell}-${villageId.slice(-2).padStart(2, "0")}`;
  return { district, sector, cell, village };
}

async function fetchPage(offset: number): Promise<RawCollection> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields:
      "province_id,province,district_id,district,sector_id,sector,cell_id,cell,village_id,village",
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
    orderByFields: "village_id ASC",
  });
  const response = await fetch(`${QUERY_URL}?${params.toString()}`, {
    headers: { accept: "application/geo+json, application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`NISR download returned HTTP ${response.status} at offset ${offset}`);
  }
  const payload = (await response.json()) as RawCollection | {
    error?: { message?: string; details?: string[] };
  };
  if (!("features" in payload) || !Array.isArray(payload.features)) {
    const detail = "error" in payload ? payload.error?.message : "invalid response";
    throw new Error(`NISR query failed at offset ${offset}: ${detail ?? "unknown error"}`);
  }
  return payload as RawCollection;
}

async function main() {
  const downloaded: RawFeature[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    console.log(`Downloading NISR village boundaries: offset ${offset}…`);
    const page = await fetchPage(offset);
    downloaded.push(...page.features);
    console.log(`  Received ${page.features.length}; running total ${downloaded.length}`);
    if (page.features.length === 0 || page.features.length < PAGE_SIZE) break;
  }

  const uniqueIds = new Set<string>();
  const features = downloaded.map((feature) => {
    const props = feature.properties ?? {};
    const villageId = value(props, "village_id");
    const id = villageId || String(feature.id ?? "");
    if (!id) throw new Error("A feature has neither village_id nor an ArcGIS feature ID.");
    if (uniqueIds.has(id)) throw new Error(`Duplicate village ID returned by service: ${id}`);
    uniqueIds.add(id);
    if (!feature.geometry || !["Polygon", "MultiPolygon"].includes(feature.geometry.type)) {
      throw new Error(`Village ${id} has no supported polygon geometry.`);
    }

    const codes = getScopeCodes(props);
    const village = value(props, "village");
    const cell = value(props, "cell");
    const sector = value(props, "sector");
    const district = value(props, "district");
    if (!village || !cell || !sector || !district) {
      throw new Error(`Official feature ${id} is missing one or more place names.`);
    }

    return {
      type: "Feature" as const,
      id,
      properties: {
        scope_code: codes.village,
        path: codes.village.replace(/-/g, "."),
        name_kiny: village,
        name_eng: village,
        level: "village",
        district_scope_code: codes.district,
        district_name: district,
        sector_scope_code: codes.sector,
        sector_name: sector,
        cell_scope_code: codes.cell,
        cell_name: cell,
        source: "NISR",
        source_year: 2022,
        source_ids: {
          province_id: value(props, "province_id"),
          district_id: value(props, "district_id"),
          sector_id: value(props, "sector_id"),
          cell_id: value(props, "cell_id"),
          village_id: villageId,
        },
        province: value(props, "province"),
        district,
        sector,
        cell,
        village,
      },
      geometry: feature.geometry,
    };
  });

  if (features.length < MIN_EXPECTED_FEATURES) {
    throw new Error(
      `Safety check failed: received ${features.length} features, expected at least ${MIN_EXPECTED_FEATURES}. The output file was not changed.`
    );
  }

  const ids = new Set(features.map((feature) => feature.properties.source_ids.village_id));
  if (ids.size !== features.length) {
    throw new Error("Safety check failed: village IDs are not unique.");
  }

  const outputPath = resolve(OUTPUT);
  mkdirSync(dirname(outputPath), { recursive: true });
  const collection = {
    type: "FeatureCollection",
    name: "Rwanda_Village_Boundaries_NISR_2022",
    source: "National Institute of Statistics of Rwanda (NISR)",
    source_url: "https://gis-server.statistics.gov.rw/server/rest/services/Hosted/Village_Boundary_2022/FeatureServer/3",
    source_year: 2022,
    feature_count: features.length,
    coverage_notice:
      "NISR states 14,816 villages were mapped out of 14,837 gazetted, and the geographic coverage excludes some area covered by Lake Kivu.",
    crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },
    features,
  };
  writeFileSync(outputPath, JSON.stringify(collection), "utf8");
  console.log(`\nSaved ${features.length} official village polygons to ${outputPath}`);
  console.log("This is the count returned by NISR at download time; review its coverage notice before claiming nationwide 100% completeness.");
}

main().catch((error) => {
  console.error("Boundary download failed:", error);
  process.exitCode = 1;
});
