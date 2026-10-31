import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
function arg(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
const MODE = arg("--mode", process.env.W2_MODE === "full" ? "full" : "smoke");
const INPUT_DIR = arg("--input", "district-artifacts");
const OUTPUT_DIR = arg("--output", "w2-results");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const EXPECTED_DISTRICTS = [
  "RW-P1-D11","RW-P1-D12","RW-P1-D13",
  "RW-P2-D21","RW-P2-D22","RW-P2-D23","RW-P2-D24","RW-P2-D25","RW-P2-D26","RW-P2-D27","RW-P2-D28",
  "RW-P3-D31","RW-P3-D32","RW-P3-D33","RW-P3-D34","RW-P3-D35","RW-P3-D36","RW-P3-D37",
  "RW-P4-D41","RW-P4-D42","RW-P4-D43","RW-P4-D44","RW-P4-D45",
  "RW-P5-D51","RW-P5-D52","RW-P5-D53","RW-P5-D54","RW-P5-D55","RW-P5-D56","RW-P5-D57",
];
const SMOKE_DISTRICTS = ["RW-P1-D11","RW-P3-D37"];
const LEVELS = ["village","cell","sector","district","province"];
const RADII = [0,20,100,500,2000,5000,20000];
const TEST_SEED = 20261030;
const TUNE_SEED = 424242;

function writeJson(name, value) {
  fs.writeFileSync(path.join(OUTPUT_DIR, name), JSON.stringify(value, null, 2) + "\n");
}
function csvCell(value) {
  const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return '"' + text.replaceAll('"', '""') + '"';
}
function writeCsv(name, headers, rows) {
  const output = [headers.join(",")];
  for (const row of rows) output.push(headers.map((key) => csvCell(row[key])).join(","));
  fs.writeFileSync(path.join(OUTPUT_DIR, name), output.join("\n") + "\n");
}
function readDistrictFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      try { return JSON.parse(fs.readFileSync(path.join(directory, name), "utf8")); }
      catch (error) { throw new Error("Cannot parse district artifact " + name + ": " + String(error)); }
    });
}
function rate(rows, key) {
  return rows.length ? rows.filter((x) => Boolean(key(x))).length / rows.length : 0;
}
function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}
function mean(rows, fn) {
  return rows.length ? rows.reduce((sum, row) => sum + Number(fn(row) || 0), 0) / rows.length : 0;
}
function chosenDistribution(rows) {
  const output = {};
  for (const row of rows) output[row.chosen_level] = (output[row.chosen_level] || 0) + 1;
  return output;
}
function levelMetrics(rows, level, useCalibrated) {
  const observations = rows.map((row) => row.level_metrics?.[level] || {
    raw_score: 0, calibrated_probability: null, top1_correct: false,
  });
  const calibratedCount = observations.filter((x) =>
    x.calibrated_probability !== null &&
    x.calibrated_probability !== undefined &&
    Number.isFinite(Number(x.calibrated_probability))
  ).length;
  const predictions = observations
    .filter((x) => Boolean(x.top1_scope_code))
    .map((x) => ({
      probability: useCalibrated &&
        x.calibrated_probability !== null &&
        x.calibrated_probability !== undefined &&
        Number.isFinite(Number(x.calibrated_probability))
        ? Number(x.calibrated_probability) : Number(x.raw_score) || 0,
      correct: Boolean(x.top1_correct),
    }));
  const ece = expectedCalibrationError(predictions);
  return {
    count: observations.length,
    top1: rate(observations, (x) => x.top1_correct),
    ece,
    calibrated_values: calibratedCount,
    calibrated_coverage: observations.length ? calibratedCount / observations.length : 0,
  };
}
function expectedCalibrationError(observations) {
  if (!observations.length) return 1;
  const sorted = [...observations].sort((a,b) => a.probability-b.probability);
  let ece = 0;
  const binCount = Math.min(10, sorted.length);
  for (let bin = 0; bin < binCount; bin += 1) {
    const start = Math.floor(bin * sorted.length / binCount);
    const end = Math.floor((bin + 1) * sorted.length / binCount);
    const values = sorted.slice(start, end);
    if (!values.length) continue;
    const confidence = mean(values, (x) => x.probability);
    const accuracy = rate(values, (x) => x.correct);
    ece += (values.length / sorted.length) * Math.abs(confidence - accuracy);
  }
  return ece;
}
function makeDeciles(rows, seed, radius, level, useCalibrated, districtCode) {
  const values = rows
    .filter((row) => row.status === "success" && Boolean(row.level_metrics?.[level]?.top1_scope_code))
    .map((row) => {
      const metric = row.level_metrics[level];
      const calibrated = Number(metric.calibrated_probability);
      return {
        probability: useCalibrated && Number.isFinite(calibrated)
          ? calibrated : Number(metric.raw_score) || 0,
        correct: Boolean(metric.top1_correct),
      };
    }).sort((a,b) => a.probability-b.probability);
  const output = [];
  const binCount = Math.min(10, values.length);
  for (let decile = 0; decile < binCount; decile += 1) {
    const start = Math.floor(decile * values.length / binCount);
    const end = Math.floor((decile + 1) * values.length / binCount);
    const bin = values.slice(start, end);
    output.push({
      seed,
      district_code: districtCode || "NATIONAL",
      radius_m: radius,
      level,
      decile: decile + 1,
      n: bin.length,
      mean_predicted_probability: mean(bin, (x) => x.probability),
      observed_accuracy: rate(bin, (x) => x.correct),
      ece_contribution: (bin.length / Math.max(1, values.length)) *
        Math.abs(mean(bin, (x) => x.probability) - rate(bin, (x) => x.correct)),
      prediction_source: useCalibrated ? "api_calibrated_probability" : "raw_geometric_score",
    });
  }
  return output;
}

