/**
 * Offline Geospatial Confidence Algorithm using @turf/turf.
 * Used by the Service Worker / frontend when navigator.onLine === false.
 * Uses downloaded NISR village polygons for nationwide offline confidence.
 */

import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import type { BoundaryLevel, ConfidenceMatch } from "@/types/boundary";
import type { LocateError, LocateSuccess } from "@/types/location";
import { createLocateError } from "@/lib/utils/errors";

export interface OfflineBoundaryProperties {
  scope_code: string;
  name_kiny: string;
  name_eng: string | null;
  level: BoundaryLevel;
  path: string;
  province_scope_code?: string;
  province_name?: string;
  province_name_eng?: string;
  district_scope_code?: string;
  district_name?: string;
  sector_scope_code?: string;
  sector_name?: string;
  cell_scope_code?: string;
  cell_name?: string;
}

export type OfflineBoundaryFeature = Feature<
  Polygon | MultiPolygon,
  OfflineBoundaryProperties
>;

export type OfflineBoundaryCollection = FeatureCollection<
  Polygon | MultiPolygon,
  OfflineBoundaryProperties
>;

const RWANDA_BBOX: [number, number, number, number] = [28.85, -2.85, 30.90, -1.05]; // rough

/**
 * Create a circular polygon approximating the GPS accuracy circle.
 * Radius is in meters; Turf uses kilometers → convert.
 */
function accuracyCircle(
  lng: number,
  lat: number,
  accuracyMeters: number,
  steps = 64
): Feature<Polygon> {
  const radiusKm = accuracyMeters / 1000;
  return turf.circle([lng, lat], radiusKm, {
    steps,
    units: "kilometers",
  });
}

/**
 * Compute intersection area in square meters between two polygons.
 */
function intersectionAreaM2(
  a: Feature<Polygon | MultiPolygon>,
  b: Feature<Polygon | MultiPolygon>
): number {
  try {
    const inter = turf.intersect(turf.featureCollection([a, b]));
    if (!inter) return 0;
    // turf.area returns m²
    return turf.area(inter);
  } catch {
    return 0;
  }
}

/**
 * Offline confidence calculation.
 *
 * @param latitude   WGS84 latitude
 * @param longitude  WGS84 longitude
 * @param accuracy   GPS accuracy in meters
 * @param boundaries Cached nationwide NISR village FeatureCollection
 */
