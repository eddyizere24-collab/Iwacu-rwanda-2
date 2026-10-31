import { performance } from "node:perf_hooks";
import { mkdir, writeFile } from "node:fs/promises";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const REST_URL = SUPABASE_URL ? `${SUPABASE_URL}/rest/v1` : "";
const DISTRICTS = [
  { name: "Nyarugenge", code: "RW-P1-D11" },
  { name: "Nyamasheke", code: "RW-P3-D37" },
  { name: "Musanze", code: "RW-P4-D43" },
];
const SEEDS = [424242, 20261030];
const RADII_M = [0, 20, 100, 500, 2000, 5000, 20000];
const WORKERS = 6;
const REQUEST_TIMEOUT_MS = 15_000;
const SELECT = "lng,lat,district_scope_code,seed,idx,true_village_scope_code";

const rawOutput = [];

function emit(message) {
  console.log(message);
  rawOutput.push(message);
}

function fail(message) {
  throw new Error(message);
}

function headers(extra = {}) {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    Accept: "application/json",
    ...extra,
  };
}

async function readJson(response) {
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    // Retain the HTTP status even when a gateway returns non-JSON text.
  }
  return { data, raw: raw.slice(0, 500) };
}

async function timedRequest(url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const started = performance.now();
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const { data, raw } = await readJson(response);
    return {
      ok: response.ok,
      status: response.status,
      durationMs: performance.now() - started,
      data,
      raw,
      timedOut: false,
      networkError: null,
    };
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    return {
      ok: false,
      status: null,
      durationMs: performance.now() - started,
      data: null,
      raw: "",
      timedOut,
      networkError: timedOut ? "timeout" : String(error?.message || error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTruthSamples(district) {
  const selected = [];
  for (const seed of SEEDS) {
    const params = new URLSearchParams({
      select: SELECT,
      district_scope_code: `eq.${district.code}`,
      seed: `eq.${seed}`,
      order: "idx.asc",
      limit: "5",
    });
    let response;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      response = await timedRequest(`${REST_URL}/w2_truth_samples?${params}`, {
        method: "GET",
        headers: headers(),
      });
      if (response.ok && Array.isArray(response.data)) break;
      const transient = response.timedOut || response.status === null || response.status >= 500;
      if (attempt < 2 && transient) {
        emit(`TRUTH_SAMPLE_RETRY district=${district.code} seed=${seed} attempt=${attempt} reason=${response.networkError || response.status}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      fail(
        `Truth-sample read failed: district=${district.code} seed=${seed} ` +
        `http=${response.status ?? "network"} body=${response.raw || response.networkError}`
      );
    }
    if (!response?.ok || !Array.isArray(response.data)) {
      fail(`Truth-sample read failed after retry: district=${district.code} seed=${seed}`);
    }
    if (response.data.length !== 5) {
      fail(
        `Expected 5 truth samples per seed; got ${response.data.length}: ` +
        `district=${district.code} seed=${seed}`
      );
    }
    selected.push(...response.data);
  }
  return selected.map((row) => ({
    lng: Number(row.lng),
    lat: Number(row.lat),
    district_scope_code: row.district_scope_code,
    seed: Number(row.seed),
    idx: Number(row.idx),
    true_village_scope_code: row.true_village_scope_code,
  }));
}

function topScopeCode(data) {
  if (!Array.isArray(data) || data.length === 0) return null;
  const sorted = [...data].sort(
    (left, right) => Number(right.confidence || 0) - Number(left.confidence || 0)
  );
  return sorted[0]?.scope_code ?? null;
}

function sampleKey(point, radius) {
  return [
    point.district_scope_code,
    point.seed,
    point.idx,
    radius,
  ].join("|");
}

async function callRpc(functionName, point, radius) {
  return timedRequest(`${REST_URL}/rpc/${functionName}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      p_lng: point.lng,
      p_lat: point.lat,
      p_accuracy_m: radius,
    }),
  });
}

function percentile(values, fraction) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(fraction * sorted.length) - 1);
  return Number(sorted[index].toFixed(2));
}