// Equal-count bins followed by pool-adjacent-violators produce a monotone
// score-to-probability table fitted only to SEED-TUNE observations.
function fitIsotonic(rows, level) {
  const observations = rows
    .filter((row) => row.status === "success" && Boolean(row.level_metrics?.[level]?.top1_scope_code))
    .map((row) => {
      const metric = row.level_metrics[level];
      return { score: Number(metric.raw_score) || 0, correct: Boolean(metric.top1_correct) };
    }).sort((a,b) => a.score-b.score);
  if (!observations.length) return [];
  const binCount = Math.min(10, observations.length);
  const blocks = [];
  for (let i = 0; i < binCount; i += 1) {
    const start = Math.floor(i * observations.length / binCount);
    const end = Math.floor((i + 1) * observations.length / binCount);
    const part = observations.slice(start, end);
    if (!part.length) continue;
    blocks.push({
      min_score: part[0].score,
      max_score: part[part.length - 1].score,
      mean_score: mean(part, (x) => x.score),
      hits: part.filter((x) => x.correct).length,
      count: part.length,
      probability: rate(part, (x) => x.correct),
    });
  }
  // PAVA: merge adjacent blocks while the later observed probability is lower.
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < blocks.length - 1; i += 1) {
      if (blocks[i].probability > blocks[i + 1].probability) {
        const a = blocks[i], b = blocks[i + 1];
        const count = a.count + b.count;
        const hits = a.hits + b.hits;
        blocks.splice(i, 2, {
          min_score: a.min_score,
          max_score: b.max_score,
          mean_score: (a.mean_score * a.count + b.mean_score * b.count) / count,
          hits,
          count,
          probability: hits / count,
        });
        changed = true;
        break;
      }
    }
  }
  return blocks.map((x) => ({
    min_score: x.min_score,
    max_score: x.max_score,
    mean_score: x.mean_score,
    probability: x.probability,
    count: x.count,
    correct: x.hits,
  }));
}

