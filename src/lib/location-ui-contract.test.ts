import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const hook = readFileSync(new URL("../hooks/useLocation.ts", import.meta.url), "utf8");
const picker = readFileSync(new URL("../components/VillagePicker.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/locate/route.ts", import.meta.url), "utf8");

test("automatic location, not the picker, is the primary path", () => {
  assert.match(page, /<LocationButton/);
  assert.match(page, /<MapPinPicker/);
  assert.match(page, /Si hano\? Hindura/);
  assert.match(page, /<details[\s\S]*?<VillagePicker/);
});

test("GPS network fix, GPS watch, IP and last-known fix start independently", () => {
  assert.match(hook, /submitIpEstimate\(\)/);
  assert.match(hook, /getCurrentPosition\([\s\S]*?enableHighAccuracy: false/);
  assert.match(hook, /watchPosition\([\s\S]*?enableHighAccuracy: true/);
  assert.match(hook, /LAST_FIX_KEY/);
  assert.match(hook, /createRwandaProvincePrior/);
  assert.match(hook, /setTimeout\(resolve, 4_000\)/);
});

test("UI never renders the known empty-search or insufficient-score dead-end wording", () => {
  assert.doesNotMatch(page, /Nta mazina ahuye n'ishakisha wabonye/);
  assert.doesNotMatch(picker, /Nta mazina ahuye n'ishakisha wabonye/);
  assert.doesNotMatch(page, /Nta gipimo gihagije kuri uru rwego/);
  assert.match(picker, /choices\.length > 0/);
  assert.match(picker, /loadStaticChoices\(level, parentScopeCode, query\)/);
  assert.match(page, /data\.hierarchyCandidates/);
  assert.match(page, /noticeKiny/);
});

test("picker cache is versioned and validates the requested level and parent", () => {
  assert.match(picker, /iwacu-location-choices-v3/);
  assert.match(picker, /validCached/);
  assert.match(picker, /choice\.level === level/);
  assert.match(picker, /choice\.parent_scope_code === parentScopeCode/);
});

test("IP country mismatch cannot hard-reject a valid Rwanda IP coordinate", () => {
  assert.match(api, /ipCoordinatesInRwanda/);
  assert.doesNotMatch(api, /if \(country && country !== "RW"\)[\s\S]{0,150}OUTSIDE_RWANDA/);
});

test("no 150 m hard accuracy rejection remains in the automatic location flow", () => {
  assert.doesNotMatch(hook, /accuracy\s*>\s*150/);
  assert.doesNotMatch(api, /accuracy\s*>\s*150/);
  assert.doesNotMatch(api, /GPS_ACCURACY_TOO_LOW/);
});

test("unexpected locate-route failures fall back instead of returning a dead-end HTTP 502", () => {
  assert.match(api, /fallbackCoordinates/);
  assert.match(api, /respondWithOfficialFallback\([\s\S]*?fallbackCoordinates\.latitude/);
  assert.match(api, /createRwandaProvincePrior\(false\), \{ status: 200 \}/);
  assert.doesNotMatch(api, /\{ status: 502 \}/);
});
