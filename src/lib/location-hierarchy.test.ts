import assert from "node:assert/strict";
import test from "node:test";
import type { ConfidenceMatch } from "@/types/boundary";
import { aggregateLocationHierarchy } from "./location-hierarchy";

const row = (scope_code: string, confidence: number, area: number): ConfidenceMatch => ({
  scope_code,
  name_kiny: scope_code,
  name_eng: null,
  level: "village",
  confidence,
  intersection_area_m2: area,
});

test("aggregates village overlap into cell, sector, district and province", () => {
  const result = aggregateLocationHierarchy([
    row("RW-P1-D11-S1101-C110101-V11010101", 40, 400),
    row("RW-P1-D11-S1101-C110101-V11010102", 25, 250),
    row("RW-P1-D11-S1101-C110102-V11010201", 20, 200),
    row("RW-P1-D12-S1201-C120101-V12010101", 10, 100),
  ]);
  assert.equal(result.village?.length, 4);
  assert.equal(result.cell?.find((x) => x.scope_code === "RW-P1-D11-S1101-C110101")?.confidence, 65);
  assert.equal(result.sector?.find((x) => x.scope_code === "RW-P1-D11-S1101")?.confidence, 85);
  assert.equal(result.district?.find((x) => x.scope_code === "RW-P1-D11")?.confidence, 85);
  assert.equal(result.province?.[0]?.scope_code, "RW-P1");
  assert.equal(result.province?.[0]?.confidence, 95);
});

test("preserves unmapped uncertainty instead of inflating the candidates to 100 percent", () => {
  const result = aggregateLocationHierarchy([
    row("RW-P1-D11-S1101-C110101-V11010101", 32, 320),
    row("RW-P1-D11-S1101-C110101-V11010102", 18, 180),
  ]);
  assert.equal(result.province?.[0]?.confidence, 50);
  assert.equal(result.district?.[0]?.confidence, 50);
});

test("scales overlapping polygon shares consistently when total exceeds 100", () => {
  const result = aggregateLocationHierarchy([
    row("RW-P1-D11-S1101-C110101-V11010101", 80, 800),
    row("RW-P1-D11-S1101-C110101-V11010102", 80, 800),
  ]);
  assert.equal(result.village?.[0]?.confidence, 50);
  assert.equal(result.cell?.[0]?.confidence, 100);
  assert.equal(result.district?.[0]?.confidence, 100);
});

test("ignores invalid and non-village rows", () => {
  const result = aggregateLocationHierarchy([
    row("RW-P1-D11-S1101-C110101-V11010101", 60, 600),
    { ...row("RW-P1-D11-S1101-C110101", 20, 200), level: "cell" },
    row("RW-UNKNOWN", 20, 200),
  ]);
  assert.equal(result.village?.length, 1);
  assert.equal(result.province?.[0]?.confidence, 60);
});
