import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const LEVELS = ["village", "cell", "sector", "district", "province"];
export const SEED_TUNE = 424242;
export const SEED_TEST = 20261030;
const DEFAULT_TAU = 0.8;

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Pool-adjacent-violators isotonic regression for binary correctness labels. */
export function fitIsotonic(observations) {
  const points = observations
    .map((row) => ({ score: finite(row.score), target: row.correct ? 1 : 0 }))
    .filter((row) => row.score !== null)
    .map((row) => ({ ...row, score: Math.min(1, Math.max(0, row.score)) }))
    .sort((a, b) => a.score - b.score);
  if (!points.length) return { x: [0, 1], y: [0, 1] };

  // Combine ties first so the lookup x coordinates stay strictly increasing.
  const tied = [];
  for (const point of points) {
    const last = tied[tied.length - 1];
    if (last && last.score === point.score) {
      last.weight += 1;
      last.sumTarget += point.target;
    } else {
      tied.push({ score: point.score, weight: 1, sumTarget: point.target });
    }
  }

  const blocks = [];
  for (const point of tied) {
    blocks.push({
      sumX: point.score * point.weight,
      sumY: point.sumTarget,
      weight: point.weight,
      minX: point.score,
      maxX: point.score,
    });
    while (blocks.length >= 2) {
      const right = blocks[blocks.length - 1];
      const left = blocks[blocks.length - 2];
      if (left.sumY / left.weight <= right.sumY / right.weight) break;
      blocks.splice(blocks.length - 2, 2, {
        sumX: left.sumX + right.sumX,
        sumY: left.sumY + right.sumY,
        weight: left.weight + right.weight,
        minX: left.minX,
        maxX: right.maxX,
      });
    }
  }

  const x = blocks.map((block) => block.sumX / block.weight);
  const y = blocks.map((block) => block.sumY / block.weight);
  // A single knot is sufficient; two identical endpoint knots make interpolation safe.
  if (x.length === 1) return { x: [0, x[0], 1], y: [y[0], y[0], y[0]] };
  return { x, y };
}

export function lookupCalibration(value, curve) {
  const x = curve.x;
  const y = curve.y;
  if (!Array.isArray(x) || !Array.isArray(y) || !x.length || x.length !== y.length) {
    return Math.min(1, Math.max(0, finite(value) ?? 0));
  }
  const input = Math.min(1, Math.max(0, finite(value) ?? 0));
  if (input <= x[0]) return y[0];
  if (input >= x[x.length - 1]) return y[y.length - 1];
  for (let index = 1; index < x.length; index += 1) {
    if (input <= x[index]) {
      const width = x[index] - x[index - 1];
      const fraction = width > 0 ? (input - x[index - 1]) / width : 1;
      return y[index - 1] + fraction * (y[index] - y[index - 1]);
    }
  }
  return y[y.length - 1];
}

function findJsonFiles(directory) {
  if (!fs.existsSync(directory)) throw new Error("Input directory does not exist: " + directory);
  const found = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && (entry.name.endsWith(".json") || entry.name.endsWith(".jsonl"))) {
        found.push(full);
      }
    }
  };
  walk(directory);
  return found;
}

/** Reads the matrix runner's district JSON artifacts (rows[]) and JSONL exports. */
export function readObservationArtifacts(directory) {
  const observations = [];
  for (const file of findJsonFiles(directory)) {
    const raw = fs.readFileSync(file, "utf8");
    if (file.endsWith(".jsonl")) {
      for (const line of raw.split(/\r?\n/).filter(Boolean)) {
        const row = JSON.parse(line);
        if (row && typeof row === "object" && row.level_metrics) observations.push(row);
      }
      continue;
    }
    const payload = JSON.parse(raw);
    if (Array.isArray(payload)) {
      observations.push(...payload.filter((row) => row && row.level_metrics));
    } else if (Array.isArray(payload?.rows)) {
      observations.push(...payload.rows.filter((row) => row && row.level_metrics));
    } else if (payload?.level_metrics) {
      observations.push(payload);
    }
  }
  return observations;
}

function metricFor(row, level) {
  const metric = row.level_metrics?.[level];
  if (!metric) return null;
  const score = finite(metric.raw_score);
  if (score === null || !metric.top1_scope_code) return null;
  return { ...metric, raw_score: Math.min(1, Math.max(0, score)) };
}

export function calibrationForRows(rows) {
  const curves = {};
  for (const level of LEVELS) {
    const points = [];
    for (const row of rows) {
      const metric = metricFor(row, level);
      if (row.status === "success" && metric) {
        points.push({ score: metric.raw_score, correct: Boolean(metric.top1_correct) });
      }
    }
    curves[level] = fitIsotonic(points);
  }
  return curves;
}

function calibratedScore(row, level, curves) {
  const metric = metricFor(row, level);
  if (!metric) return null;
  return lookupCalibration(metric.raw_score, curves[level]);
}

function chosenLevelAtTau(row, tau, curves) {
  for (const level of LEVELS) {
    const metric = metricFor(row, level);
    if (!metric) continue;
    const probability = calibratedScore(row, level, curves);
    if (probability !== null && probability >= tau) return level;
  }
  return "province";
}

