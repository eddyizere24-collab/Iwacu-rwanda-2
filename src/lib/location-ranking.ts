/**
 * Rank villages by GPS overlap plus a weak IP-derived district prior.
 *
 * The IP hint is used only to order candidates already supplied by the GPS
 * polygon query; it can never introduce a candidate or claim a village by
 * itself. GPS contributes 85% and the district prior 15%. The returned
 * confidence field remains the original geometric overlap score and is NOT
 * a calibrated probability.
 */
export type VillageRankingCandidate = {
  scope_code: string;
  confidence: number;
};

export function rankVillageCandidates<T extends VillageRankingCandidate>(
  matches: T[],
  districtPrior: ReadonlyMap<string, number>
): T[] {
  if (matches.length < 2 || districtPrior.size === 0) {
    return [...matches].sort((a, b) => b.confidence - a.confidence);
  }

  const totalGpsScore = matches.reduce(
    (sum, item) => sum + Math.max(Number(item.confidence) || 0, 0),
    0
  );

  return matches
    .map((item, originalIndex) => {
      const parts = item.scope_code.split("-");
      const districtCode = parts.length >= 3 ? parts.slice(0, 3).join("-") : "";
      const gpsShare = totalGpsScore > 0
        ? Math.max(Number(item.confidence) || 0, 0) / totalGpsScore
        : 0;
      const ipShare = districtPrior.get(districtCode) ?? 0;
      return {
        item,
        originalIndex,
        rankScore: (gpsShare * 0.85) + (ipShare * 0.15),
      };
    })
    .sort((a, b) =>
      b.rankScore - a.rankScore ||
      b.item.confidence - a.item.confidence ||
      a.originalIndex - b.originalIndex
    )
    .map((entry) => entry.item);
}
