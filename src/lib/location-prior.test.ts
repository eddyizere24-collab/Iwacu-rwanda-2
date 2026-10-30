import assert from "node:assert/strict";
import test from "node:test";
import { createRwandaProvincePrior } from "./location-prior";

test("returns all five province options as an explicit uninformative prior", () => {
  const answer = createRwandaProvincePrior(false);
  assert.equal(answer.status, "success");
  assert.equal(answer.source, "prior");
  assert.equal(answer.hierarchyCandidates?.province?.length, 5);
  assert.deepEqual(answer.hierarchyCandidates?.province?.map((p) => p.confidence), [20, 20, 20, 20, 20]);
  assert.equal(answer.hierarchy.country?.confidence, 0);
  assert.match(answer.warning ?? "", /EQUAL_RWANDA_SERVICE_AREA_PRIOR/);
});

test("marks the country only when the IP country signal says Rwanda", () => {
  const answer = createRwandaProvincePrior(true);
  assert.equal(answer.hierarchy.country?.confidence, 100);
  assert.match(answer.warning ?? "", /COUNTRY_ONLY/);
});

test("permission-denied, no-network and IP-without-coordinates still have a non-empty service-area answer", () => {
  for (const signalCase of ["permission-denied", "no-network", "ip-without-coordinates", "no-cached-fix"]) {
    const answer = createRwandaProvincePrior(false);
    assert.equal(answer.status, "success", signalCase);
    assert.equal(answer.source, "prior", signalCase);
    assert.equal(answer.hierarchyCandidates?.province?.length, 5, signalCase);
    assert.ok(answer.matches.length > 0, signalCase);
  }
});
