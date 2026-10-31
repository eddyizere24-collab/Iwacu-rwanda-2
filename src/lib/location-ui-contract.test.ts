import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const hook = readFileSync(new URL("../hooks/useLocation.ts", import.meta.url), "utf8");
const picker = readFileSync(new URL("../components/VillagePicker.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/locate/route.ts", import.meta.url), "utf8");
const landmarks = readFileSync(new URL("../components/NearbyLandmarks.tsx", import.meta.url), "utf8");
const contextRoute = readFileSync(new URL("../app/api/location-context/route.ts", import.meta.url), "utf8");
const featureFlags = readFileSync(new URL("./feature-flags.ts", import.meta.url), "utf8");
const packageJson = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../../.github/workflows/location-engine-checks.yml", import.meta.url), "utf8");
const report = readFileSync(new URL("../components/LocationReportButton.tsx", import.meta.url), "utf8");

test("automatic location, not the picker, is the primary path", () => {
  assert.match(page, /<LocationButton/);
  assert.match(page, /<MapPinPicker/);
  assert.match(page, /Si hano\? Hindura/);
  assert.match(page, /<details[\s\S]*?<VillagePicker/);
});

test("GPS, IP and last-confirmed prior start with the first location attempt", () => {
  assert.ok(hook.includes("lastConfirmedPriorPromise"));
  assert.ok(hook.includes("void submitIpEstimate();"));
  assert.ok(hook.includes("maximumAge: 60_000"));
  assert.ok(hook.includes("setTimeout(resolve, 3_000)"));
  assert.match(hook, /getCurrentPosition\([\s\S]*?enableHighAccuracy: false/);
  assert.match(hook, /watchPosition\([\s\S]*?enableHighAccuracy: true/);
});

test("picker is database-first and never invokes /api/locate or live NISR", () => {
  assert.ok(picker.includes("/api/administrative-units?"));
  assert.ok(picker.includes('params.set("parent_id", parentId)'));
  assert.ok(picker.includes('const CACHE_PREFIX = "iwacu-db-picker-v4:"'));
  assert.ok(picker.includes("item.level === level"));
  assert.ok(picker.includes("item.parent_id === parentId"));
  assert.ok(picker.includes("return cached ?? []"));
  assert.doesNotMatch(picker, /\/api\/locate/);
  assert.doesNotMatch(picker, /gis-server\.statistics\.gov\.rw/);
});

test("landmarks feature is OFF by default and does not render or request when disabled", () => {
  assert.ok(featureFlags.includes('return value === "true"'));
  assert.ok(landmarks.includes("if (!isLandmarksFeatureEnabled()) return null;"));
  assert.ok(landmarks.includes("runLandmarksRequest"));
  assert.ok(contextRoute.includes("if (!isLandmarksFeatureEnabled())"));
  assert.ok(contextRoute.includes("{ disabled: true, status: \"disabled\""));
});

test("location route classifies the Rwanda border before village scoring", () => {
  assert.ok(api.includes('"classify_rwanda_coordinate"'));
  assert.ok(api.indexOf("supabase.rpc(CLASSIFIER_RPC") < api.indexOf('"calculate_location_confidence"'));
  assert.ok(api.includes("outside_rwanda: true"));
  assert.ok(api.includes('flags: ["border_zone"]'));
  assert.ok(api.includes("top3_villages: []"));
  assert.ok(api.includes("per_level_candidates: candidates"));
  assert.ok(api.includes("commit_sha: process.env.VERCEL_GIT_COMMIT_SHA"));
});

test("AI location lookup uses search_places; legacy helper functions have no call sites", () => {
  const ai = readFileSync(new URL("../app/api/ai-router/route.ts", import.meta.url), "utf8");
  assert.ok(ai.includes('supabase.rpc("search_places"'));
  assert.equal((ai.match(/findOfficialUnit\(/g) ?? []).length, 1);
  assert.equal((ai.match(/fetchLeadersForUnit\(/g) ?? []).length, 1);
});

test("map overlay uses database geometry and canonical village scope IDs", () => {
  const mapRoute = readFileSync(new URL("../app/api/location-map/route.ts", import.meta.url), "utf8");
  const mapPicker = readFileSync(new URL("../components/MapPinPicker.tsx", import.meta.url), "utf8");
  assert.ok(mapRoute.includes('rpc("get_location_map_overlay"'));
  assert.ok(mapRoute.includes("properties.scope_code"));
  assert.ok(mapRoute.includes("id: scopeCode || feature.id"));
  assert.ok(mapPicker.includes('fetch("/api/location-map?"'));
  assert.ok(mapPicker.includes('layer.on("click"'));
  assert.ok(mapPicker.includes("onSelect(selected.latitude, selected.longitude, 200)"));
});

test("accuracy-rejection guard has an npm command and a CI step", () => {
  const checker = readFileSync(new URL("../../scripts/check-no-accuracy-rejection.mjs", import.meta.url), "utf8");
  assert.ok(checker.includes("MAX_" + "ACCURACY"));
  assert.ok(checker.includes("fixed numeric accuracy/radius comparison is forbidden"));
  assert.ok(packageJson.includes('"check:no-accuracy-rejection": "node scripts/check-no-accuracy-rejection.mjs"'));
  assert.ok(workflow.includes("Accuracy rejection JavaScript guard"));
  assert.ok(workflow.includes("npm run check:no-accuracy-rejection"));
});

test("unexpected locate errors return an explicit service-area prior, not HTTP 502", () => {
  assert.ok(api.includes("fallbackCoordinates"));
  assert.ok(api.includes("withLocationResponseContract(createRwandaProvincePrior(false), [method])"));
  assert.ok(api.includes('flags: ["rwanda_classifier_unavailable"]'));
  assert.doesNotMatch(api, /\{ status: 502 \}/);
});

test("copyable phone report contains percentages, timings and commit SHA", () => {
  assert.ok(page.includes("<LocationReportButton data={data} />"));
  assert.ok(report.includes("percentages,"));
  assert.ok(report.includes("timings_ms:"));
  assert.ok(report.includes("commit_sha:"));
  assert.ok(report.includes("score_note:"));
});

test("zero-metre accuracy is accepted and large measured radii are not gated by 45km", () => {
  assert.ok(api.includes("accuracy: z.number().finite().nonnegative()"));
  assert.ok(hook.includes("Math.max(0, Number.isFinite(rawAccuracy)"));
  assert.doesNotMatch(hook, /LOW_INFORMATION_RADIUS_METERS/);
  assert.ok(hook.includes("hasMeasuredFix"));
  assert.ok(hook.includes("trackAsBestFix = true"));
  assert.ok(hook.includes("if (value && !controller.signal.aborted && !hasMeasuredFix)"));
});

test("accuracy guard flags named constants and documents the precise UI-only allow-list", () => {
  const checker = readFileSync(new URL("../../scripts/check-no-accuracy-rejection.mjs", import.meta.url), "utf8");
  assert.ok(checker.includes("namedConstantAccuracyGuard"));
  assert.ok(checker.includes("NAMED_GUARD_ALLOWLIST"));
  assert.ok(checker.includes("notice text only; no fix rejection or request suppression"));
});
