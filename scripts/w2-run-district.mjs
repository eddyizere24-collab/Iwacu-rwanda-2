import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://127.0.0.1:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DISTRICT_CODE = process.env.W2_DISTRICT_CODE;
const DISTRICT_NAME = process.env.W2_DISTRICT_NAME;
const MODE = process.env.W2_MODE === "full" ? "full" : "smoke";
const OUTPUT_DIR = process.env.W2_OUTPUT_DIR || "w2-results";
const SEEDS = [424242, 20261030];
const RADII = [0, 20, 100, 500, 2000, 5000, 20000];
const LEVELS = ["village", "cell", "sector", "district", "province"];

if (!SUPABASE_URL || !ANON_KEY || !DISTRICT_CODE || !DISTRICT_NAME) {
  throw new Error("W2 preflight failed: public Supabase configuration or district matrix values are missing.");
}
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function postJson(url, body, headers = {}, label = "HTTP request") {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      const raw = await response.text();
      let json;
      try { json = raw ? JSON.parse(raw) : null; } catch { json = { raw_text: raw.slice(0, 2000) }; }
      if (response.ok) return json;
      const message = label + " failed HTTP " + response.status + ": " + JSON.stringify(json).slice(0, 1800);
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(message);
        await sleep(250 * (attempt + 1) ** 2);
        continue;
      }
      throw new Error(message);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < 4) await sleep(250 * (attempt + 1) ** 2);
    }
  }
  throw lastError || new Error(label + " failed after retries");
}

async function getTruthRows(seed) {
  const query = new URLSearchParams({
    select: "district_scope_code,seed,idx,lng,lat,true_village_scope_code,kind",
    district_scope_code: "eq." + DISTRICT_CODE,
    seed: "eq." + seed,
    order: "kind.asc,idx.asc",
  });
  const rows = await getJson(
    SUPABASE_URL + "/rest/v1/w2_truth_samples?" + query.toString(),
    { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY },
    "materialized truth samples " + DISTRICT_CODE + "/" + seed
  );
  if (!Array.isArray(rows)) throw new Error("Truth samples returned non-array for " + DISTRICT_CODE + "/" + seed);
  const mapped = rows.map((row) => ({
    sample_kind: row.kind,
    sample_index: Number(row.idx),
    seed: Number(row.seed),
    longitude: Number(row.lng),
    latitude: Number(row.lat),
    true_village_scope_code: row.true_village_scope_code,
    true_village_path: null,
  }));
  const interior = mapped.filter((row) => row.sample_kind === "interior").length;
  const border = mapped.filter((row) => row.sample_kind === "shared_boundary_50m").length;
  if (mapped.length !== 500 || interior !== 400 || border !== 100) {
    throw new Error("Truth table contract mismatch " + DISTRICT_CODE + "/" + seed +
      ": rows=" + mapped.length + ", interior=" + interior + ", border=" + border);
  }
  return mapped;
}

async function getJson(url, headers = {}, label = "HTTP GET") {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(url, { method: "GET", headers });
      const raw = await response.text();
      let json;
      try { json = raw ? JSON.parse(raw) : null; }
      catch { json = { raw_text: raw.slice(0, 2000) }; }
      if (response.ok) return json;
      const message = label + " failed HTTP " + response.status + ": " + JSON.stringify(json).slice(0, 1800);
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(message);
        await sleep(250 * (attempt + 1) ** 2);
        continue;
      }
      throw new Error(message);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < 4) await sleep(250 * (attempt + 1) ** 2);
    }
  }
  throw lastError || new Error(label + " failed after retries");
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stableSeed(seed, index, radius, district) {
  let hash = seed >>> 0;
  for (const char of district) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  hash = (hash ^ Math.imul(index + 1, 0x9E3779B1)) >>> 0;
  hash = (hash ^ Math.imul(radius + 1, 0x85EBCA6B)) >>> 0;
  return hash;
}

