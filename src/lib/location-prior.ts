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
