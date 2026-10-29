/**
 * IWACU RWANDA — Nationwide village lookup from official NISR boundaries.
 *
 * GPS coordinates are not translated to a village by a map tile. We query the
 * NISR 2022 village polygon service using the reported GPS accuracy circle.
 * If the service has no polygon for a point (notably some Lake Kivu coverage),
 * the function returns an honest gap/error instead of inventing a village.
 */
import * as turf from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import type { ConfidenceMatch } from "@/types/boundary";
import type { LocateResponse, LocateSuccess } from "@/types/location";
import { createLocateError } from "@/lib/utils/errors";

const NISR_QUERY_URL =
  "https://gis-server.statistics.gov.rw/server/rest/services/Hosted/Village_Boundary_2022/FeatureServer/3/query";
const NISR_SOURCE = "NISR Village Boundary 2022";

type BoundaryGeometry = Polygon | MultiPolygon;
type BoundaryFeature = Feature<BoundaryGeometry, Record<string, unknown>>;
type BoundaryCollection = { type: "FeatureCollection"; features: BoundaryFeature[] };

function field(props: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const actualKey = Object.keys(props).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    const value = actualKey ? props[actualKey] : undefined;
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function scopeCodes(props: Record<string, unknown>) {
  const provinceId = field(props, "province_id");
  const districtId = field(props, "district_id");
  const sectorId = field(props, "sector_id");
  const cellId = field(props, "cell_id");
  const villageId = field(props, "village_id");

  // NISR IDs are hierarchical: district_id has 2 digits, sector_id 4,
  // cell_id 6, and village_id 8. Preserve every official source ID; do not
  // manufacture suffixes or confuse adjacent administrative units.
  const ids = [provinceId, districtId, sectorId, cellId, villageId];
  if (!ids.every((id) => /^\d+$/.test(id))) return null;
  if (
    districtId.length !== 2 ||
    sectorId.length !== 4 ||
    cellId.length !== 6 ||
    villageId.length !== 8 ||
    !districtId.startsWith(provinceId) ||
    !sectorId.startsWith(districtId) ||
    !cellId.startsWith(sectorId) ||
    !villageId.startsWith(cellId)
  ) {
    return null;
  }

  const province = `RW-P${provinceId}`;
  const district = `${province}-D${districtId}`;
  const sector = `${district}-S${sectorId}`;
  const cell = `${sector}-C${cellId}`;
  const village = `${cell}-V${villageId}`;
  return { province, district, sector, cell, village };
}

export type OfficialNationalIndexChoice = {
  scope_code: string;
  name_kiny: string;
  name_eng: string | null;
  level: "province" | "district" | "sector" | "cell" | "village";
  parent_scope_code: string | null;
};

/**
 * Fallback index sourced only from NISR's published 2022 village layer.
 * It contains no made-up names or geometry. NISR documents that its data
 * covers 14,816 of 14,837 gazetted villages, so this is a resilience fallback,
 * not a replacement for the more complete populated Supabase index.
 */
export async function listOfficialNationalLocationIndex(): Promise<OfficialNationalIndexChoice[]> {
  const pageSize = 2000;
  const offsets = Array.from({ length: 8 }, (_, index) => index * pageSize);
  const pages = await Promise.all(offsets.map(async (offset) => {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "province_id,province,district_id,district,sector_id,sector,cell_id,cell,village_id,village",
      returnGeometry: "false",
      resultRecordCount: String(pageSize),
      resultOffset: String(offset),
      orderByFields: "village_id",
      f: "json",
    });

    const response = await fetch(NISR_QUERY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: params.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      throw new Error(`NISR location index page ${offset} returned HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      features?: Array<{ attributes?: Record<string, unknown>; properties?: Record<string, unknown> }>;
      error?: { message?: string };
    };
    if (!Array.isArray(payload.features)) {
      throw new Error(payload.error?.message ?? `NISR location index page ${offset} had no features`);
    }
    return payload.features;
  }));
  const features = pages.flat();

  const index = new Map<string, OfficialNationalIndexChoice>();
  const add = (
    scopeCode: string,
    level: OfficialNationalIndexChoice["level"],
    parentScopeCode: string | null,
    nameKiny: string,
    nameEng: string | null
  ) => {
    if (!scopeCode || !nameKiny || index.has(scopeCode)) return;
    index.set(scopeCode, {
      scope_code: scopeCode,
      level,
      parent_scope_code: parentScopeCode,
      name_kiny: nameKiny,
      name_eng: nameEng,
    });
  };

  const provinceNamesKiny: Record<string, string> = {
    "city of kigali": "Umujyi wa Kigali",
    "kigali city": "Umujyi wa Kigali",
    "kigali": "Umujyi wa Kigali",
    "southern province": "Intara y'Amajyepfo",
    "western province": "Intara y'Iburengerazuba",
    "northern province": "Intara y'Amajyaruguru",
    "eastern province": "Intara y'Iburasirazuba",
  };

  for (const feature of features) {
    const props = feature.attributes ?? feature.properties;
    if (!props) continue;
    const codes = scopeCodes(props);
    if (!codes) continue;

    const provinceNameEng = field(props, "province");
    const provinceNameKey = provinceNameEng.toLowerCase().replace(/\s+/g, " ").trim();
    const provinceNameKiny = provinceNamesKiny[provinceNameKey] ?? provinceNameEng;
    const districtName = field(props, "district");
    const sectorName = field(props, "sector");
    const cellName = field(props, "cell");
    const villageName = field(props, "village");

    add(codes.province, "province", null, provinceNameKiny, provinceNameEng || null);
    add(codes.district, "district", codes.province, districtName, districtName || null);
    add(codes.sector, "sector", codes.district, sectorName, sectorName || null);
    add(codes.cell, "cell", codes.sector, cellName, cellName || null);
    add(codes.village, "village", codes.cell, villageName, villageName || null);
  }

  const levelOrder: Record<OfficialNationalIndexChoice["level"], number> = {
    province: 0,
    district: 1,
    sector: 2,
    cell: 3,
    village: 4,
  };
  return Array.from(index.values()).sort((a, b) =>
    levelOrder[a.level] - levelOrder[b.level] ||
    a.name_kiny.localeCompare(b.name_kiny, "rw")
  );
}

export async function getOfficialVillagePolygonsForBbox(
  west: number,
  south: number,
  east: number,
  north: number
): Promise<{ type: "FeatureCollection"; features: Array<Record<string, unknown>> }> {
  if (
    ![west, south, east, north].every(Number.isFinite) ||
    west < 28.7 || east > 31.1 || south < -3.0 || north > -0.8 ||
    west >= east || south >= north || (east - west) > 1.0 || (north - south) > 1.0
  ) {
    throw new Error("Map view bounds are outside the allowed Rwanda map window.");
  }

  const params = new URLSearchParams({
    where: "1=1",
    geometry: JSON.stringify({
      xmin: west,
      ymin: south,
      xmax: east,
      ymax: north,
      spatialReference: { wkid: 4326 },
    }),
    geometryType: "esriGeometryEnvelope",
    spatialRel: "esriSpatialRelIntersects",
    inSR: "4326",
    outSR: "4326",
    outFields: "province,district,sector,cell,village",
    returnGeometry: "true",
    resultRecordCount: "500",
    f: "geojson",
  });

  const response = await fetch(NISR_QUERY_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: params.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`Official map boundary lookup returned HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    type?: string;
    features?: Array<Record<string, unknown>>;
    error?: { message?: string };
  };
  if (!Array.isArray(payload.features)) {
    throw new Error(payload.error?.message ?? "Official boundary response had no features.");
  }
  return {
    type: "FeatureCollection",
    features: payload.features.slice(0, 500),
  };
}

function calculateIntersection(
  boundary: BoundaryFeature,
  accuracyCircle: Feature<Polygon>
): number {
  try {
    const intersection = turf.intersect(
      turf.featureCollection([
        boundary as Feature<Polygon | MultiPolygon>,
        accuracyCircle,
      ])
    );
    return intersection ? turf.area(intersection) : 0;
  } catch {
    return 0;
  }
}

function asMatch(
  code: string,
  level: ConfidenceMatch["level"],
  confidence: number,
  intersectionArea: number,
  nameKiny: string,
  nameEng: string = nameKiny
): ConfidenceMatch {
  return {
    scope_code: code,
    name_kiny: nameKiny,
    // NISR publishes these local place names, not separate translations for
    // districts, sectors, cells and villages. Keep them unchanged.
    name_eng: nameEng,
    level,
    confidence: Math.round(confidence * 100) / 100,
    intersection_area_m2: intersectionArea,
  };
}

export async function locateFromOfficialNationalBoundaries(
  latitude: number,
  longitude: number,
  accuracyMeters: number
): Promise<LocateResponse> {
  const safeAccuracyMeters = Number.isFinite(accuracyMeters)
    ? Math.min(Math.max(accuracyMeters, 1), 50_000)
    : 100;
  const circle = turf.circle([longitude, latitude], safeAccuracyMeters / 1000, {
    steps: 48,
    units: "kilometers",
  });
  const rings = circle.geometry.coordinates[0];
  const geometry = JSON.stringify({
    rings: [rings],
    spatialReference: { wkid: 4326 },
  });

  const params = new URLSearchParams({
    where: "1=1",
    geometry,
    geometryType: "esriGeometryPolygon",
    spatialRel: "esriSpatialRelIntersects",
    inSR: "4326",
    outSR: "4326",
    outFields:
      "province_id,province,district_id,district,sector_id,sector,cell_id,cell,village_id,village",
    returnGeometry: "true",
    f: "geojson",
  });

  let response: Response;
  try {
    response = await fetch(NISR_QUERY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: params.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("[national-boundaries] NISR request failed:", error);
    return createLocateError("NETWORK_ERROR", {
      source: NISR_SOURCE,
      reason: "official_boundary_service_unavailable",
    });
  }

  if (!response.ok) {
    console.error("[national-boundaries] NISR HTTP status:", response.status);
    return createLocateError("NETWORK_ERROR", {
      source: NISR_SOURCE,
      reason: `official_boundary_service_http_${response.status}`,
    });
  }

  let collection: BoundaryCollection;
  try {
    const payload = (await response.json()) as BoundaryCollection | {
      error?: { message?: string; details?: string[] };
    };
    if (!("features" in payload) || !Array.isArray(payload.features)) {
      const serviceError = "error" in payload ? payload.error?.message : undefined;
      console.error("[national-boundaries] invalid NISR response:", serviceError);
      return createLocateError("NETWORK_ERROR", {
        source: NISR_SOURCE,
        reason: serviceError ?? "invalid_official_boundary_response",
      });
    }
    collection = payload as BoundaryCollection;
  } catch (error) {
    console.error("[national-boundaries] could not parse NISR response:", error);
    return createLocateError("NETWORK_ERROR", {
      source: NISR_SOURCE,
      reason: "invalid_official_boundary_json",
    });
  }

  const circleArea = turf.area(circle);
  if (!(circleArea > 0)) {
    return createLocateError("GPS_ACCURACY_TOO_LOW", { accuracy: safeAccuracyMeters });
  }

  const rawMatches: Array<{
    feature: BoundaryFeature;
    props: Record<string, unknown>;
    codes: NonNullable<ReturnType<typeof scopeCodes>>;
    name: string;
    area: number;
    confidence: number;
  }> = [];

  for (const feature of collection.features) {
    if (!feature?.geometry || !feature.properties) continue;
    const props = feature.properties;
    const codes = scopeCodes(props);
    const name = field(props, "village");
    if (!codes || !name) continue;

    const intersectionArea = calculateIntersection(feature, circle);
    if (intersectionArea <= 0) continue;

    rawMatches.push({
      feature,
      props,
      codes,
      name,
      area: intersectionArea,
      confidence: Math.min(100, (intersectionArea / circleArea) * 100),
    });
  }

  let nearestFallbackUsed = false;

  if (rawMatches.length === 0) {
    // The official layer has gaps (including some Lake Kivu coverage). Search
    // a wider 50 km area and return the closest real NISR villages as estimates.
    // This never fabricates a place name and does not call the scores probabilities.
    const fallbackCircle = turf.circle([longitude, latitude], 50, {
      steps: 32,
      units: "kilometers",
    });
    const fallbackParams = new URLSearchParams(params);
    fallbackParams.set(
      "geometry",
      JSON.stringify({
        rings: [fallbackCircle.geometry.coordinates[0]],
        spatialReference: { wkid: 4326 },
      })
    );

    try {
      const fallbackResponse = await fetch(NISR_QUERY_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: fallbackParams.toString(),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });

      if (fallbackResponse.ok) {
        const payload = (await fallbackResponse.json()) as BoundaryCollection | {
          error?: { message?: string; details?: string[] };
        };
        if ("features" in payload && Array.isArray(payload.features)) {
          const point = turf.point([longitude, latitude]);
          const nearby: Array<{
            feature: BoundaryFeature;
            props: Record<string, unknown>;
            codes: NonNullable<ReturnType<typeof scopeCodes>>;
            name: string;
            distanceMeters: number;
          }> = [];

          for (const feature of payload.features) {
            if (!feature?.geometry || !feature.properties) continue;
            const props = feature.properties;
            const codes = scopeCodes(props);
            const name = field(props, "village");
            if (!codes || !name) continue;

            let distanceMeters: number;
            try {
              // Measure to the actual village polygon boundary instead of its
              // centroid so shoreline villages are not ranked by a center in the lake.
              distanceMeters = turf.pointToLineDistance(
                point,
                turf.polygonToLine(feature),
                { units: "meters" }
              );
            } catch {
              continue;
            }
            if (Number.isFinite(distanceMeters) && distanceMeters <= 50_000) {
              nearby.push({ feature, props, codes, name, distanceMeters });
            }
          }

          nearby.sort((a, b) => a.distanceMeters - b.distanceMeters);
          const selected = nearby.slice(0, 3);
          const weights = selected.map((item) =>
            Math.exp(-item.distanceMeters / Math.max(250, safeAccuracyMeters))
          );
          const totalWeight = weights.reduce((sum, value) => sum + value, 0);

          selected.forEach((item, index) => {
            rawMatches.push({
              feature: item.feature,
              props: item.props,
              codes: item.codes,
              name: item.name,
              area: 0,
              confidence: totalWeight > 0 ? (weights[index] / totalWeight) * 100 : 0,
            });
          });
          nearestFallbackUsed = rawMatches.length > 0;
        }
      }
    } catch (error) {
      console.error("[national-boundaries] nearest-village fallback failed:", error);
    }
  }

  if (rawMatches.length === 0) {
    return createLocateError("POINT_IN_GAP", {
      source: NISR_SOURCE,
      message:
        "Nta mudugudu uri muri aka gace wabonetse mu makuru yemewe. Ushobora gushakisha cyangwa guhitamo umudugudu ku rutonde.",
    });
  }

  rawMatches.sort((a, b) => b.confidence - a.confidence);
  const top = rawMatches[0];

  const matches: ConfidenceMatch[] = rawMatches.slice(0, 3).map((item) =>
    asMatch(
      item.codes.village,
      "village",
      item.confidence,
      item.area,
      item.name
    )
  );

  const total = matches.reduce((sum, item) => sum + item.confidence, 0);
  if (matches.length > 1 && total > 100) {
    for (const item of matches) {
      item.confidence = Math.round((item.confidence / total) * 10_000) / 100;
    }
  }

  const provinceNameEng = field(top.props, "province");
  const provinceNameKey = provinceNameEng.toLowerCase().replace(/\s+/g, " ").trim();
  const provinceNamesKiny: Record<string, string> = {
    "city of kigali": "Umujyi wa Kigali",
    "kigali city": "Umujyi wa Kigali",
    "kigali": "Umujyi wa Kigali",
    "southern province": "Intara y'Amajyepfo",
    "western province": "Intara y'Iburengerazuba",
    "northern province": "Intara y'Amajyaruguru",
    "eastern province": "Intara y'Iburasirazuba",
  };
  const provinceNameKiny = provinceNamesKiny[provinceNameKey] ?? provinceNameEng;
  const districtName = field(top.props, "district");
  const sectorName = field(top.props, "sector");
  const cellName = field(top.props, "cell");
  const hierarchy: LocateSuccess["hierarchy"] = {
    village: matches[0],
  };

  if (provinceNameEng) {
    hierarchy.province = asMatch(
      top.codes.province,
      "province",
      matches[0].confidence,
      top.area,
      provinceNameKiny,
      provinceNameEng
    );
  }
  if (districtName) {
    hierarchy.district = asMatch(
      top.codes.district, "district",
      matches[0].confidence, top.area, districtName, districtName
    );
  }
  if (sectorName) {
    hierarchy.sector = asMatch(
      top.codes.sector, "sector",
      matches[0].confidence, top.area, sectorName, sectorName
    );
  }
  if (cellName) {
    hierarchy.cell = asMatch(
      top.codes.cell, "cell",
      matches[0].confidence, top.area, cellName, cellName
    );
  }

  const result: LocateSuccess = {
    status: "success",
    matches,
    hierarchy,
    // Official boundary data does not contain verified current leader contacts.
    leaders: [],
    source: nearestFallbackUsed ? "nearest" : "gps",
  };

  if (nearestFallbackUsed) {
    result.warning = "NEAREST_VILLAGE_ESTIMATE";
  } else if (matches.length > 1 && matches[1].confidence > 5) {
    result.warning =
      "GPS_ACCURACY_AREA_CROSSES_VILLAGE_BOUNDARIES";
  }
  return result;
}