export function calculateConfidenceOffline(
  latitude: number,
  longitude: number,
  accuracy: number,
  boundaries: OfflineBoundaryCollection
): LocateSuccess | LocateError {
  // 1. Basic validation
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude)
  ) {
    return createLocateError("GPS_DENIED");
  }

  // Rough Rwanda check
  const [minLng, minLat, maxLng, maxLat] = RWANDA_BBOX;
  if (
    longitude < minLng ||
    longitude > maxLng ||
    latitude < minLat ||
    latitude > maxLat
  ) {
    return createLocateError("OUTSIDE_RWANDA");
  }

  if (!boundaries?.features?.length) {
    return createLocateError("OFFLINE_CACHE");
  }

  const point = turf.point([longitude, latitude]);
  const circle = accuracyCircle(longitude, latitude, accuracy);
  const circleArea = turf.area(circle); // m²

  if (circleArea <= 0) {
    return createLocateError("GPS_ACCURACY_TOO_LOW", { accuracy });
  }

  // 2. Intersect with every village polygon
  const matches: ConfidenceMatch[] = [];

  for (const feature of boundaries.features) {
    if (feature.properties.level !== "village") continue;

    const interArea = intersectionAreaM2(circle, feature);
    if (interArea <= 0) continue;

    const confidence = Math.min(100, (interArea / circleArea) * 100);

    matches.push({
      scope_code: feature.properties.scope_code,
      name_kiny: feature.properties.name_kiny,
      name_eng: feature.properties.name_eng,
      level: feature.properties.level,
      confidence: Math.round(confidence * 100) / 100,
      intersection_area_m2: interArea,
    });
  }

  if (matches.length === 0) {
    // For gaps in polygons, rank genuine village features by distance to their
    // centroid. This is an estimate, not a calibrated GPS probability.
    const nearest = boundaries.features
      .filter((feature) => feature.properties.level === "village")
      .map((feature) => ({
        feature,
        distance: turf.distance(point, turf.centroid(feature), { units: "meters" }),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
    const withinRwanda = nearest.filter((item) => item.distance <= 50_000);
    if (withinRwanda.length === 0) return createLocateError("OUTSIDE_RWANDA");
    const weights = withinRwanda.map((item) => Math.exp(-item.distance / Math.max(250, accuracy)));
    const total = weights.reduce((sum, value) => sum + value, 0);
    withinRwanda.forEach((item, index) => {
      matches.push({
        scope_code: item.feature.properties.scope_code,
        name_kiny: item.feature.properties.name_kiny,
        name_eng: item.feature.properties.name_eng,
        level: "village",
        confidence: Math.round((weights[index] / total) * 10000) / 100,
        intersection_area_m2: 0,
      });
    });
  }

  // Sort by confidence descending
  matches.sort((a, b) => b.confidence - a.confidence);

  const maxConfidence = matches[0].confidence;
  if (maxConfidence < MIN_CONFIDENCE) {
    return createLocateError("CONFIDENCE_TOO_LOW", {
      max_confidence: maxConfidence,
    });
  }

  // Normalise so percentages sum to ~100 when multiple overlaps
  const totalConf = matches.reduce((s, m) => s + m.confidence, 0);
  if (totalConf > 100 && matches.length > 1) {
    for (const m of matches) {
      m.confidence = Math.round((m.confidence / totalConf) * 10000) / 100;
    }
  }

  // The national download stores each official village polygon once and carries
  // its parent names/codes as attributes. Derive the administrative hierarchy
  // from those official attributes without inventing parent polygons.
  const hierarchy: LocateSuccess["hierarchy"] = {};
  const top = matches[0];
  hierarchy.village = top;

  const topFeature = boundaries.features.find(
    (feature) => feature.properties.scope_code === top.scope_code
  );
  const properties = topFeature?.properties;
  if (properties?.province_scope_code && properties.province_name) {
    hierarchy.province = {
      scope_code: properties.province_scope_code,
      name_kiny: properties.province_name,
      name_eng: properties.province_name_eng ?? properties.province_name,
      level: "province",
      confidence: top.confidence,
      intersection_area_m2: top.intersection_area_m2,
    };
  }
  if (properties?.district_scope_code && properties.district_name) {
    hierarchy.district = {
      scope_code: properties.district_scope_code,
      name_kiny: properties.district_name,
      name_eng: properties.district_name,
      level: "district",
      confidence: top.confidence,
      intersection_area_m2: top.intersection_area_m2,
    };
  }
  if (properties?.sector_scope_code && properties.sector_name) {
    hierarchy.sector = {
      scope_code: properties.sector_scope_code,
      name_kiny: properties.sector_name,
      name_eng: properties.sector_name,
      level: "sector",
      confidence: top.confidence,
      intersection_area_m2: top.intersection_area_m2,
    };
  }
  if (properties?.cell_scope_code && properties.cell_name) {
    hierarchy.cell = {
      scope_code: properties.cell_scope_code,
      name_kiny: properties.cell_name,
      name_eng: properties.cell_name,
      level: "cell",
      confidence: top.confidence,
      intersection_area_m2: top.intersection_area_m2,
    };
  }

  return {
    status: "success",
    matches: matches.slice(0, 3),
    hierarchy,
    leaders: [], // Offline mode is read-only for boundaries; leaders require network
    source: matches[0].intersection_area_m2 > 0 ? "offline" : "nearest",
    warning: matches[0].intersection_area_m2 > 0 ? undefined : "OFFLINE_NEAREST_ESTIMATE",
  };
}