async function runV1Baseline(points) {
  const jobs = points.flatMap((point) =>
    RADII_M.filter((radius) => radius <= 100).map((radius) => ({ point, radius }))
  );
  const results = new Map();
  let cursor = 0;
  let http5xx = 0;
  let timeouts = 0;
  let otherErrors = 0;

  // Bound the comparison phase to the same six-worker ceiling; this keeps
  // the reference pass from consuming the full workflow timeout.
  const worker = async () => {
    while (true) {
      const jobIndex = cursor;
      cursor += 1;
      if (jobIndex >= jobs.length) return;
      const { point, radius } = jobs[jobIndex];
      const response = await callRpc("calculate_location_confidence", point, radius);
      if (response.status >= 500) http5xx += 1;
      else if (response.timedOut) timeouts += 1;
      else if (!response.ok) otherErrors += 1;
      results.set(sampleKey(point, radius), {
        top1: response.ok ? topScopeCode(response.data) : null,
        status: response.status,
        timedOut: response.timedOut,
      });
    }
  };

  await Promise.all(Array.from({ length: WORKERS }, () => worker()));
  emit(
    `V1_BASELINE workers=${WORKERS} requests=${jobs.length} http_5xx=${http5xx} ` +
    `timeouts=${timeouts} other_http_errors=${otherErrors}`
  );
  return results;
}

async function runV2Concurrent(points) {
  const jobs = points.flatMap((point) =>
    RADII_M.map((radius) => ({ point, radius }))
  );
  const results = [];
  let cursor = 0;

  const worker = async () => {
    while (true) {
      const jobIndex = cursor;
      cursor += 1;
      if (jobIndex >= jobs.length) return;
      const job = jobs[jobIndex];
      const response = await callRpc(
        "calculate_location_confidence_v2",
        job.point,
        job.radius
      );
      results.push({
        point: job.point,
        radius: job.radius,
        ...response,
        top1: response.ok ? topScopeCode(response.data) : null,
      });
    }
  };

  await Promise.all(Array.from({ length: WORKERS }, () => worker()));
  return results;
}

