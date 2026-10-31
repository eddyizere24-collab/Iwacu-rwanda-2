import type { MultiPolygon } from "geojson";

export type BoundaryLevel =
  | "country"
  | "province"
  | "district"
  | "sector"
  | "cell"
  | "village";

export interface Boundary {
  id: string;
  scope_code: string;
  path: string; // ltree as string
  name_kiny: string;
  name_eng: string | null;
  level: BoundaryLevel;
  parent_id: string | null;
  geom?: MultiPolygon; // only when needed
  area_m2?: number;
  valid_from: string;
  valid_to: string | null;
  version: number;
}

export interface ConfidenceMatch {
  scope_code: string;
  name_kiny: string;
  name_eng: string | null;
  level: BoundaryLevel;
  confidence: number; // legacy 0–100 raw score scale
  intersection_area_m2: number;
  raw_score?: number;
  calibrated_probability?: number;
}
