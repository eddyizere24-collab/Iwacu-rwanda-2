import type { ConfidenceMatch } from "@/types/boundary";
import type { LocateSuccess } from "@/types/location";
import { aggregateLocationHierarchy } from "@/lib/location-hierarchy";

type AdministrativeLevel = "province" | "district" | "sector" | "cell" | "village";

type RepresentativeChoice = {
  scope_code: string;
  name_kiny: string;
  name_eng: string | null;
  level: AdministrativeLevel;
  parent_scope_code: string | null;
  latitude: number;
  longitude: number;
};

const LEVELS = new Set<AdministrativeLevel>(["province", "district", "sector", "cell", "village"]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseRepresentativeChoices(payload: unknown): RepresentativeChoice[] {
  if (!payload || typeof payload !== "object") return [];
  const rawChoices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(rawChoices)) return [];

  return rawChoices.flatMap((raw): RepresentativeChoice[] => {
    let choice: RepresentativeChoice;
    if (Array.isArray(raw) && raw.length >= 7) {
      const [scope_code, name_kiny, name_eng, level, parent_scope_code, latitude, longitude] = raw;
      if (
        typeof scope_code !== "string" ||
        typeof name_kiny !== "string" ||
        typeof level !== "string" ||
        !LEVELS.has(level as AdministrativeLevel) ||
        !isFiniteNumber(latitude) ||
        !isFiniteNumber(longitude)
      ) return [];
      choice = {
        scope_code,
        name_kiny,
        name_eng: typeof name_eng === "string" ? name_eng : null,
        level: level as AdministrativeLevel,
        parent_scope_code: typeof parent_scope_code === "string" ? parent_scope_code : null,
        latitude,
        longitude,
      };
    } else if (raw && typeof raw === "object") {
      const row = raw as Record<string, unknown>;
      if (
        typeof row.scope_code !== "string" ||
        typeof row.name_kiny !== "string" ||
        typeof row.level !== "string" ||
        !LEVELS.has(row.level as AdministrativeLevel) ||
        !isFiniteNumber(row.latitude) ||
        !isFiniteNumber(row.longitude)
      ) return [];
      choice = {
        scope_code: row.scope_code,
        name_kiny: row.name_kiny,
        name_eng: typeof row.name_eng === "string" ? row.name_eng : null,
        level: row.level as AdministrativeLevel,
        parent_scope_code: typeof row.parent_scope_code === "string" ? row.parent_scope_code : null,
        latitude: row.latitude,
        longitude: row.longitude,
      };
    } else {
      return [];
    }

    return choice.scope_code && choice.name_kiny ? [choice] : [];
  });
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

/**
 * Builds an explicitly estimated village result from official boundary
 * representative points when polygon services have no result or are offline.
 * The distance is point-to-point, not polygon-edge distance; callers/UI must
 * present this only as an estimate and retain the manual village picker.
 */
export function nearestVillageEstimateFromIndex(
  payload: unknown,
  latitude: number,
  longitude: number,
  accuracyMeters = 1_000,
  warning = "NEAREST_VILLAGE_REPRESENTATIVE_POINT_ESTIMATE",
): LocateSuccess | null {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) return null;

  const choices = parseRepresentativeChoices(payload);
  const villages = choices.filter((choice) => choice.level === "village");
  if (villages.length === 0) return null;

  // Use every official village representative point, not only the nearest
  // three. Normalising only three points would force their scores to 100% and
  // falsely hide uncertainty across neighbouring cells/districts.
  const scale = Math.max(250, Number.isFinite(accuracyMeters) && accuracyMeters > 0 ? accuracyMeters : 1_000);
  const searchLimit = Math.max(50_000, Math.min(200_000, scale * 4));
  const candidates = villages
    .map((choice) => ({
      choice,
      distance: distanceMeters(latitude, longitude, choice.latitude, choice.longitude),
    }))
    .filter((item) => Number.isFinite(item.distance) && item.distance <= searchLimit)
    .sort((a, b) => a.distance - b.distance);

  // A very remote point still receives a clearly labelled nearest-Rwanda
  // estimate rather than an empty result.
  const considered = candidates.length > 0
    ? candidates
    : villages
        .map((choice) => ({
          choice,
          distance: distanceMeters(latitude, longitude, choice.latitude, choice.longitude),
        }))
        .filter((item) => Number.isFinite(item.distance))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3);
  if (considered.length === 0) return null;

  // Distance-weighted index scores, not calibrated probabilities. The index
  // has one representative point per village, so this is an estimate until
  // polygon-area/density priors and real-device hit rates are calibrated.
  const weights = considered.map((item) => Math.exp(-item.distance / scale));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  if (!(totalWeight > 0)) return null;
  const allVillageMatches: ConfidenceMatch[] = considered.map((item, index) => ({
    scope_code: item.choice.scope_code,
    name_kiny: item.choice.name_kiny,
    name_eng: item.choice.name_eng,
    level: "village",
    confidence: Math.round((weights[index] / totalWeight) * 10_000) / 100,
    intersection_area_m2: 0,
  }));

  const matches = allVillageMatches.slice(0, 3);
  const byCode = new Map(choices.map((choice) => [choice.scope_code, choice]));
  const aggregates = aggregateLocationHierarchy(allVillageMatches);
  const hierarchyCandidates: NonNullable<LocateSuccess["hierarchyCandidates"]> = {};
  const hierarchy: LocateSuccess["hierarchy"] = {};

  for (const level of ["province", "district", "sector", "cell", "village"] as const) {
    const resolved = (aggregates[level] ?? []).slice(0, 3).flatMap((item) => {
      const choice = byCode.get(item.scope_code);
      if (!choice) return [];
      return [{
        scope_code: choice.scope_code,
        name_kiny: choice.name_kiny,
        name_eng: choice.name_eng,
        level,
        confidence: item.confidence,
        intersection_area_m2: item.intersection_area_m2,
      } satisfies ConfidenceMatch];
    });
    if (resolved.length > 0) {
      hierarchyCandidates[level] = resolved;
      hierarchy[level] = resolved[0];
    }
  }

  return {
    status: "success",
    matches,
    hierarchy,
    hierarchyCandidates,
    leaders: [],
    source: "nearest",
    warning,
  };
}
