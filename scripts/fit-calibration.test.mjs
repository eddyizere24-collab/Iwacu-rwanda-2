import assert from "node:assert/strict";
import test from "node:test";
import {
  expectedCalibrationError,
  fitIsotonic,
  lookupCalibration,
  tuneTau,
} from "./fit-calibration.mjs";

test("PAV regression returns a monotone calibration curve", () => {
  const curve = fitIsotonic([
    { score: 0.1, correct: false },
    { score: 0.2, correct: true },
    { score: 0.3, correct: false },
    { score: 0.8, correct: true },
  ]);
  assert.equal(curve.x.length, curve.y.length);
  assert.deepEqual(curve.y, [...curve.y].sort((a, b) => a - b));
  assert.ok(curve.y[0] <= curve.y[curve.y.length - 1]);
});

test("lookup interpolates monotonically and clamps both ends", () => {
  const curve = { x: [0.2, 0.5, 0.8], y: [0.1, 0.4, 0.9] };
  assert.equal(lookupCalibration(0, curve), 0.1);
  assert.equal(lookupCalibration(1, curve), 0.9);
  assert.equal(lookupCalibration(0.65, curve), 0.65);
});

test("TAU fitting uses SEED-TUNE only and chooses the smallest passing threshold", () => {
  const levels = ["village", "cell", "sector", "district", "province"];
  const tune = {
    seed: 424242, radius_m: 100, status: "success",
    true_prefixes: { village: "true-v", cell: "true-c", sector: "true-s", district: "true-d", province: "true-p" },
    level_metrics: Object.fromEntries(levels.map((level, index) => [level, {
      raw_score: 0.9 - index * 0.1,
      top1_scope_code: index === 0 ? "wrong-v" : "true-" + ({cell:"c",sector:"s",district:"d",province:"p"}[level]),
      top1_correct: index !== 0,
    }])),
  };
  const heldOut = {
    ...tune, seed: 20261030, level_metrics: Object.fromEntries(levels.map((level) => [level, {
      raw_score: 1, top1_scope_code: "wrong-test", top1_correct: false,
    }])),
  };
  const curves = Object.fromEntries(levels.map((level) => [level, { x: [0, 1], y: [0, 1] }]));
  const fitted = tuneTau([tune, heldOut], curves);
  assert.equal(fitted.count, 1);
  assert.equal(fitted.tau, 0.90000001);
  assert.equal(fitted.accuracy, 1);
  assert.equal(fitted.target_met, true);
});

test("ECE returns the expected absolute calibration gap", () => {
  const ece = expectedCalibrationError([
    { probability: 0.9, correct: true },
    { probability: 0.9, correct: false },
  ], 1);
  assert.equal(ece, 0.4);
});

test("failed SEED-TUNE observations remain in the TAU accuracy denominator", () => {
  const levels = ["village", "cell", "sector", "district", "province"];
  const successful = {
    seed: 424242, radius_m: 100, status: "success",
    true_prefixes: Object.fromEntries(levels.map((level) => [level, "true-" + level])),
    level_metrics: Object.fromEntries(levels.map((level) => [level, {
      raw_score: 0.9, top1_scope_code: "true-" + level, top1_correct: true,
    }])),
  };
  const failed = { seed: 424242, radius_m: 5000, status: "transport_error", level_metrics: {} };
  const curves = Object.fromEntries(levels.map((level) => [level, { x: [0, 1], y: [0, 1] }]));
  const fitted = tuneTau([successful, failed], curves);
  assert.equal(fitted.count, 2);
  assert.equal(fitted.accuracy, 0.5);
  assert.equal(fitted.target_met, false);
});