function applyExactNoise(row, radius, seed, index) {
  if (radius === 0) return { longitude: Number(row.longitude), latitude: Number(row.latitude) };
  const random = mulberry32(stableSeed(seed, index, radius, DISTRICT_CODE));
  const bearing = random() * Math.PI * 2;
  const lat = Number(row.latitude);
  const metersPerLongitudeDegree = 111320 * Math.cos(lat * Math.PI / 180);
  return {
    longitude: Number(row.longitude) + (Math.cos(bearing) * radius) / metersPerLongitudeDegree,
    latitude: lat + (Math.sin(bearing) * radius) / 110574,
  };
}

function prefixCodes(villageCode) {
  const parts = String(villageCode || "").split("-");
  if (parts.length !== 6) throw new Error("Invalid village scope code in truth sample: " + villageCode);
  return {
    province: parts.slice(0, 2).join("-"),
    district: parts.slice(0, 3).join("-"),
    sector: parts.slice(0, 4).join("-"),
    cell: parts.slice(0, 5).join("-"),
    village: parts.join("-"),
  };
}

async function locate(point, accuracy) {
  return postJson(BASE_URL + "/api/locate", {
    latitude: point.latitude,
    longitude: point.longitude,
    accuracy,
    method: "gps",
  }, {}, "/api/locate");
}