function districtMetricRows(rows, calibrated) {
  const output = [];
  const groups = groupBy(rows, (x) => [x.district_code,x.seed,x.radius_m].join("|"));
  for (const [key, group] of groups) {
    const [district_code, seed, radius] = key.split("|");
    const item = {
      district_code,
      seed: Number(seed),
      radius_m: Number(radius),
      samples: group.length,
      chosen_level_correctness: rate(group, (x) => x.chosen_level_correct),
      empty_rate: rate(group, (x) => x.empty),
      village_top1: rate(group, (x) => x.village_top1_correct),
      village_top3: rate(group, (x) => x.village_top3_correct),
      chosen_level_distribution: chosenDistribution(group),
    };
    for (const level of LEVELS) {
      const lm = levelMetrics(group, level, calibrated);
      item[level + "_top1"] = lm.top1;
      item[level + "_ece"] = lm.ece;
      item[level + "_calibrated_coverage"] = lm.calibrated_coverage;
    }
    output.push(item);
  }
  return output.sort((a,b) => a.district_code.localeCompare(b.district_code) || a.seed-b.seed || a.radius_m-b.radius_m);
}

function nationalMetricRows(rows, calibrated) {
  const output = [];
  const groups = groupBy(rows, (x) => [x.seed,x.radius_m].join("|"));
  for (const [key, group] of groups) {
    const [seed, radius] = key.split("|");
    const item = {
      seed: Number(seed),
      radius_m: Number(radius),
      samples: group.length,
      chosen_level_correctness: rate(group, (x) => x.chosen_level_correct),
      empty_rate: rate(group, (x) => x.empty),
      village_top1: rate(group, (x) => x.village_top1_correct),
      village_top3: rate(group, (x) => x.village_top3_correct),
      chosen_level_distribution: chosenDistribution(group),
    };
    for (const level of LEVELS) {
      const values = levelMetrics(group, level, calibrated);
      item[level + "_top1"] = values.top1;
      item[level + "_ece"] = values.ece;
    }
    output.push(item);
  }
  return output.sort((a,b) => a.seed-b.seed || a.radius_m-b.radius_m);
}

function markdownTable(headers, rows) {
  const lines = [
    "| " + headers.join(" | ") + " |",
    "| " + headers.map(() => "---").join(" | ") + " |",
  ];
  for (const row of rows) lines.push("| " + row.map((x) => String(x)).join(" | ") + " |");
  return lines.join("\n");
}

