import calibrationConfig from "./calibration-v1.json";

export const BACKOFF_LEVELS = ["village", "cell", "sector", "district", "province"] as const;
export type BackoffLevel = typeof BACKOFF_LEVELS[number];

export interface BackoffNode {
  scope_code: string;
  name_kiny: string;
  name_eng?: string | null;
  intersection_area_m2?: number;
}

export interface BackoffVillageInput extends BackoffNode {
  raw_score: number;
  parent_chain: {
    akagari?: BackoffNode | null;
    umurenge?: BackoffNode | null;
    akarere?: BackoffNode | null;
    intara?: BackoffNode | null;
  };
}

export interface BackoffCandidate extends BackoffNode {
  level: BackoffLevel;
  raw_score: number;
  calibrated_probability: number;
  /** Existing API compatibility: raw probability represented on a 0–100 scale. */
  confidence: number;
}

export interface BackoffResult {
  chosen_level: BackoffLevel;
  chosen: BackoffCandidate;
  hierarchy: Partial<Record<BackoffLevel, BackoffCandidate>>;
  path: {
    intara?: string;
    akarere?: string;
    umurenge?: string;
    akagari?: string;
    umudugudu?: string;
  };
  per_level_candidates: Partial<Record<BackoffLevel, BackoffCandidate[]>>;
  top3_villages: BackoffCandidate[];
}

interface CalibrationCurve {
  x: number[];
  y: number[];
}
interface CalibrationFile {
  version: string;
  tau: number;
  levels: Record<BackoffLevel, CalibrationCurve>;
}

const CALIBRATION = calibrationConfig as CalibrationFile;
export const TAU = Number.isFinite(CALIBRATION.tau)
  ? Math.min(1, Math.max(0, CALIBRATION.tau))
  : 0.8;
export const CALIBRATION_VERSION = CALIBRATION.version || "unknown";

/** Piecewise-linear isotonic lookup. Inputs outside the knots clamp to the endpoints. */
export function calibrationLookup(value: number, curve: CalibrationCurve): number {
  const x = curve.x;
  const y = curve.y;
  if (!Array.isArray(x) || !Array.isArray(y) || x.length === 0 || x.length !== y.length) {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  }
  if (x.some((v, i) => !Number.isFinite(v) || (i > 0 && v < x[i - 1])) ||
      y.some((v, i) => !Number.isFinite(v) || v < 0 || v > 1 ||
        (i > 0 && v < y[i - 1]))) {
    throw new Error("Calibration curve must have finite, monotone x/y arrays in [0,1].");
  }
  const input = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  if (input <= x[0]) return y[0];
  if (input >= x[x.length - 1]) return y[y.length - 1];

  for (let index = 1; index < x.length; index += 1) {
    if (input <= x[index]) {
      const width = x[index] - x[index - 1];
      if (width <= 0) return y[index];
      const fraction = (input - x[index - 1]) / width;
      return Math.min(1, Math.max(0, y[index - 1] + fraction * (y[index] - y[index - 1])));
    }
  }
  return y[y.length - 1];
}

