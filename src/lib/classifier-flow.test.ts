import assert from "node:assert/strict";
import test from "node:test";
import { classifyThenContinue } from "./classifier-flow";

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
