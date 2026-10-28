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
const MIN_CONFIDENCE = 5;

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
  const circle = turf.circle([longitude, latitude], accuracyMeters / 1000, {
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
    return createLocateError("GPS_ACCURACY_TOO_LOW", { accuracy: accuracyMeters });
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

  if (rawMatches.length === 0) {
    return createLocateError("POINT_IN_GAP", {
      source: NISR_SOURCE,
      message:
        "No official village polygon intersects the reported GPS accuracy area. The source dataset does not cover every gazetted village and excludes some Lake Kivu area.",
    });
  }

  rawMatches.sort((a, b) => b.confidence - a.confidence);
  const top = rawMatches[0];

  if (top.confidence < MIN_CONFIDENCE) {
    return createLocateError("CONFIDENCE_TOO_LOW", {
      max_confidence: Math.round(top.confidence * 100) / 100,
      source: NISR_SOURCE,
    });
  }

  const matches: ConfidenceMatch[] = rawMatches.map((item) =>
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

  const provinceId = field(top.props, "province_id");
  const provinceNameEng = field(top.props, "province");
  const provinceNamesKiny: Record<string, string> = {
    "1": "Umujyi wa Kigali",
    "2": "Intara y'Amajyepfo",
    "3": "Intara y'Iburengerazuba",
    "4": "Intara y'Amajyaruguru",
    "5": "Intara y'Iburasirazuba",
  };
  const provinceNameKiny = provinceNamesKiny[provinceId] ?? provinceNameEng;
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
    source: "gps",
  };

  if (matches.length > 1 && matches[1].confidence > 5) {
    result.warning =
      "GPS_ACCURACY_AREA_CROSSES_VILLAGE_BOUNDARIES";
  }
  return result;
}
