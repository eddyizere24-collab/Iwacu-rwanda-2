import type { ConfidenceMatch } from "@/types/boundary";
import type { LocateSuccess } from "@/types/location";

const RWANDA_PROVINCES = [
  ["RW-P1", "Umujyi wa Kigali"],
  ["RW-P2", "Intara y'Amajyepfo"],
  ["RW-P3", "Intara y'Iburengerazuba"],
  ["RW-P4", "Intara y'Amajyaruguru"],
  ["RW-P5", "Intara y'Iburasirazuba"],
] as const;

/**
 * Honest non-empty baseline for the Rwanda-only service when no coordinates,
 * IP hint or previous fix can be obtained. These equal shares are an
 * uninformative service-area prior, not a claim about the user's location.
 */
export function createRwandaProvincePrior(countryKnownToBeRwanda = false): LocateSuccess {
  const provinces: ConfidenceMatch[] = RWANDA_PROVINCES.map(([scope_code, name]) => ({
    scope_code,
    name_kiny: name,
    name_eng: null,
    level: "province",
    confidence: 20,
    intersection_area_m2: 0,
  }));

  return {
    status: "success",
    matches: provinces,
    hierarchy: {
      country: {
        scope_code: "RW",
        name_kiny: countryKnownToBeRwanda ? "U Rwanda" : "U Rwanda (aho serivisi ikorera)",
        name_eng: "Rwanda",
        level: "country",
        confidence: countryKnownToBeRwanda ? 100 : 0,
        intersection_area_m2: 0,
      },
      province: provinces[0],
    },
    hierarchyCandidates: { province: provinces },
    leaders: [],
    source: "prior",
    warning: countryKnownToBeRwanda
      ? "COUNTRY_ONLY_UNINFORMATIVE_PROVINCE_PRIOR"
      : "NO_LOCATION_SIGNAL_EQUAL_RWANDA_SERVICE_AREA_PRIOR",
  };
}

type ConfirmedChoice = {
  scope_code: string;
  name_kiny: string;
  name_eng: string | null;
  level: "province" | "district" | "sector" | "cell" | "village";
  parent_scope_code: string | null;
};

/**
 * Reuses a citizen's last explicitly confirmed village only as a recency prior.
 * Its score is a decay weight, not a probability that the citizen is still there.
 */
export function createLastConfirmedVillagePrior(
  payload: unknown,
  scopeCode: string,
  ageMs: number
): LocateSuccess | null {
  if (!scopeCode || !Number.isFinite(ageMs) || ageMs < 0 || ageMs > 30 * 24 * 60 * 60 * 1000) {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const raw = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(raw)) return null;

  const choices = raw.flatMap((entry): ConfirmedChoice[] => {
    if (Array.isArray(entry) && entry.length >= 5) {
      const level = String(entry[3]);
      if (!["province", "district", "sector", "cell", "village"].includes(level)) return [];
      return [{
        scope_code: String(entry[0] ?? ""),
        name_kiny: String(entry[1] ?? ""),
        name_eng: entry[2] == null ? null : String(entry[2]),
        level: level as ConfirmedChoice["level"],
        parent_scope_code: entry[4] == null ? null : String(entry[4]),
      }];
    }
    if (entry && typeof entry === "object") {
      const row = entry as Record<string, unknown>;
      const level = String(row.level ?? "");
      if (!["province", "district", "sector", "cell", "village"].includes(level)) return [];
      return [{
        scope_code: String(row.scope_code ?? ""),
        name_kiny: String(row.name_kiny ?? ""),
        name_eng: typeof row.name_eng === "string" ? row.name_eng : null,
        level: level as ConfirmedChoice["level"],
        parent_scope_code: typeof row.parent_scope_code === "string" ? row.parent_scope_code : null,
      }];
    }
    return [];
  }).filter((choice) => choice.scope_code && choice.name_kiny);

  const byCode = new Map(choices.map((choice) => [choice.scope_code, choice]));
  let current = byCode.get(scopeCode);
  if (!current || current.level !== "village") return null;

  const recencyWeight = Math.max(1, Math.round(100 * Math.exp(-ageMs / (7 * 24 * 60 * 60 * 1000))));
  const hierarchy: LocateSuccess["hierarchy"] = {};
  const hierarchyCandidates: NonNullable<LocateSuccess["hierarchyCandidates"]> = {};
  let village: ConfidenceMatch | null = null;

  for (let depth = 0; current && depth < 5; depth += 1) {
    const match: ConfidenceMatch = {
      scope_code: current.scope_code,
      name_kiny: current.name_kiny,
      name_eng: current.name_eng,
      level: current.level,
      confidence: recencyWeight,
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
    hierarchyCandidates[current.level] = [match];
    current = current.parent_scope_code ? byCode.get(current.parent_scope_code) : undefined;
  }

  if (!village) return null;
  return {
    status: "success",
    matches: [village],
    hierarchy,
    hierarchyCandidates,
    leaders: [],
    source: "last-known",
    warning: "LAST_CONFIRMED_VILLAGE_RECENCY_PRIOR_NOT_CURRENT_LOCATION",
  };
}
