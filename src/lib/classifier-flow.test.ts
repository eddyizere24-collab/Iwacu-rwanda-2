import assert from "node:assert/strict";
import test from "node:test";
import {
  capBorderZoneHierarchyAtSector,
  classifyThenContinue,
  isBorderZoneCandidate,
} from "./classifier-flow";

test("a thrown classifier RPC does not block a village-level search", async () => {
  const result = await classifyThenContinue(
    async () => {
      throw Object.assign(new Error("permission denied for table boundaries"), {
        code: "42501",
      });
    },
    async (state) => {
      assert.equal(state.unavailable, true);
      assert.equal(state.errorCode, "42501");
      return {
        status: "success" as const,
        level: "village" as const,
        scope_code: "RW-P3-D37-S3701-C370101-V37010101",
      };
    },
  );

  assert.equal(result.unavailable, true);
  assert.equal(result.errorCode, "42501");
  assert.equal(result.result.level, "village");
  assert.equal(result.result.scope_code, "RW-P3-D37-S3701-C370101-V37010101");
});


test("100 m outside with 500 m accuracy continues village scoring and sets border_zone", async () => {
  const classification = {
    is_inside_rwanda: false,
    distance_to_border_m: 100,
  };
  const result = await classifyThenContinue(
    async () => ({ data: [classification], error: null }),
    async (state) => {
      const borderZone = isBorderZoneCandidate(state.classification, 500);
      if (state.classification && !state.classification.is_inside_rwanda && !borderZone) {
        return { status: "outside" as const, outside_rwanda: true as const };
      }
      return {
        status: "success" as const,
        level: "village" as const,
        flags: borderZone ? ["border_zone"] : [],
      };
    },
  );

  assert.equal(isBorderZoneCandidate(classification, 500), true);
  assert.deepEqual(result.result, {
    status: "success",
    level: "village",
    flags: ["border_zone"],
  });
});

test("20 km outside with 10 m accuracy returns outside_rwanda", async () => {
  const classification = {
    is_inside_rwanda: false,
    distance_to_border_m: 20_000,
  };
  const result = await classifyThenContinue(
    async () => ({ data: [classification], error: null }),
    async (state) => {
      const borderZone = isBorderZoneCandidate(state.classification, 10);
      if (state.classification && !state.classification.is_inside_rwanda && !borderZone) {
        return {
          status: "outside" as const,
          outside_rwanda: true as const,
          distance_to_border_m: state.classification.distance_to_border_m,
        };
      }
      return { status: "success" as const, flags: borderZone ? ["border_zone"] : [] };
    },
  );

  assert.equal(isBorderZoneCandidate(classification, 10), false);
  assert.deepEqual(result.result, {
    status: "outside",
    outside_rwanda: true,
    distance_to_border_m: 20_000,
  });
});

test("border-zone hierarchy is capped at sector when no village reaches 5%", () => {
  const sector = { scope_code: "RW-P1-D11-S1101", confidence: 96 };
  const hierarchy = {
    sector,
    cell: { scope_code: "RW-P1-D11-S1101-C110101", confidence: 4 },
    village: { scope_code: "RW-P1-D11-S1101-C110101-V11010101", confidence: 4 },
  };

  const capped = capBorderZoneHierarchyAtSector(hierarchy, true, 4.99);
  assert.equal(capped.sector, sector);
  assert.equal(capped.cell, undefined);
  assert.equal(capped.village, undefined);

  const villageEligible = capBorderZoneHierarchyAtSector(hierarchy, true, 5);
  assert.equal(villageEligible.village?.scope_code, hierarchy.village.scope_code);
});
