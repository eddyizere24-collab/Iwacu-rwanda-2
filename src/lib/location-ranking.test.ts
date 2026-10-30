import assert from "node:assert/strict";
import test from "node:test";
import { rankVillageCandidates } from "./location-ranking";

const eastVillage = {
  scope_code: "RW-P1-D11-S1101-C110101-V11010101",
  confidence: 52,
};
const westVillage = {
  scope_code: "RW-P1-D12-S1201-C120101-V12010101",
  confidence: 48,
};

test("GPS-only ranking follows geometric overlap", () => {
  const result = rankVillageCandidates([westVillage, eastVillage], new Map());
  assert.deepEqual(result.map((v) => v.scope_code), [eastVillage.scope_code, westVillage.scope_code]);
});

test("district IP prior can break a close cross-district tie", () => {
  const result = rankVillageCandidates(
    [eastVillage, westVillage],
    new Map([["RW-P1-D12", 1], ["RW-P1-D11", 0]])
  );
  assert.deepEqual(result.map((v) => v.scope_code), [westVillage.scope_code, eastVillage.scope_code]);
});

test("IP prior cannot add villages or alter the displayed raw overlap scores", () => {
  const input = [{ ...eastVillage }, { ...westVillage }];
  const result = rankVillageCandidates(
    input,
    new Map([["RW-P1-D12", 1], ["RW-P1-D99", 100]])
  );
  assert.equal(result.length, input.length);
  assert.deepEqual(
    new Set(result.map((v) => v.scope_code)),
    new Set(input.map((v) => v.scope_code))
  );
  assert.equal(result.find((v) => v.scope_code === eastVillage.scope_code)?.confidence, 52);
  assert.equal(result.find((v) => v.scope_code === westVillage.scope_code)?.confidence, 48);
});

test("districts are derived from hierarchical official scope codes", () => {
  const unmatched = {
    scope_code: "RW-P1-D11-S1101-C110101-V11010101",
    confidence: 55,
  };
  const matched = {
    scope_code: "RW-P1-D12-S1201-C120101-V12010101",
    confidence: 45,
  };
  const result = rankVillageCandidates(
    [unmatched, matched],
    new Map([["RW-P1-D12", 1]])
  );
  assert.equal(result[0].scope_code, matched.scope_code);
});
