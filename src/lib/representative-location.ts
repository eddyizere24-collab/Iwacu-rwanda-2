import type { ConfidenceMatch } from "@/types/boundary";
import type { LocateSuccess } from "@/types/location";

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

  const nearest = villages
    .map((choice) => ({
      choice,
      distance: distanceMeters(latitude, longitude, choice.latitude, choice.longitude),
    }))
    .filter((item) => Number.isFinite(item.distance))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  if (nearest.length === 0) return null;

  const scale = Math.max(250, Number.isFinite(accuracyMeters) && accuracyMeters > 0 ? accuracyMeters : 1_000);
  const weights = nearest.map((item) => Math.exp(-item.distance / scale));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const matches: ConfidenceMatch[] = nearest.map((item, index) => ({
    scope_code: item.choice.scope_code,
    name_kiny: item.choice.name_kiny,
    name_eng: item.choice.name_eng,
    level: "village",
    confidence: totalWeight > 0 ? Math.round((weights[index] / totalWeight) * 10_000) / 100 : 0,
    intersection_area_m2: 0,
  }));

  const byCode = new Map(choices.map((choice) => [choice.scope_code, choice]));
  const hierarchy: LocateSuccess["hierarchy"] = {};
  let current: RepresentativeChoice | undefined = byCode.get(matches[0].scope_code);

  for (let depth = 0; current && depth < 5; depth += 1) {
    const match: ConfidenceMatch = {
      scope_code: current.scope_code,
      name_kiny: current.name_kiny,
      name_eng: current.name_eng,
      level: current.level,
      confidence: matches[0].confidence,
      intersection_area_m2: 0,
    };
    if (current.level === "village") hierarchy.village = match;
    if (current.level === "cell") hierarchy.cell = match;
    if (current.level === "sector") hierarchy.sector = match;
    if (current.level === "district") hierarchy.district = match;
    if (current.level === "province") hierarchy.province = match;
    current = current.parent_scope_code ? byCode.get(current.parent_scope_code) : undefined;
  }

  return {
    status: "success",
    matches,
    hierarchy,
    leaders: [],
    source: "nearest",
    warning,
  };
}