function compactObservation(row, response, seed, radius) {
  const success = response && response.status === "success";
  const truth = prefixCodes(row.true_village_scope_code);
  const level = success ? response.level || null : null;
  const chosen = level && response.hierarchy ? response.hierarchy[level]?.scope_code || null : null;
  const chosenEligible20k = radius !== 20000 || level === "district" || level === "province";
  const chosenCorrect = Boolean(chosen && chosen === truth[level] && chosenEligible20k);
  const candidatesByLevel = response?.per_level_candidates || response?.hierarchyCandidates || {};
  const levelMetrics = {};
  for (const candidateLevel of LEVELS) {
    const candidates = Array.isArray(candidatesByLevel[candidateLevel]) ? candidatesByLevel[candidateLevel] : [];
    const top = candidates[0];
    const score = Math.max(0, Math.min(100, Number(top?.confidence) || 0));
    levelMetrics[candidateLevel] = {
      raw_score: score / 100,
      calibrated_probability: top?.calibrated_probability !== null &&
        top?.calibrated_probability !== undefined &&
        Number.isFinite(Number(top.calibrated_probability))
        ? Number(top.calibrated_probability) : null,
      top1_scope_code: top?.scope_code || null,
      top1_correct: Boolean(top?.scope_code && top.scope_code === truth[candidateLevel]),
    };
  }
  const top3 = Array.isArray(response?.top3_villages) ? response.top3_villages : [];
  const flags = Array.isArray(response?.flags) ? response.flags : [];
  const chosenLevelDistribution = level || (response?.status === "outside" ? "outside" : "empty");
  return {
    district: DISTRICT_NAME,
    district_code: DISTRICT_CODE,
    sample_kind: row.sample_kind,
    sample_index: Number(row.sample_index),
    seed,
    radius_m: radius,
    true_village_scope_code: row.true_village_scope_code,
    true_village_path: row.true_village_path,
    true_prefixes: truth,
    status: response?.status || "transport_error",
    chosen_level: chosenLevelDistribution,
    chosen_scope_code: chosen,
    chosen_level_correct: chosenCorrect,
    chosen_level_is_district_or_province: level === "district" || level === "province",
    empty: response?.status === "error" ||
      response?.status === "transport_error" ||
      (success && (!level || !chosen)),
    outside_rwanda: Boolean(response?.outside_rwanda || response?.status === "outside" || flags.includes("outside_rwanda")),
    flags,
    village_top1_correct: levelMetrics.village.top1_correct,
    village_top3_correct: top3.some((candidate) => candidate?.scope_code === truth.village),
    level_metrics: levelMetrics,
    calibration_version: response?.calibration_version || null,
    response_commit_sha: response?.commit_sha || null,
  };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      out[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
}

function csvCell(value) {
  const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return '"' + text.replaceAll('"', '""') + '"';
}

async function main() {
  const started = Date.now();
  const allRows = [];
  const mapPoints = [];
  let requestErrors = 0;
  const requestErrorExamples = [];
  const sampleLimit = MODE === "smoke" ? 20 : 500;

  for (const seed of SEEDS) {
    const truthRows = await getTruthRows(seed);
    const chosenRows = truthRows.slice(0, sampleLimit);
    if (seed === 20261030) {
      mapPoints.push(...truthRows.filter((row) => row.sample_kind === "interior").slice(0, 7).map((row) => ({
        district: DISTRICT_NAME,
        district_code: DISTRICT_CODE,
        longitude: Number(row.longitude),
        latitude: Number(row.latitude),
        true_village_scope_code: row.true_village_scope_code,
        true_village_path: row.true_village_path,
      })));
    }

    const tasks = [];
    for (const row of chosenRows) {
      for (const radius of RADII) tasks.push({ row, seed, radius });
    }

    const completed = await mapLimit(tasks, 6, async (task) => {
      const point = applyExactNoise(task.row, task.radius, task.seed, Number(task.row.sample_index));
      try {
        const response = await locate(point, task.radius);
        return compactObservation(task.row, response, task.seed, task.radius);
      } catch (error) {
        requestErrors += 1;
        const message = String(error?.stack || error);
        if (requestErrorExamples.length < 10) {
          requestErrorExamples.push({
            seed: task.seed,
            radius_m: task.radius,
            sample_index: Number(task.row.sample_index),
            message: message.split(/\r?\n/).slice(0, 40).join("\n"),
          });
        }
        return { ...compactObservation(task.row, null, task.seed, task.radius), request_error: message.slice(0, 2000) };
      }
    });
    allRows.push(...completed);
  }

  const output = {
    mode: MODE,
    district: DISTRICT_NAME,
    district_code: DISTRICT_CODE,
    expected_truth_per_seed: 500,
    samples_per_seed: sampleLimit,
    radii_m: RADII,
    row_count: allRows.length,
    request_errors: requestErrors,
    request_error_examples: requestErrorExamples,
    map_points: mapPoints,
    elapsed_ms: Date.now() - started,
    rows: allRows,
  };
  const file = path.join(OUTPUT_DIR, DISTRICT_CODE + ".json");
  fs.writeFileSync(file, JSON.stringify(output));
  const csvHeader = ["district_code","seed","radius_m","sample_kind","sample_index","status","chosen_level","chosen_scope_code","chosen_level_correct","empty","outside_rwanda","village_top1_correct","village_top3_correct","flags"];
  const csv = [csvHeader.join(",")];
  for (const row of allRows) csv.push(csvHeader.map((key) => csvCell(row[key])).join(","));
  fs.writeFileSync(path.join(OUTPUT_DIR, DISTRICT_CODE + ".csv"), csv.join("\n") + "\n");

  const nonEmpty = allRows.filter((row) => !row.empty).length;
  console.log(JSON.stringify({
    district: DISTRICT_NAME,
    district_code: DISTRICT_CODE,
    mode: MODE,
    truth_rows_per_seed: 500,
    observations: allRows.length,
    non_empty_observations: nonEmpty,
    empty_observations: allRows.length - nonEmpty,
    request_errors: requestErrors,
    request_error_examples: requestErrorExamples,
    elapsed_ms: output.elapsed_ms,
    artifact: file,
  }, null, 2));
}

main().catch((error) => {
  console.error("W2 district test failed:");
  console.error(String(error?.stack || error).split(/\r?\n/).slice(0, 40).join("\n"));
  process.exit(1);
});