async function smokeReport() {
  const files = readDistrictFiles(INPUT_DIR);
  const errors = [];
  for (const code of SMOKE_DISTRICTS) {
    const data = files.find((x) => x.district_code === code);
    if (!data) {
      errors.push("Missing smoke district artifact: " + code);
      continue;
    }
    if (data.row_count !== 280) errors.push(code + " expected 280 observations, got " + data.row_count);
    if (data.request_errors > 0) errors.push(code + " transport/API request errors: " + data.request_errors);
    const invalid = data.rows.filter((x) => !["success","outside"].includes(x.status));
    if (invalid.length) errors.push(code + " returned " + invalid.length + " non-success/non-outside responses.");
    if (!data.map_points || data.map_points.length < 7) errors.push(code + " did not emit map test sample points.");
  }
  const report = [
    "# IWACU RWANDA 2 — W2 SMOKE REPORT",
    "",
    "Mode: smoke. Districts: Nyarugenge (RW-P1-D11) and Nyamasheke (RW-P3-D37).",
    "This smoke validates public-key preflight, truth RPC, Next build/start, and HTTP /api/locate calls. It does not evaluate B1–B5.",
    "",
    markdownTable(["District","Observations","Transport errors","Status"], files.map((x) => [
      x.district_code, x.row_count, x.request_errors, errors.some((e) => e.includes(x.district_code)) ? "FAIL" : "PASS",
    ])),
    "",
    "Errors:",
    errors.length ? errors.map((x) => "- " + x).join("\n") : "- none",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.md"), report);
  writeJson("metrics.json", { mode:"smoke", districts:files.map((x) => x.district_code), errors, passed:errors.length===0 });
  if (errors.length) throw new Error("W2 smoke failed: " + errors.join(" | "));
  console.log(report);
}

async function fullReport() {
  const districtFiles = readDistrictFiles(INPUT_DIR);
  const byCode = new Map(districtFiles.map((x) => [x.district_code, x]));
  const missing = EXPECTED_DISTRICTS.filter((code) => !byCode.has(code));
  const unexpected = [...byCode.keys()].filter((code) => !EXPECTED_DISTRICTS.includes(code));
  const matrixErrors = [];
  if (missing.length) matrixErrors.push("Missing district artifacts: " + missing.join(", "));
  if (unexpected.length) matrixErrors.push("Unexpected district artifacts: " + unexpected.join(", "));
  for (const code of EXPECTED_DISTRICTS) {
    const data = byCode.get(code);
    if (!data) continue;
    if (data.row_count !== 7000) matrixErrors.push(code + " expected 7000 rows, received " + data.row_count);
    if (data.request_errors > 0) matrixErrors.push(code + " HTTP transport errors: " + data.request_errors);
    for (const seed of [TUNE_SEED, TEST_SEED]) {
      const rows = data.rows.filter((x) => x.seed === seed);
      if (rows.length !== 3500) matrixErrors.push(code + "/" + seed + " expected 3500 observations, received " + rows.length);
    }
  }

  const specialPath = path.join(OUTPUT_DIR, "national-special-results.json");
  let special = null;
  if (!fs.existsSync(specialPath)) matrixErrors.push("Missing national-special-results.json (lakeshore/outside/map tests).");
  else {
    try { special = JSON.parse(fs.readFileSync(specialPath, "utf8")); }
    catch (error) { matrixErrors.push("Cannot parse national-special-results.json: " + String(error)); }
  }

  const baseRows = districtFiles.flatMap((x) => x.rows || []);
  const lakeRows = special?.lakeshore_rows || [];
  const allRows = [...baseRows, ...lakeRows];
  const seedTestRows = allRows.filter((x) => x.seed === TEST_SEED);
  const tuneRows = allRows.filter((x) => x.seed === TUNE_SEED);
  const seedTestInsideR0 = seedTestRows.filter((x) => x.radius_m === 0);
  const outside = special?.outside_points || { total_points:0, failures:[], rows:[], border_zone_points:0 };
  const map = special?.map_vs_locate || { attempted:0, passed:0, mismatches:[], per_district:{} };
  const insideFalse = special?.seed_test_inside_false_positives || { tested:0,count:0,examples:[] };

  const calibration = {
    version: "w2-binned-isotonic-2026-10-31-v1",
    training_seed: TUNE_SEED,
    held_out_seed: TEST_SEED,
    method: "10 equal-count bins with pool-adjacent-violators monotonic merge",
    levels: {},
  };
  for (const level of LEVELS) calibration.levels[level] = fitIsotonic(tuneRows, level);
  writeJson("calibration-proposal.json", calibration);
  fs.writeFileSync(path.join(OUTPUT_DIR, "calibration-proposal.ts"),
    "export const LOCATION_CALIBRATION = " + JSON.stringify(calibration, null, 2) + " as const;\n");

  const successfulSeedTestRows = seedTestRows.filter((row) => row.status === "success");
  const calibrationApplied = successfulSeedTestRows.length > 0 &&
    successfulSeedTestRows.every((row) => Boolean(row.calibration_version)) &&
    successfulSeedTestRows.every((row) => LEVELS.every((level) => {
      const metric = row.level_metrics?.[level];
      return !metric?.top1_scope_code ||
        (metric.calibrated_probability !== null &&
         metric.calibrated_probability !== undefined &&
         Number.isFinite(Number(metric.calibrated_probability)));
    }));

  const districtMetrics = districtMetricRows(baseRows, calibrationApplied);
  const nationalMetrics = nationalMetricRows(allRows, calibrationApplied);
  const decileRows = [];
  const eceByLevel = {};
  for (const level of LEVELS) {
    const levelRows = seedTestRows
      .filter((row) => row.status === "success" && Boolean(row.level_metrics?.[level]?.top1_scope_code))
      .map((row) => {
        const metric = row.level_metrics[level];
        const calibrated = Number(metric.calibrated_probability);
        return {
          probability: calibrationApplied && Number.isFinite(calibrated)
            ? calibrated : Number(metric.raw_score) || 0,
          correct: Boolean(metric.top1_correct),
        };
      });
    eceByLevel[level] = expectedCalibrationError(levelRows);
    for (const radius of RADII) {
      const slice = seedTestRows.filter((row) => row.radius_m === radius);
      decileRows.push(...makeDeciles(slice, TEST_SEED, radius, level, calibrationApplied, "NATIONAL"));
    for (const code of EXPECTED_DISTRICTS) {
      const districtSlice = baseRows.filter((row) =>
        row.seed === TEST_SEED && row.radius_m === radius && row.district_code === code
      );
      decileRows.push(...makeDeciles(districtSlice, TEST_SEED, radius, level, calibrationApplied, code));
    }
    }
  }

  writeCsv("per_district_metrics.csv", [
    "district_code","seed","radius_m","samples","chosen_level_correctness","empty_rate",
    "village_top1","village_top3","chosen_level_distribution",
    ...LEVELS.flatMap((x) => [x + "_top1", x + "_ece", x + "_calibrated_coverage"]),
  ], districtMetrics);
  writeCsv("national_metrics.csv", [
    "seed","radius_m","samples","chosen_level_correctness","empty_rate",
    "village_top1","village_top3","chosen_level_distribution",
    ...LEVELS.flatMap((x) => [x + "_top1", x + "_ece"]),
  ], nationalMetrics);
  writeCsv("calibration_deciles.csv", [
    "seed","district_code","radius_m","level","decile","n","mean_predicted_probability","observed_accuracy","ece_contribution","prediction_source",
  ], decileRows);

  const gates = [];
  const b1Slices = [];
  for (const radius of RADII.filter((r) => r <= 5000)) {
    const national = seedTestRows.filter((row) => row.radius_m === radius);
    const nationalRate = rate(national, (row) => row.chosen_level_correct);
    const districts = [];
    for (const code of EXPECTED_DISTRICTS) {
      const slice = baseRows.filter((row) => row.seed === TEST_SEED && row.radius_m === radius && row.district_code === code);
      const correctRate = rate(slice, (row) => row.chosen_level_correct);
      districts.push({ district_code:code, samples:slice.length, correctness:correctRate });
      if (correctRate < 0.85) b1Slices.push({
        district_code:code, radius_m:radius, samples:slice.length,
        correctness:correctRate, required:0.85,
        empty: slice.filter((x) => x.empty).length,
        outside_responses: slice.filter((x) => x.status === "outside").length,
        wrong_scope: slice.filter((x) => !x.empty && x.chosen_scope_code && !x.chosen_level_correct).length,
        chosen_level_distribution: chosenDistribution(slice),
      });
    }
    const districtFailures = districts.filter((x) => x.samples === 0 || x.correctness < 0.85);
    gates.push({
      gate:"B1",
      slice:"national r=" + radius + " and every district",
      passed:nationalRate >= 0.90 &&
        districts.length === EXPECTED_DISTRICTS.length &&
        districtFailures.length === 0,
      observed:nationalRate,
      required:0.90,
      observed_district_correctness:districts,
      required_each_district_correctness:0.85,
      district_failures:districtFailures,
    });
    if (nationalRate < 0.90) b1Slices.push({
      district_code:"NATIONAL", radius_m:radius, samples:national.length,
      correctness:nationalRate, required:0.90, empty:national.filter((x) => x.empty).length,
      top_chosen_levels: chosenDistribution(national),
    });
  }
  const r20 = seedTestRows.filter((row) => row.radius_m === 20000);
  const r20Rate = rate(r20, (row) => row.chosen_level_correct && row.chosen_level_is_district_or_province);
  gates.push({
    gate:"B1",
    slice:"national r=20000m; district/province only",
    passed:r20Rate >= 0.90,
    observed:r20Rate,
    required:0.90,
  });
  if (r20Rate < 0.90) {
    for (const code of EXPECTED_DISTRICTS) {
      const slice = baseRows.filter((row) => row.seed === TEST_SEED && row.radius_m === 20000 && row.district_code === code);
      b1Slices.push({
        district_code:code,
        radius_m:20000,
        diagnostic_only:true,
        samples:slice.length,
        correctness:rate(slice, (row) => row.chosen_level_correct && row.chosen_level_is_district_or_province),
        required:"national gate is 90%; district rows are diagnostic",
        empty:slice.filter((x) => x.empty).length,
        outside_responses:slice.filter((x) => x.status === "outside").length,
        wrong_level:slice.filter((x) => !x.empty && !x.chosen_level_is_district_or_province).length,
        wrong_scope:slice.filter((x) => !x.empty && x.chosen_level_is_district_or_province && !x.chosen_level_correct).length,
        chosen_level_distribution:chosenDistribution(slice),
      });
    }
  }

  const emptyRows = seedTestRows.filter((row) => row.empty);
  gates.push({
    gate:"B2",
    slice:"all SEED-TEST inside datasets and radii",
    passed:emptyRows.length === 0,
    observed_empty:emptyRows.length,
    denominator:seedTestRows.length,
    required_empty:0,
  });

  const outsideRows = outside.rows || [];
  const outsideZones = ["DRC", "Burundi", "Tanzania", "Uganda"];
  const outsidePointsPerSeed = outside.points_per_seed || {};
  const outsideBySeedZones = outside.points_per_country_zone || {};
  const outsideSeedCoverage = [TUNE_SEED, TEST_SEED].every((seed) =>
    Number(outsidePointsPerSeed[String(seed)] || 0) === 200 &&
    outsideZones.every((zone) =>
      Number(outsideBySeedZones[String(seed)]?.[zone]?.count || 0) === 50
    )
  );
  const outsidePassed = outside.total_points === 400 &&
    outsideRows.length === 400 &&
    outsideSeedCoverage &&
    outsideRows.every((row) => row.passed === true) &&
    (outside.failures || []).length === 0 &&
    (outside.sampling_failures || []).length === 0;
  gates.push({
    gate:"B3",
    slice:"400 outside points: 200 per seed, 50 per DRC/Burundi/Tanzania/Uganda zone",
    passed:outsidePassed,
    observed_total:outside.total_points,
    observed_points_per_seed:outsidePointsPerSeed,
    observed_points_per_country_zone:outsideBySeedZones,
    correctly_flagged:outside.outside_flagged_correctly,
    border_zone_points_counted_separately:outside.border_zone_points,
    sampling_failures:(outside.sampling_failures || []).length,
    failures:(outside.failures || []).length,
    required_total:400,
    required_per_seed:200,
    required_per_zone_per_seed:50,
    required_failures:0,
  });
  const insidePassed = Number(insideFalse.count) === 0;
  gates.push({
    gate:"B3",
    slice:"SEED-TEST truth-inside points at r=0",
    passed:insidePassed,
    observed_false_outside:Number(insideFalse.count) || 0,
    tested:Number(insideFalse.tested) || 0,
    required_false_outside:0,
  });

  for (const level of LEVELS) {
    const ece = eceByLevel[level];
    gates.push({
      gate:"B4",
      slice:level + " / SEED-TEST",
      passed:calibrationApplied && ece <= 0.05,
      observed_ece:ece,
      required_ece:0.05,
      calibration_applied:calibrationApplied,
    });
  }

  const mapPerDistrict = map.per_district || {};
  const mapCoverage = EXPECTED_DISTRICTS.every((code) => Number(mapPerDistrict[code] || 0) >= 6);
  const mapPassed = Number(map.attempted) >= 200 &&
    Number(map.passed) === Number(map.attempted) &&
    (map.mismatches || []).length === 0 &&
    mapCoverage;
  gates.push({
    gate:"MAP-VS-LOCATE",
    slice:"district map polygon id/path versus /api/locate",
    passed:mapPassed,
    attempted:map.attempted,
    matches:map.passed,
    mismatches:(map.mismatches || []).length,
    at_least_6_per_district:mapCoverage,
    required_points:200,
    required_mismatches:0,
  });

  const b5 = {};
  for (const radius of [0,20,100,500]) {
    const slice = seedTestRows.filter((row) => row.radius_m === radius);
    b5[radius] = {
      samples:slice.length,
      village_top1:rate(slice, (x) => x.village_top1_correct),
      village_top3:rate(slice, (x) => x.village_top3_correct),
    };
  }

  const metrics = {
    mode:"full",
    expected_districts:EXPECTED_DISTRICTS.length,
    received_districts:byCodeSize(byCode),
    missing_districts:missing,
    unexpected_districts:unexpected,
    seed_tune:TUNE_SEED,
    seed_test:TEST_SEED,
    radii_m:RADII,
    observations:{
      districts:baseRows.length,
      lakeshore:lakeRows.length,
      seed_test:seedTestRows.length,
      tune:tuneRows.length,
      map_attempted:map.attempted,
      outside_points:outside.total_points,
    },
    lakeshore_proof:(special?.lakeshore_proof || []),
    outside_points_per_zone:outside.points_per_country_zone || {},
    outside_sampling_failures:outside.sampling_failures || [],
    outside_classifier_rpc_error_examples:outside.classifier_rpc_error_examples || [],
    calibration:{
      applied_in_api:calibrationApplied,
      proposal_file:"calibration-proposal.json",
      version:calibration.version,
      method:calibration.method,
      ece_seed_test_by_level:eceByLevel,
    },
    b1_failing_district_noise_slices:b1Slices,
    b5:b5,
    gates,
    matrix_errors:matrixErrors,
    overall_passed:matrixErrors.length===0 && gates.every((gate) => gate.passed),
  };
  writeJson("metrics.json", metrics);

  const b1FailureRows = b1Slices.slice(0, 120).map((x) => [
    x.district_code,x.radius_m,x.samples,(x.correctness*100).toFixed(2)+"%",
    x.required,(x.empty||0),(x.outside_responses||0),(x.wrong_level||0),(x.wrong_scope||0),JSON.stringify(x.chosen_level_distribution||{}),
  ]);
  const failedGates = gates.filter((x) => !x.passed);
  const report = [
    "# IWACU RWANDA 2 — WORK ORDER 02 W2 VALIDATION",
    "",
    "Mode: FULL. Thresholds are the exact W2 gates; no threshold was lowered.",
    "",
    "## Dataset coverage",
    "",
    "- Active district jobs: " + byCodeSize(byCode) + " / 30.",
    "- District observations: " + baseRows.length + " (expected 210,000 in full mode).",
    "- Kivu lakeshore-proxy observations: " + lakeRows.length + " (both seeds and all seven radii).",
    "- Outside points: " + outside.total_points + " (200 per seed; 50 per country-zone per seed).",
    "- Map-vs-locate attempts: " + map.attempted + ".",
    "",
    "## Kivu bounding-box sampler proof",
    "",
    markdownTable(["Seed","Kivu bbox villages","Points returned","Contributing villages"], (special?.lakeshore_proof || []).map((x) => [
      x.seed,x.kivu_bbox_villages,x.point_count,x.contributing_villages,
    ])),
    "",
    "Important: no hydrography polygons were present. These are the approved village-union outer-edge proxy points, not authoritative waterline points.",
    "",
    "## Gate results",
    "",
    markdownTable(["Gate","Slice","Observed","Required","Result"], gates.map((x) => [
      x.gate,x.slice,
      x.observed_ece != null ? "ECE " + x.observed_ece.toFixed(4) :
      x.observed != null ? (x.observed*100).toFixed(2)+"%" :
      x.observed_empty != null ? "empty " + x.observed_empty :
      x.observed_false_outside != null ? "false outside " + x.observed_false_outside :
      x.attempted != null ? x.passed + "/" + x.attempted :
      String(x.correctly_flagged || x.observed_total || 0),
      x.required_ece != null ? "≤"+x.required_ece :
      x.required != null ? "≥"+(x.required*100).toFixed(0)+"%" :
      x.required_empty != null ? "0" :
      x.required_false_outside != null ? "0" :
      x.required_mismatches != null ? "0 mismatches" : "as specified",
      x.passed ? "PASS" : "FAIL",
    ])),
    "",
    "## B1 failing district × noise slices",
    "",
    b1FailureRows.length
      ? markdownTable(["District","Radius m","Samples","Correctness","Required","Empty","Outside","Wrong level","Wrong scope","Chosen level distribution"], b1FailureRows)
      : "No B1 slices failed.",
    "",
    "## SEED-TEST calibration",
    "",
    markdownTable(["Level","ECE","Required","API calibration applied"], LEVELS.map((x) => [
      x,(eceByLevel[x] ?? 1).toFixed(4),"≤0.05",calibrationApplied ? "yes" : "NO",
    ])),
    "",
    calibrationApplied
      ? "Calibration version was present in every test response."
      : "Calibration was NOT yet applied in /api/locate. The table reports raw geometric-score ECE, and B4 remains FAIL until the SEED-TUNE proposal is committed to the API and SEED-TEST is rerun.",
    "",
    "## B3 and map diagnostics",
    "",
    "- Outside points by coordinate zone: " + JSON.stringify(outside.points_per_country_zone || {}),
    "- Outside-point sampling failures: " + JSON.stringify(outside.sampling_failures || []),
    "- Classifier RPC error examples: " + JSON.stringify(outside.classifier_rpc_error_examples || []),
    "- Border-zone points (1–5 km): " + (outside.border_zone_points || 0),
    "- Outside correctly flagged: " + (outside.outside_flagged_correctly || 0) + " / " + (outside.total_points || 0),
    "- True-inside r=0 points incorrectly flagged outside: " + (insideFalse.count || 0) + " / " + (insideFalse.tested || 0),
    "- Map-vs-locate: " + (map.passed || 0) + " / " + (map.attempted || 0) + "; mismatches: " + ((map.mismatches || []).length),
    "",
    "## B5 report-only metrics",
    "",
    markdownTable(["Radius m","Village top-1","Village top-3"], [0,20,100,500].map((r) => [
      r,(b5[r].village_top1*100).toFixed(2)+"%",(b5[r].village_top3*100).toFixed(2)+"%",
    ])),
    "",
    "## Matrix / infrastructure failures",
    "",
    matrixErrors.length ? matrixErrors.map((x) => "- " + x).join("\n") : "- none",
    "",
    "## Overall",
    "",
    metrics.overall_passed ? "PASS — all gates passed." : "FAIL — one or more exact gates were not met. No thresholds were weakened.",
    "",
    "Failed gates: " + (failedGates.map((x) => x.gate + ": " + x.slice).join("; ") || "none"),
    "",
    "Calibration artifact: calibration-proposal.json (trained only on SEED-TUNE=424242; SEED-TEST=20261030 was held out).",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.md"), report);

  console.log(JSON.stringify({
    overall_passed:metrics.overall_passed,
    gates_passed:gates.filter((x) => x.passed).length,
    gates_total:gates.length,
    matrix_errors:matrixErrors,
    failed_gates:failedGates,
    observations:metrics.observations,
  }, null, 2));

  if (!metrics.overall_passed) process.exitCode = 1;
}

function byCodeSize(map) { return map ? map.size : 0; }

async function main() {
  if (MODE === "smoke") await smokeReport();
  else await fullReport();
}

main().catch((error) => {
  const message = String(error?.stack || error).split(/\r?\n/).slice(0, 40).join("\n");
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.md"),
    "# IWACU RWANDA 2 — W2 AGGREGATION ERROR\n\n" + message + "\n");
  writeJson("metrics.json", { mode:MODE, fatal_error:message, overall_passed:false });
  console.error("W2 aggregate failed:");
  console.error(message);
  process.exit(1);
});