async function main() {
  if (!SUPABASE_URL || !ANON_KEY) {
    fail("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  if (!/^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?$/.test(SUPABASE_URL)) {
    fail("NEXT_PUBLIC_SUPABASE_URL must be an HTTPS origin without a path.");
  }
  if (new URL(SUPABASE_URL).hostname !== "buexgewxypvkqmphvfec.supabase.co") {
    fail("Refusing to call a Supabase project other than the authorized project.");
  }

  const byDistrict = [];
  for (const district of DISTRICTS) {
    const rows = await fetchTruthSamples(district);
    byDistrict.push(...rows);
    emit(
      `TRUTH_SAMPLES district=${district.name} code=${district.code} ` +
      `count=${rows.length} seeds=${SEEDS.join(",")}`
    );
  }
  const points = byDistrict;
  if (points.length !== 30) {
    fail(`Expected 30 points (10 per district); got ${points.length}.`);
  }

  // V1 is a bounded six-worker reference pass; V2 is measured separately below.
  const v1 = await runV1Baseline(points);

  // Exactly six worker loops run concurrently against the v2 RPC endpoint.
  const v2Results = await runV2Concurrent(points);
  const summary = [];

  for (const radius of RADII_M) {
    const group = v2Results.filter((row) => row.radius === radius);
    const latencies = group
      .filter((row) => row.status !== null)
      .map((row) => row.durationMs);
    const http5xx = group.filter((row) => row.status >= 500).length;
    const timeouts = group.filter((row) => row.timedOut).length;
    const otherHttpErrors = group.filter(
      (row) => !row.ok && !row.timedOut && !(row.status >= 500)
    ).length;
    const row = {
      radius_m: radius,
      requests: group.length,
      responses: latencies.length,
      p50_ms: percentile(latencies, 0.5),
      p95_ms: percentile(latencies, 0.95),
      max_ms: latencies.length
        ? Number(Math.max(...latencies).toFixed(2))
        : null,
      http_5xx: http5xx,
      timeouts,
      other_http_errors: otherHttpErrors,
    };
    summary.push(row);
    emit(
      `V2_LOAD radius_m=${radius} requests=${row.requests} responses=${row.responses} ` +
      `p50_ms=${row.p50_ms ?? "NA"} p95_ms=${row.p95_ms ?? "NA"} ` +
      `max_ms=${row.max_ms ?? "NA"} http_5xx=${http5xx} ` +
      `timeouts=${timeouts} other_http_errors=${otherHttpErrors}`
    );
  }

  const comparisonRows = v2Results.filter((row) => row.radius <= 100);
  const matches = comparisonRows.filter((row) => {
    const baseline = v1.get(sampleKey(row.point, row.radius));
    return Boolean(row.top1 && baseline?.top1 && row.top1 === baseline.top1);
  }).length;
  const expectedComparisons = points.length * 3;
  const agreementPct = (matches / expectedComparisons) * 100;
  const missingComparisons = expectedComparisons - comparisonRows.filter((row) => {
    const baseline = v1.get(sampleKey(row.point, row.radius));
    return Boolean(row.top1 && baseline?.top1);
  }).length;

  emit(
    `TOP1_AGREEMENT radius_m_le_100 matches=${matches}/${expectedComparisons} ` +
    `agreement_pct=${agreementPct.toFixed(2)} missing_pairs=${missingComparisons}`
  );

  const allP95Under300 = summary.every(
    (row) => row.p95_ms !== null && row.p95_ms < 300
  );
  const zeroTimeouts = summary.every((row) => row.timeouts === 0);
  const agreementAtLeast98 = agreementPct >= 98;
  const targetsMet = allP95Under300 && zeroTimeouts && agreementAtLeast98;

  emit(
    `TARGETS p95_lt_300ms=${allP95Under300 ? "PASS" : "FAIL"} ` +
    `zero_timeouts=${zeroTimeouts ? "PASS" : "FAIL"} ` +
    `top1_agreement_ge_98pct=${agreementAtLeast98 ? "PASS" : "FAIL"} ` +
    `OVERALL=${targetsMet ? "PASS" : "FAIL"}`
  );
  const allLatencies = v2Results
    .filter((row) => row.status !== null)
    .map((row) => row.durationMs);
  const total5xx = summary.reduce((sum, row) => sum + row.http_5xx, 0);
  const totalTimeouts = summary.reduce((sum, row) => sum + row.timeouts, 0);
  const totalOtherHttpErrors = summary.reduce((sum, row) => sum + row.other_http_errors, 0);
  const result = {
    status: targetsMet ? "PASS" : "FAIL",
    generated_at: new Date().toISOString(),
    github: {
      run_id: process.env.GITHUB_RUN_ID || null,
      run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
      sha: process.env.GITHUB_SHA || null,
      ref: process.env.GITHUB_REF || null
    },
    concurrency: { workers: WORKERS },
    truth_points: points.length,
    overall: {
      requests: v2Results.length,
      responses: allLatencies.length,
      p50_ms: percentile(allLatencies, 0.5),
      p95_ms: percentile(allLatencies, 0.95),
      max_ms: allLatencies.length ? Number(Math.max(...allLatencies).toFixed(2)) : null
    },
    by_radius: summary,
    errors: {
      http_5xx: total5xx,
      timeouts: totalTimeouts,
      other_http_errors: totalOtherHttpErrors
    },
    top1_agreement: {
      radius_m_lte_100: true,
      matches,
      expected: expectedComparisons,
      pct: Number(agreementPct.toFixed(2)),
      missing: missingComparisons
    },
    targets: {
      p95_lt_300ms: allP95Under300,
      zero_timeouts: zeroTimeouts,
      top1_agreement_ge_98pct: agreementAtLeast98
    },
    targets_met: targetsMet,
    raw_output: [...rawOutput]
  };
  emit(`RESULT_JSON ${JSON.stringify(result)}`);
  await mkdir("results", { recursive: true });
  await writeFile("results/rpc-load.json", JSON.stringify(result, null, 2), "utf8");

  if (!targetsMet) process.exitCode = 2;
}

main().catch(async (error) => {
  const message = `RPC_LOAD_FATAL ${error?.stack || error}`;
  console.error(message);
  rawOutput.push(message);
  try {
    await mkdir("results", { recursive: true });
    const failure = {
      status: "ERROR",
      generated_at: new Date().toISOString(),
      github: {
        run_id: process.env.GITHUB_RUN_ID || null,
        run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
        sha: process.env.GITHUB_SHA || null,
        ref: process.env.GITHUB_REF || null
      },
      concurrency: { workers: WORKERS },
      error: message,
      raw_output: [...rawOutput]
    };
    await writeFile("results/rpc-load.json", JSON.stringify(failure, null, 2), "utf8");
  } catch (writeError) {
    console.error(`RPC_LOAD_RESULT_WRITE_FATAL ${writeError?.message || writeError}`);
  }
  process.exitCode = 1;
});
