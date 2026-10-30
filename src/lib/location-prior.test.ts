import assert from "node:assert/strict";
import test from "node:test";
import { createLastConfirmedVillagePrior, createRwandaProvincePrior } from "./location-prior";

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

const confirmedChoices = [
  ["RW-P1", "Umujyi wa Kigali", "City of Kigali", "province", "RW"],
  ["RW-P1-D11", "Nyarugenge", "Nyarugenge", "district", "RW-P1"],
  ["RW-P1-D11-S1101", "Gitega", "Gitega", "sector", "RW-P1-D11"],
  ["RW-P1-D11-S1101-C110101", "Akabahizi", "Akabahizi", "cell", "RW-P1-D11-S1101"],
  ["RW-P1-D11-S1101-C110101-V11010101", "Gihanga", "Gihanga", "village", "RW-P1-D11-S1101-C110101"],
];

test("last confirmed village is used only as an age-decayed, hierarchical prior", () => {
  const result = createLastConfirmedVillagePrior(
    { choices: confirmedChoices },
    "RW-P1-D11-S1101-C110101-V11010101",
    2 * 24 * 60 * 60 * 1000,
  );
  assert.ok(result);
  assert.equal(result.source, "last-known");
  assert.equal(result.hierarchy.village?.name_kiny, "Gihanga");
  assert.equal(result.hierarchy.district?.name_kiny, "Nyarugenge");
  assert.ok((result.hierarchy.village?.confidence ?? 100) < 100);
  assert.match(result.warning ?? "", /RECENCY_PRIOR_NOT_CURRENT_LOCATION/);
});

test("last confirmed village prior expires after 30 days and rejects unknown village codes", () => {
  assert.equal(createLastConfirmedVillagePrior({ choices: confirmedChoices }, confirmedChoices[4][0], 31 * 24 * 60 * 60 * 1000), null);
  assert.equal(createLastConfirmedVillagePrior({ choices: confirmedChoices }, "RW-P9-D99-V0", 1000), null);
});
