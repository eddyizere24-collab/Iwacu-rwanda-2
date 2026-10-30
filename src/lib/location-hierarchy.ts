import type { ConfidenceMatch } from "@/types/boundary";

export type HierarchyCandidateLevel = "province" | "district" | "sector" | "cell" | "village";

export type HierarchyAggregate = {
  scope_code: string;
  level: HierarchyCandidateLevel;
  confidence: number;
  intersection_area_m2: number;
};

export type HierarchyAggregateResult = Partial<Record<HierarchyCandidateLevel, HierarchyAggregate[]>>;

/**
 * Sums village/polygon intersection shares into their official NISR parent
 * prefixes. Scores remain geometric shares of the reported uncertainty circle;
 * they are not labelled or calibrated as real-world probabilities.
 */
export function aggregateLocationHierarchy(
  villageRows: readonly ConfidenceMatch[]
): HierarchyAggregateResult {
  const sums = new Map<HierarchyCandidateLevel, Map<string, { confidence: number; area: number }>>();
  const add = (level: HierarchyCandidateLevel, code: string, confidence: number, area: number) => {
    if (!sums.has(level)) sums.set(level, new Map());
    const levelMap = sums.get(level)!;
    const current = levelMap.get(code) ?? { confidence: 0, area: 0 };
    current.confidence += Math.max(0, Number(confidence) || 0);
    current.area += Math.max(0, Number(area) || 0);
    levelMap.set(code, current);
  };

  for (const row of villageRows) {
    if (row.level !== "village") continue;
    const parts = row.scope_code.split("-");
    if (
      parts.length < 6 ||
      parts[0] !== "RW" ||
      !/^P\d+$/.test(parts[1] ?? "") ||
      !/^D\d+$/.test(parts[2] ?? "") ||
      !/^S\d+$/.test(parts[3] ?? "") ||
      !/^C\d+$/.test(parts[4] ?? "") ||
      !/^V\d+$/.test(parts[5] ?? "")
    ) continue;

    add("province", parts.slice(0, 2).join("-"), row.confidence, row.intersection_area_m2);
    add("district", parts.slice(0, 3).join("-"), row.confidence, row.intersection_area_m2);
    add("sector", parts.slice(0, 4).join("-"), row.confidence, row.intersection_area_m2);
    add("cell", parts.slice(0, 5).join("-"), row.confidence, row.intersection_area_m2);
    add("village", parts.slice(0, 6).join("-"), row.confidence, row.intersection_area_m2);
  }

  const totalVillageShare = Array.from(sums.get("village")?.values() ?? [])
    .reduce((total, item) => total + item.confidence, 0);
  // Polygon overlaps can make the raw total exceed the uncertainty circle.
  // Scale all levels consistently in that case; never inflate gaps to 100%.
  const scale = totalVillageShare > 100 ? 100 / totalVillageShare : 1;

  const result: HierarchyAggregateResult = {};
  for (const level of ["province", "district", "sector", "cell", "village"] as const) {
    const values = sums.get(level);
    if (!values) continue;
    result[level] = Array.from(values, ([scope_code, value]) => ({
      scope_code,
      level,
      confidence: Math.round(value.confidence * scale * 100) / 100,
      intersection_area_m2: Math.round(value.area * 100) / 100,
    })).sort((a, b) => b.confidence - a.confidence || a.scope_code.localeCompare(b.scope_code));
  }
  return result;
}
