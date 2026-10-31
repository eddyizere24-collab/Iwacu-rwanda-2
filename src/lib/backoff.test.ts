import assert from "node:assert/strict";
import test from "node:test";
import { backoffLocation, calibrationLookup } from "./backoff";

function village(
  id: string,
  raw_score: number,
  parentCodes: { cell?: string; sector?: string; district?: string; province?: string } = {},
) {
  const province = parentCodes.province ?? "RW-P2";
  const district = parentCodes.district ?? "RW-P2-D21";
  const sector = parentCodes.sector ?? "RW-P2-D21-S2101";
  const cell = parentCodes.cell ?? "RW-P2-D21-S2101-C210101";
  return {
    scope_code: id,
    name_kiny: "Umudugudu " + id,
    name_eng: null,
    raw_score,
    parent_chain: {
      akagari: { scope_code: cell, name_kiny: "Akagari " + cell },
      umurenge: { scope_code: sector, name_kiny: "Umurenge " + sector },
      akarere: { scope_code: district, name_kiny: "Akarere " + district },
      intara: { scope_code: province, name_kiny: "Intara " + province },
    },
  };
}

test("one village with a 0.97 raw score selects village", () => {
  const result = backoffLocation([village("RW-P2-D21-S2101-C210101-V21010101", 0.97)]);
  assert.equal(result.chosen_level, "village");
  assert.equal(result.chosen.scope_code, "RW-P2-D21-S2101-C210101-V21010101");
  assert.equal(result.top3_villages.length, 1);
  assert.equal(result.top3_villages[0].calibrated_probability, 1);
});

test("three villages in one akagari aggregate to the akagari level", () => {
  const result = backoffLocation([
    village("RW-P2-D21-S2101-C210101-V21010101", 0.30),
    village("RW-P2-D21-S2101-C210101-V21010102", 0.30),
    village("RW-P2-D21-S2101-C210101-V21010103", 0.30),
  ]);
  assert.equal(result.chosen_level, "cell");
  assert.equal(result.chosen.scope_code, "RW-P2-D21-S2101-C210101");
  assert.equal(result.per_level_candidates.cell?.[0].calibrated_probability, 1);
});

test("two akarere at 0.5/0.5 select their shared intara", () => {
  const result = backoffLocation([
    village("RW-P2-D21-S2101-C210101-V21010101", 0.5, { district: "RW-P2-D21" }),
    village("RW-P2-D22-S2201-C220101-V22010101", 0.5, {
      district: "RW-P2-D22", sector: "RW-P2-D22-S2201", cell: "RW-P2-D22-S2201-C220101",
    }),
  ]);
  assert.equal(result.chosen_level, "province");
  assert.equal(result.chosen.scope_code, "RW-P2");
  assert.equal(result.path.intara, "Intara RW-P2");
  assert.equal(result.path.akarere, undefined);
});

test("all zero scores still return non-empty intara candidates", () => {
  const result = backoffLocation([
    village("RW-P2-D21-S2101-C210101-V21010101", 0),
    village("RW-P2-D22-S2201-C220101-V22010101", 0, {
      district: "RW-P2-D22", sector: "RW-P2-D22-S2201", cell: "RW-P2-D22-S2201-C220101",
    }),
  ]);
  assert.equal(result.chosen_level, "province");
  assert.ok((result.per_level_candidates.province ?? []).length > 0);
  assert.equal(result.path.intara, "Intara RW-P2");
});

test("calibration lookup is monotone, interpolates, and clamps at both ends", () => {
  const curve = { x: [0.2, 0.5, 0.8], y: [0.1, 0.4, 0.9] };
  assert.equal(calibrationLookup(-10, curve), 0.1);
  assert.equal(calibrationLookup(10, curve), 0.9);
  assert.equal(calibrationLookup(0.65, curve), 0.65);
  const points = [0, 0.2, 0.4, 0.6, 0.8, 1].map((x) => calibrationLookup(x, curve));
  assert.deepEqual(points, [...points].sort((a, b) => a - b));
});
