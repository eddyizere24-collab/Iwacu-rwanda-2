import assert from "node:assert/strict";
import test from "node:test";
import { nearestVillageEstimateFromIndex } from "./representative-location";

const choices = [
  ["RW-P1", "Umujyi wa Kigali", "City of Kigali", "province", "RW", -1.95, 30.00],
  ["RW-P1-D11", "Nyarugenge", "Nyarugenge", "district", "RW-P1", -1.97, 30.03],
  ["RW-P1-D11-S1101", "Gitega", "Gitega", "sector", "RW-P1-D11", -1.95, 30.05],
  ["RW-P1-D11-S1101-C110101", "Akabahizi", "Akabahizi", "cell", "RW-P1-D11-S1101", -1.945, 30.052],
  ["RW-P1-D11-S1101-C110101-V11010101", "Gihanga", "Gihanga", "village", "RW-P1-D11-S1101-C110101", -1.944, 30.062],
  ["RW-P1-D11-S1101-C110101-V11010102", "Akabugene", "Akabugene", "village", "RW-P1-D11-S1101-C110101", -1.99, 30.15],
  ["RW-P1-D11-S1101-C110101-V11010103", "Nyamabuye", "Nyamabuye", "village", "RW-P1-D11-S1101-C110101", -2.05, 30.2],
  ["RW-P1-D12", "Gasabo", "Gasabo", "district", "RW-P1", -1.88, 30.15],
  ["RW-P1-D12-S1201", "Remera", "Remera", "sector", "RW-P1-D12", -1.88, 30.16],
  ["RW-P1-D12-S1201-C120101", "Nyarutarama", "Nyarutarama", "cell", "RW-P1-D12-S1201", -1.89, 30.17],
  ["RW-P1-D12-S1201-C120101-V12010101", "Rugando", "Rugando", "village", "RW-P1-D12-S1201-C120101", -1.90, 30.18],
];

test("uses real index villages and marks the result as an estimate", () => {
  const result = nearestVillageEstimateFromIndex(
    { version: 2, fields: ["scope_code", "name_kiny", "name_eng", "level", "parent_scope_code", "latitude", "longitude"], choices },
    -1.9441,
    30.0619,
    100,
  );
  assert.ok(result);
  assert.equal(result.status, "success");
  assert.equal(result.source, "nearest");
  assert.equal(result.warning, "NEAREST_VILLAGE_REPRESENTATIVE_POINT_ESTIMATE");
  assert.equal(result.matches[0]?.name_kiny, "Gihanga");
  assert.equal(result.matches[0]?.level, "village");
  assert.equal(result.matches[0]?.intersection_area_m2, 0);
  assert.equal(result.hierarchy.village?.scope_code, result.matches[0]?.scope_code);
  assert.equal(result.hierarchy.cell?.scope_code, "RW-P1-D11-S1101-C110101");
  assert.equal(result.hierarchy.sector?.scope_code, "RW-P1-D11-S1101");
  assert.equal(result.hierarchy.district?.scope_code, "RW-P1-D11");
  assert.equal(result.hierarchy.province?.scope_code, "RW-P1");
});

test("returns only up to three candidate villages in nearest-first order", () => {
  const result = nearestVillageEstimateFromIndex({ choices }, -1.9441, 30.0619, 100);
  assert.ok(result);
  assert.equal(result.matches.length, 3);
  assert.equal(result.matches[0]?.name_kiny, "Gihanga");
  assert.ok((result.matches[0]?.confidence ?? 0) > (result.matches[1]?.confidence ?? 0));
  assert.ok(result.matches.every((match) => match.level === "village"));
});

test("returns null for an invalid coordinate or an old index without representative points", () => {
  assert.equal(nearestVillageEstimateFromIndex({ choices }, 91, 30), null);
  assert.equal(
    nearestVillageEstimateFromIndex({
      choices: [["RW-P1-D11-S1101-C110101-V11010101", "Gihanga", "Gihanga", "village", "RW-P1-D11-S1101-C110101"]],
    }, -1.9441, 30.0619),
    null,
  );
});

test("supports object-shaped choices when a caller supplies them", () => {
  const result = nearestVillageEstimateFromIndex({
    choices: [{
      scope_code: "RW-P1-D11-S1101-C110101-V11010101",
      name_kiny: "Gihanga",
      name_eng: "Gihanga",
      level: "village",
      parent_scope_code: "RW-P1-D11-S1101-C110101",
      latitude: -1.944,
      longitude: 30.062,
    }],
  }, -1.9441, 30.0619);
  assert.ok(result);
  assert.equal(result.matches[0]?.name_kiny, "Gihanga");
});

test("aggregates candidate weights across all villages before showing only the top three", () => {
  const result = nearestVillageEstimateFromIndex({ choices }, -1.9441, 30.0619, 50_000);
  assert.ok(result);
  assert.equal(result.matches.length, 3);
  const districts = result.hierarchyCandidates?.district ?? [];
  assert.ok(districts.some((candidate) => candidate.scope_code === "RW-P1-D11"));
  assert.ok(districts.some((candidate) => candidate.scope_code === "RW-P1-D12"));
  const villageShare = (result.hierarchyCandidates?.village ?? [])
    .reduce((sum, candidate) => sum + candidate.confidence, 0);
  assert.ok(villageShare > 0 && villageShare <= 100.01);
});

test("keeps an answer for every indoor-like reported accuracy radius", () => {
  for (const accuracy of [100, 500, 2_000, 5_000, 20_000, 50_000]) {
    const result = nearestVillageEstimateFromIndex({ choices }, -1.9441, 30.0619, accuracy);
    assert.ok(result, `missing answer at accuracy ${accuracy} m`);
    assert.equal(result.status, "success");
    assert.ok(result.matches.length > 0);
    assert.ok(result.hierarchy.province);
    assert.ok(result.hierarchy.district);
    assert.ok((result.hierarchyCandidates?.village?.length ?? 0) > 0);
    for (const candidate of result.hierarchyCandidates?.village ?? []) {
      assert.ok(Number.isFinite(candidate.confidence));
      assert.ok(candidate.confidence >= 0 && candidate.confidence <= 100);
    }
  }
});
