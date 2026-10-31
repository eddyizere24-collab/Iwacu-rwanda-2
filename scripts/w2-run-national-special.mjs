import fs from "node:fs";
import path from "node:path";
import { booleanPointInPolygon, point } from "@turf/turf";

const BASE_URL = "http://127.0.0.1:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const OUTPUT_DIR = process.env.W2_OUTPUT_DIR || "w2-results";
const SEEDS = [424242, 20261030];
const RADII = [0, 20, 100, 500, 2000, 5000, 20000];
const LEVELS = ["village", "cell", "sector", "district", "province"];
const BBOX = { west: 28.85, east: 29.35, south: -2.85, north: -1.65 };

if (!SUPABASE_URL || !ANON_KEY) throw new Error("W2 special-test preflight failed: public Supabase URL/key missing.");
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
      const message = label + " failed HTTP " + response.status + ": " + JSON.stringify(json).slice(0, 1600);
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

async function rpc(name, body) {
  return postJson(
    SUPABASE_URL + "/rest/v1/rpc/" + name,
    body,
    { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY },
    "Supabase RPC " + name
  );
}

async function locate(lat, lng, accuracy) {
  return postJson(BASE_URL + "/api/locate", {
    latitude: lat,
    longitude: lng,
    accuracy,
    method: "gps",
  }, {}, "/api/locate");
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
function stableSeed(seed, index, radius, tag) {
  let hash = seed >>> 0;
  for (const char of tag) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  hash = (hash ^ Math.imul(index + 1, 0x9E3779B1)) >>> 0;
  hash = (hash ^ Math.imul(radius + 1, 0x85EBCA6B)) >>> 0;
  return hash;
}
function applyExactNoise(row, radius, seed, tag) {
  if (radius === 0) return { latitude: Number(row.latitude), longitude: Number(row.longitude) };
  const random = mulberry32(stableSeed(seed, Number(row.sample_index), radius, tag));
  const angle = random() * Math.PI * 2;
  const lat = Number(row.latitude);
  const metersPerLongitudeDegree = 111320 * Math.cos(lat * Math.PI / 180);
  return {
    latitude: lat + Math.sin(angle) * radius / 110574,
    longitude: Number(row.longitude) + Math.cos(angle) * radius / metersPerLongitudeDegree,
  };
}
function prefixes(villageCode) {
  const parts = String(villageCode || "").split("-");
  return {
    province: parts.slice(0, 2).join("-"),
    district: parts.slice(0, 3).join("-"),
    sector: parts.slice(0, 4).join("-"),
    cell: parts.slice(0, 5).join("-"),
    village: parts.join("-"),
  };
}
function compact(row, response, seed, radius, dataset) {
  const success = response && response.status === "success";
  const truth = prefixes(row.true_village_scope_code);
  const level = success ? response.level || null : null;
  const chosen = level && response.hierarchy ? response.hierarchy[level]?.scope_code || null : null;
  const eligible = radius !== 20000 || level === "district" || level === "province";
  const byLevel = response?.per_level_candidates || response?.hierarchyCandidates || {};
  const levelMetrics = {};
  for (const levelName of LEVELS) {
    const list = Array.isArray(byLevel[levelName]) ? byLevel[levelName] : [];
    const top = list[0];
    const score = Math.max(0, Math.min(100, Number(top?.confidence) || 0));
    levelMetrics[levelName] = {
      raw_score: score / 100,
      calibrated_probability: Number.isFinite(Number(top?.calibrated_probability)) ? Number(top.calibrated_probability) : null,
      top1_scope_code: top?.scope_code || null,
      top1_correct: Boolean(top?.scope_code && top.scope_code === truth[levelName]),
    };
  }
  const villageTop3 = Array.isArray(response?.top3_villages) ? response.top3_villages : [];
  const flags = Array.isArray(response?.flags) ? response.flags : [];
  return {
    dataset,
    district: dataset === "lakeshore" ? "NATIONAL-KIVU" : "OUTSIDE",
    district_code: dataset === "lakeshore" ? "NATIONAL-KIVU" : "NATIONAL-OUTSIDE",
    sample_kind: row.sample_kind || dataset,
    sample_index: Number(row.sample_index),
    seed,
    radius_m: radius,
    true_village_scope_code: row.true_village_scope_code || null,
    true_village_path: row.true_village_path || null,
    true_prefixes: row.true_village_scope_code ? truth : null,
    status: response?.status || "transport_error",
    chosen_level: level || (response?.status === "outside" ? "outside" : "empty"),
    chosen_scope_code: chosen,
    chosen_level_correct: Boolean(chosen && chosen === truth[level] && eligible),
    chosen_level_is_district_or_province: level === "district" || level === "province",
    empty: !success || !level || !chosen,
    outside_rwanda: Boolean(response?.outside_rwanda || response?.status === "outside" || flags.includes("outside_rwanda")),
    flags,
    village_top1_correct: levelMetrics.village.top1_correct,
    village_top3_correct: villageTop3.some((item) => item?.scope_code === truth.village),
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
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function runLakeshore() {
  const rows = [];
  const proofs = [];
  for (const seed of SEEDS) {
    const samples = await rpc("w2_sample_kivu_lakeshore_truth", { p_seed: seed });
    if (!Array.isArray(samples) || samples.length < 200) {
      throw new Error("Kivu helper did not return at least 200 samples for seed " + seed);
    }
    const uniqueVillages = new Set(samples.map((x) => x.true_village_scope_code)).size;
    if (samples.some((x) =>
      Number(x.longitude) < BBOX.west || Number(x.longitude) > BBOX.east ||
      Number(x.latitude) < BBOX.south || Number(x.latitude) > BBOX.north ||
      Number(x.distance_to_union_edge_m) > 100
    )) {
      throw new Error("Kivu helper returned a point outside bbox or >100m from the union edge.");
    }
    proofs.push({
      seed,
      point_count: samples.length,
      kivu_bbox_villages: Number(samples[0].kivu_bbox_village_count),
      contributing_villages: uniqueVillages,
      reported_contributing_villages: Number(samples[0].contributing_village_count),
      first_5: samples.slice(0, 5),
    });
    const tasks = [];
    for (const sample of samples) for (const radius of RADII) tasks.push({ sample, seed, radius });
    const completed = await mapLimit(tasks, 6, async (task) => {
      const point = applyExactNoise(task.sample, task.radius, task.seed, "KIVU-LAKESHORE");
      try {
        const response = await locate(point.latitude, point.longitude, task.radius);
        return compact(task.sample, response, task.seed, task.radius, "lakeshore");
      } catch {
        return compact(task.sample, null, task.seed, task.radius, "lakeshore");
      }
    });
    rows.push(...completed);
  }
  return { rows, proofs };
}

const OUTSIDE_ZONES = [
  { country: "DRC", west: 28.55, east: 28.96, south: -2.75, north: -0.95 },
  { country: "Burundi", west: 29.05, east: 30.95, south: -3.20, north: -2.88 },
  { country: "Tanzania", west: 30.92, east: 31.20, south: -2.80, north: -1.05 },
  { country: "Uganda", west: 28.70, east: 31.15, south: -1.02, north: -0.70 },
];

async function runOutside() {
  const accepted = [];
  const perCountry = {};
  const samplingFailures = [];
  const rpcErrorExamples = [];
  for (let zoneIndex = 0; zoneIndex < OUTSIDE_ZONES.length; zoneIndex += 1) {
    const zone = OUTSIDE_ZONES[zoneIndex];
    const random = mulberry32(20261030 + zoneIndex * 9973);
    const found = [];
    let examined = 0;
    while (found.length < 50 && examined < 3000) {
      const batchCount = Math.min(24, 3000 - examined);
      const candidates = Array.from({ length: batchCount }, (_, i) => ({
        latitude: zone.south + random() * (zone.north - zone.south),
        longitude: zone.west + random() * (zone.east - zone.west),
        candidate_index: examined + i + 1,
      }));
      examined += batchCount;
      const classifications = await mapLimit(candidates, 8, async (candidate) => {
        try {
          const result = await rpc("classify_rwanda_coordinate", {
            p_lng: candidate.longitude,
            p_lat: candidate.latitude,
            p_buffer_m: 0,
          });
          const item = Array.isArray(result) ? result[0] : result;
          return { candidate, item };
        } catch (error) {
          return { candidate, item: null, error: String(error?.message || error) };
        }
      });
      const failedClassifierBatch = classifications.filter((entry) => entry.error);
      if (failedClassifierBatch.length === classifications.length && classifications.length > 0) {
        const failure = "classify_rwanda_coordinate unavailable in " + zone.country + ": " +
          failedClassifierBatch[0].error;
        samplingFailures.push(failure);
        if (rpcErrorExamples.length < 8) rpcErrorExamples.push(failure);
        break;
      }
      for (const entry of classifications) {
        const item = entry.item;
        const distance = Number(item?.distance_to_border_m);
        if (
          item &&
          item.is_inside_rwanda === false &&
          Number.isFinite(distance) &&
          distance >= 1000 && distance <= 200000 &&
          entry.candidate.longitude >= 28.5 && entry.candidate.longitude <= 31.2 &&
          entry.candidate.latitude >= -3.2 && entry.candidate.latitude <= -0.7
        ) {
          found.push({
            sample_kind: "outside_" + zone.country,
            sample_index: found.length + 1,
            country_zone: zone.country,
            longitude: entry.candidate.longitude,
            latitude: entry.candidate.latitude,
            true_outside_rwanda: true,
            distance_to_border_m: distance,
          });
          if (found.length === 50) break;
        }
      }
    }
    if (found.length !== 50) {
      samplingFailures.push("Outside sampler found " + found.length + "/50 points in " + zone.country +
        " after " + examined + " candidates.");
    }
    perCountry[zone.country] = { count: found.length, candidates_examined: examined };
    accepted.push(...found);
  }

  const checked = await mapLimit(accepted, 6, async (sample) => {
    let response = null;
    try { response = await locate(sample.latitude, sample.longitude, 0); } catch {}
    const flags = Array.isArray(response?.flags) ? response.flags : [];
    const borderZone = flags.includes("border_zone");
    const expected = sample.distance_to_border_m <= 5000 ? "border_zone" : "outside_rwanda";
    const passed = expected === "border_zone"
      ? response?.status === "success" && borderZone
      : response?.status === "outside" && response?.outside_rwanda === true;
    return {
      ...sample,
      response_status: response?.status || "transport_error",
      response_flags: flags,
      response_outside_rwanda: Boolean(response?.outside_rwanda),
      expected_class: expected,
      passed,
    };
  });
  return {
    total_points: checked.length,
    points_per_country_zone: perCountry,
    border_zone_points: checked.filter((x) => x.expected_class === "border_zone").length,
    outside_flagged_correctly: checked.filter((x) => x.passed).length,
    failures: checked.filter((x) => !x.passed),
    sampling_failures: samplingFailures,
    classifier_rpc_error_examples: rpcErrorExamples,
    rows: checked,
  };
}

async function runMapVsLocate(districtFiles) {
  const mapPoints = districtFiles.flatMap((file) => file.map_points || []);
  if (mapPoints.length < 200) throw new Error("Map test has fewer than 200 base points: " + mapPoints.length);
  const results = await mapLimit(mapPoints, 5, async (sample) => {
    let api = null;
    let map = null;
    try {
      api = await locate(sample.latitude, sample.longitude, 0);
      const west = Math.max(28.7001, sample.longitude - 0.01);
      const east = Math.min(31.0999, sample.longitude + 0.01);
      const south = Math.max(-2.9999, sample.latitude - 0.01);
      const north = Math.min(-0.8001, sample.latitude + 0.01);
      const query = new URLSearchParams({
        west: String(west), south: String(south), east: String(east), north: String(north),
      });
      const response = await fetch(BASE_URL + "/api/location-map?" + query.toString());
      map = await response.json();
    } catch (error) {
      return {
        district_code: sample.district_code,
        passed: false,
        reason: "request_error: " + String(error).slice(0, 300),
      };
    }
    const village = api?.hierarchy?.village;
    const scopeCode = village?.scope_code || null;
    const pathCode = scopeCode ? scopeCode.replaceAll("-", ".") : null;
    const features = Array.isArray(map?.features) ? map.features : [];
    const feature = features.find((item) =>
      item?.properties?.scope_code === scopeCode &&
      item?.properties?.path === pathCode &&
      item?.id === scopeCode &&
      item?.geometry &&
      booleanPointInPolygon(point([sample.longitude, sample.latitude]), item)
    );
    return {
      district_code: sample.district_code,
      true_village_scope_code: sample.true_village_scope_code,
      true_village_path: sample.true_village_path,
      api_status: api?.status || null,
      api_village_scope_code: scopeCode,
      map_feature_count: features.length,
      map_match: Boolean(feature),
      passed: Boolean(
        api?.status === "success" &&
        scopeCode === sample.true_village_scope_code &&
        pathCode === sample.true_village_path &&
        feature
      ),
      reason: !scopeCode ? "api_has_no_village" :
        scopeCode !== sample.true_village_scope_code ? "api_village_id_differs_from_truth" :
        pathCode !== sample.true_village_path ? "path_differs" :
        !feature ? "map_feature_not_found_or_does_not_contain_point" : null,
    };
  });
  const perDistrict = {};
  for (const row of results) perDistrict[row.district_code] = (perDistrict[row.district_code] || 0) + 1;
  return {
    attempted: results.length,
    passed: results.filter((x) => x.passed).length,
    mismatches: results.filter((x) => !x.passed),
    per_district: perDistrict,
    rows: results,
  };
}

async function main() {
  const started = Date.now();
  const lakeshore = await runLakeshore();
  const outside = await runOutside();

  const districtFiles = [];
  const directory = process.env.W2_DISTRICT_RESULTS_DIR || "district-artifacts";
  for (const file of fs.readdirSync(directory).filter((name) => name.endsWith(".json"))) {
    try { districtFiles.push(JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"))); } catch {}
  }
  const map = await runMapVsLocate(districtFiles);

  const seedTestInside = districtFiles.flatMap((file) => file.rows || [])
    .filter((row) => row.seed === 20261030 && row.radius_m === 0);
  const seedTestLakeInside = lakeshore.rows.filter((row) => row.seed === 20261030 && row.radius_m === 0);
  const insideFalsePositives = [...seedTestInside, ...seedTestLakeInside]
    .filter((row) => row.outside_rwanda);

  const output = {
    lakeshore_proof: lakeshore.proofs,
    lakeshore_rows: lakeshore.rows,
    outside_points: outside,
    map_vs_locate: map,
    seed_test_inside_false_positives: {
      tested: seedTestInside.length + seedTestLakeInside.length,
      count: insideFalsePositives.length,
      examples: insideFalsePositives.slice(0, 20),
    },
    elapsed_ms: Date.now() - started,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, "national-special-results.json"), JSON.stringify(output));
  console.log(JSON.stringify({
    lakeshore: lakeshore.proofs.map((x) => ({
      seed: x.seed,
      point_count: x.point_count,
      kivu_bbox_villages: x.kivu_bbox_villages,
      contributing_villages: x.contributing_villages,
    })),
    outside_total: outside.total_points,
    outside_per_country_zone: outside.points_per_country_zone,
    outside_correct: outside.outside_flagged_correctly,
    outside_failures: outside.failures.length,
    outside_sampling_failures: outside.sampling_failures,
    map_attempted: map.attempted,
    map_passed: map.passed,
    map_mismatches: map.mismatches.length,
    map_per_district: map.per_district,
    inside_false_positives: insideFalsePositives.length,
    elapsed_ms: output.elapsed_ms,
  }, null, 2));
}

main().catch((error) => {
  console.error("W2 national special tests failed:");
  console.error(String(error?.stack || error).split(/\r?\n/).slice(0, 40).join("\n"));
  process.exit(1);
});