function isCorrectAtLevel(row, level) {
  const metric = metricFor(row, level);
  if (!metric) return false;
  const truth = row.true_prefixes?.[level];
  if (truth && metric.top1_scope_code) return truth === metric.top1_scope_code;
  return Boolean(metric.top1_correct);
}

/** Finds the smallest observed calibration threshold with >=92% tune accuracy at r<=5km. */
export function tuneTau(rows, curves, targetAccuracy = 0.92) {
  const tuneRows = rows.filter((row) =>
    Number(row.seed) === SEED_TUNE &&
    finite(row.radius_m) !== null &&
    Number(row.radius_m) <= 5000
  );
  if (!tuneRows.length) {
    return { tau: DEFAULT_TAU, accuracy: null, count: 0, target_met: false };
  }
  const thresholds = new Set([0, 1]);
  for (const row of tuneRows) {
    for (const level of LEVELS) {
      const score = calibratedScore(row, level, curves);
      if (score !== null) {
        const knot = Number(score.toFixed(8));
        thresholds.add(knot);
        thresholds.add(Math.min(1, Number((knot + 0.00000001).toFixed(8))));
      }
    }
  }
  const ordered = [...thresholds].sort((a, b) => a - b);
  let bestAccuracy = 0;
  for (const tau of ordered) {
    let correct = 0;
    for (const row of tuneRows) {
      const chosen = chosenLevelAtTau(row, tau, curves);
      if (isCorrectAtLevel(row, chosen)) correct += 1;
    }
    const accuracy = correct / tuneRows.length;
    bestAccuracy = Math.max(bestAccuracy, accuracy);
    if (accuracy >= targetAccuracy) {
      return { tau, accuracy, count: tuneRows.length, target_met: true };
    }
  }
  return { tau: DEFAULT_TAU, accuracy: bestAccuracy, count: tuneRows.length, target_met: false };
}

export function expectedCalibrationError(observations, binCount = 10) {
  if (!observations.length) return null;
  const sorted = [...observations].sort((a, b) => a.probability - b.probability);
  const bins = Math.min(binCount, sorted.length);
  let ece = 0;
  for (let index = 0; index < bins; index += 1) {
    const start = Math.floor(index * sorted.length / bins);
    const end = Math.floor((index + 1) * sorted.length / bins);
    const group = sorted.slice(start, end);
    const confidence = group.reduce((sum, item) => sum + item.probability, 0) / group.length;
    const accuracy = group.filter((item) => item.correct).length / group.length;
    ece += (group.length / sorted.length) * Math.abs(confidence - accuracy);
  }
  return ece;
}

function checkSeedTest(rows, calibration) {
  const report = {};
  for (const level of LEVELS) {
    const predictions = [];
    for (const row of rows) {
      if (Number(row.seed) !== SEED_TEST || row.status !== "success") continue;
      const metric = metricFor(row, level);
      if (!metric) continue;
      const apiProbability = finite(metric.calibrated_probability);
      predictions.push({
        probability: apiProbability === null
          ? lookupCalibration(metric.raw_score, calibration.levels[level])
          : Math.min(1, Math.max(0, apiProbability)),
        correct: Boolean(metric.top1_correct),
      });
    }
    report[level] = {
      n: predictions.length,
      ece: expectedCalibrationError(predictions),
    };
  }
  return report;
}

function parseArgs(argv) {
  const args = { check: false, input: "district-artifacts", output: "src/lib/calibration-v1.json" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--check") args.check = true;
    else if (value === "--input" && argv[index + 1]) args.input = argv[++index];
    else if (value === "--output" && argv[index + 1]) args.output = argv[++index];
  }
  return args;
}

async function main(argv) {
  const args = parseArgs(argv);
  const rows = readObservationArtifacts(args.input);

  if (args.check) {
    if (!fs.existsSync(args.output)) throw new Error("Calibration file not found: " + args.output);
    const calibration = JSON.parse(fs.readFileSync(args.output, "utf8"));
    const report = checkSeedTest(rows, calibration);
    console.log(JSON.stringify({
      mode: "check",
      seed_test: SEED_TEST,
      observations: rows.filter((row) => Number(row.seed) === SEED_TEST).length,
      ece_by_level: report,
      note: "SEED-TEST is used only for ECE; calibration and TAU are not fitted or changed.",
    }, null, 2));
    return;
  }

  const tuneRows = rows.filter((row) => Number(row.seed) === SEED_TUNE && row.status === "success");
  if (!tuneRows.length) {
    throw new Error("No successful SEED-TUNE observations (seed 424242) found in " + args.input);
  }
  const levels = calibrationForRows(tuneRows);
  const tuned = tuneTau(rows, levels);
  const calibration = {
    version: "isotonic-v1",
    tau: tuned.tau,
    training_seed: SEED_TUNE,
    training_observations: tuneRows.length,
    tune_radius_max_m: 5000,
    target_accuracy: 0.92,
    tune_accuracy: tuned.accuracy,
    tune_target_met: tuned.target_met,
    levels,
  };
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, JSON.stringify(calibration, null, 2) + "\n");
  console.log(JSON.stringify({
    mode: "fit",
    seed_tune: SEED_TUNE,
    observations: tuneRows.length,
    tau: tuned.tau,
    tune_accuracy: tuned.accuracy,
    target_met: tuned.target_met,
    output: args.output,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
