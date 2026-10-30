import type { ConfidenceMatch } from "./boundary";
import type { LeaderPublic } from "./leader";

/** All 15 mandatory error states */
export type LocationErrorCode =
  | "GPS_DENIED"
  | "GPS_UNAVAILABLE"
  | "GPS_TIMEOUT"
  | "OUTSIDE_RWANDA"
  | "POINT_IN_GAP"
  | "POINT_IN_OVERLAP"
  | "CONFIDENCE_TOO_LOW"         // < 5 %
  | "MISSING_LEADER_CONTACT"
  | "NETWORK_ERROR"              // 502 / fetch failure
  | "NOT_FOUND"                  // 404
  | "SLOW_NETWORK"
  | "OFFLINE_CACHE"
  | "BROWSER_NOT_SUPPORTED"
  | "RATE_LIMIT"
  | "CONCURRENT_EDIT_CONFLICT"   // 409
  | "LEADER_MISSING";

export interface LocateRequest {
  latitude: number;
  longitude: number;
  accuracy: number; // meters
}

export interface LocateSuccess {
  status: "success";
  matches: ConfidenceMatch[];   // sorted by confidence DESC
  hierarchy: {
    country?: ConfidenceMatch;
    province?: ConfidenceMatch;
    village?: ConfidenceMatch;
    cell?: ConfidenceMatch;
    sector?: ConfidenceMatch;
    district?: ConfidenceMatch;
  };
  leaders: LeaderPublic[];
  source: "gps" | "network" | "ip" | "manual" | "offline" | "nearest" | "map" | "last-known" | "prior";
  warning?: string;
  /** Device-reported uncertainty radius, inflated for stale fixes when applicable. */
  accuracy_m?: number;
  /** WGS84 point that produced the answer, when a measured coordinate exists. */
  latitude?: number;
  longitude?: number;
  /** Age of the underlying device fix at the time it was submitted. */
  fix_age_ms?: number;
  /** Candidate shares aggregated by administrative level; geometric shares, not calibrated probabilities. */
  hierarchyCandidates?: Partial<Record<"province" | "district" | "sector" | "cell" | "village", ConfidenceMatch[]>>;
}

export interface LocateError {
  status: "error";
  code: LocationErrorCode;
  message_kiny: string;         // Formal Kinyarwanda, actionable
  message_eng: string;
  details?: Record<string, unknown>;
}

export type LocateResponse = LocateSuccess | LocateError;