function safeScore(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalise<T extends { score: number }>(items: T[]): Array<T & { probability: number }> {
  const total = items.reduce((sum, item) => sum + item.score, 0);
  return items.map((item) => ({
    ...item,
    probability: total > 0 ? item.score / total : 0,
  }));
}

type Aggregate = {
  node: BackoffNode;
  score: number;
  area: number;
  path: Partial<Record<BackoffLevel, BackoffNode>>;
};

const NODE_LEVELS: Record<BackoffLevel, keyof BackoffVillageInput["parent_chain"] | null> = {
  village: null,
  cell: "akagari",
  sector: "umurenge",
  district: "akarere",
  province: "intara",
};

function nodeFor(village: BackoffVillageInput, level: BackoffLevel): BackoffNode | null {
  if (level === "village") return village;
  return village.parent_chain[NODE_LEVELS[level] as keyof BackoffVillageInput["parent_chain"]] ?? null;
}

/**
 * Pure administrative back-off. Village scores are summed into every supplied
 * parent, normalised independently per level, then calibrated. Calibrated
 * probabilities are individual isotonic estimates and are not re-normalised.
 */
export function backoffLocation(
  villages: readonly BackoffVillageInput[],
  tau: number = TAU,
): BackoffResult {
  const aggregates = new Map<BackoffLevel, Map<string, Aggregate>>();

  for (const village of villages) {
    const score = safeScore(village.raw_score);
    const area = safeScore(village.intersection_area_m2 ?? 0);
    for (const level of BACKOFF_LEVELS) {
      const node = nodeFor(village, level);
      if (!node?.scope_code || !node.name_kiny) continue;
      let levelMap = aggregates.get(level);
      if (!levelMap) {
        levelMap = new Map();
        aggregates.set(level, levelMap);
      }
      const current = levelMap.get(node.scope_code);
      const path: Partial<Record<BackoffLevel, BackoffNode>> = {
        province: village.parent_chain.intara ?? undefined,
        district: village.parent_chain.akarere ?? undefined,
        sector: village.parent_chain.umurenge ?? undefined,
        cell: village.parent_chain.akagari ?? undefined,
        village,
      };
      if (current) {
        current.score += score;
        current.area += area;
      } else {
        levelMap.set(node.scope_code, { node, score, area, path });
      }
    }
  }

  const perLevel: Partial<Record<BackoffLevel, BackoffCandidate[]>> = {};
  const allPerLevel = new Map<BackoffLevel, BackoffCandidate[]>();
  for (const level of BACKOFF_LEVELS) {
    const entries = Array.from(aggregates.get(level)?.values() ?? []);
    if (!entries.length) continue;

    const raw = normalise(entries.map((entry) => ({ ...entry, score: entry.score })));
    const curve = CALIBRATION.levels[level];
    const sortedCandidates = raw.map((entry) => {
      const rawScore = entry.probability;
      const calibrated = curve ? calibrationLookup(rawScore, curve) : rawScore;
      return {
        ...entry.node,
        level,
        intersection_area_m2: entry.area,
        raw_score: rawScore,
        calibrated_probability: calibrated,
        confidence: rawScore * 100,
      };
    }).sort((a, b) =>
      b.calibrated_probability - a.calibrated_probability ||
      a.scope_code.localeCompare(b.scope_code)
    );
    allPerLevel.set(level, sortedCandidates);
    perLevel[level] = sortedCandidates.slice(0, 3);
  }

  // Select the finest level that meets TAU. Province/intara is the guaranteed
  // final answer even when none of its candidates reaches the threshold.
  const threshold = Number.isFinite(tau) ? Math.min(1, Math.max(0, tau)) : TAU;
  let chosenLevel: BackoffLevel = "province";
  for (const level of BACKOFF_LEVELS) {
    const top = perLevel[level]?.[0];
    if (top && top.calibrated_probability >= threshold) {
      chosenLevel = level;
      break;
    }
  }

  let chosen = perLevel[chosenLevel]?.[0];
  if (!chosen) {
    const fallback = villages.find((item) => item.parent_chain.intara?.scope_code);
    const node = fallback?.parent_chain.intara;
    if (!node) {
      throw new Error("Backoff requires at least one village with an intara/province parent.");
    }
    chosen = {
      ...node,
      level: "province",
      raw_score: 0,
      calibrated_probability: 0,
      confidence: 0,
      intersection_area_m2: 0,
    };
    perLevel.province = [chosen];
  }

  const chosenEntry = Array.from(aggregates.get(chosenLevel)?.values() ?? [])
    .find((entry) => entry.node.scope_code === chosen?.scope_code);
  const lineage = chosenEntry?.path ?? {};
  const hierarchy: Partial<Record<BackoffLevel, BackoffCandidate>> = {};
  const pathLevelIndex = BACKOFF_LEVELS.indexOf(chosenLevel);
  for (const level of BACKOFF_LEVELS) {
    if (BACKOFF_LEVELS.indexOf(level) < pathLevelIndex) continue;
    const node = lineage[level];
    if (!node) continue;
    const candidate = allPerLevel.get(level)?.find((item) => item.scope_code === node.scope_code);
    if (candidate) hierarchy[level] = candidate;
  }
  hierarchy[chosenLevel] = chosen;

  const path = {
    intara: lineage.province?.name_kiny,
    akarere: lineage.district?.name_kiny,
    umurenge: lineage.sector?.name_kiny,
    akagari: lineage.cell?.name_kiny,
    umudugudu: lineage.village?.name_kiny,
  };
  if (pathLevelIndex > 0) path.umudugudu = undefined;
  if (pathLevelIndex > 1) path.akagari = undefined;
  if (pathLevelIndex > 2) path.umurenge = undefined;
  if (pathLevelIndex > 3) path.akarere = undefined;

  return {
    chosen_level: chosenLevel,
    chosen,
    hierarchy,
    path,
    per_level_candidates: perLevel,
    top3_villages: perLevel.village ?? [],
  };
}
