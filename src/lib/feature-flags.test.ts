import test from "node:test";
import assert from "node:assert/strict";
import { isLandmarksFeatureEnabled, runLandmarksRequest } from "./feature-flags";

test("landmarks are OFF unless the environment flag is exactly true", () => {
  assert.equal(isLandmarksFeatureEnabled(undefined), false);
  assert.equal(isLandmarksFeatureEnabled("false"), false);
  assert.equal(isLandmarksFeatureEnabled("1"), false);
  assert.equal(isLandmarksFeatureEnabled("true"), true);
});

test("flag OFF performs zero network requests", async () => {
  let requests = 0;
  const result = await runLandmarksRequest(async () => {
    requests += 1;
    return { status: 200 };
  }, isLandmarksFeatureEnabled(undefined));
  assert.deepEqual(result, { status: "disabled" });
  assert.equal(requests, 0);
});

test("flag ON invokes the supplied request exactly once", async () => {
  let requests = 0;
  const result = await runLandmarksRequest(async () => {
    requests += 1;
    return "loaded";
  }, isLandmarksFeatureEnabled("true"));
  assert.deepEqual(result, { status: "ok", value: "loaded" });
  assert.equal(requests, 1);
});
