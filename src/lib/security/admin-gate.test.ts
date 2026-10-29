import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adminCanManageScope, type AdminIdentity } from "@/lib/security/admin-gate";

const districtAdmin: AdminIdentity = {
  userId: "district-admin-id",
  scopeCode: "RW-01-01",
  isSuperAdmin: false,
};

describe("adminCanManageScope", () => {
  it("allows a scoped admin to manage the exact assigned scope", () => {
    assert.equal(adminCanManageScope(districtAdmin, "RW-01-01"), true);
  });

  it("allows descendants of the assigned scope", () => {
    assert.equal(adminCanManageScope(districtAdmin, "RW-01-01-02"), true);
    assert.equal(adminCanManageScope(districtAdmin, "RW-01-01-02-03"), true);
    assert.equal(adminCanManageScope(districtAdmin, "RW-01-01-02-03-04"), true);
  });

  it("rejects sibling scopes and prefix lookalikes", () => {
    assert.equal(adminCanManageScope(districtAdmin, "RW-01-02"), false);
    assert.equal(adminCanManageScope(districtAdmin, "RW-01-010"), false);
    assert.equal(adminCanManageScope(districtAdmin, "RW-01-010-01"), false);
    assert.equal(adminCanManageScope(districtAdmin, "RW"), false);
  });

  it("rejects malformed targets and unsupported hierarchy depth", () => {
    assert.equal(adminCanManageScope(districtAdmin, "RW-01-01-01-01-01-01"), false);
    assert.equal(adminCanManageScope(districtAdmin, "RW-01-%"), false);
    assert.equal(adminCanManageScope(districtAdmin, "RW/01"), false);
    assert.equal(adminCanManageScope(districtAdmin, ""), false);
  });

  it("allows a super-admin to manage all valid administrative scopes", () => {
    const superAdmin: AdminIdentity = {
      userId: "super-admin-id",
      scopeCode: "RW",
      isSuperAdmin: true,
    };
    assert.equal(adminCanManageScope(superAdmin, "RW"), true);
    assert.equal(adminCanManageScope(superAdmin, "RW-01-01-02-03-04"), true);
    assert.equal(adminCanManageScope(superAdmin, "RW-01-%"), false);
    assert.equal(adminCanManageScope(superAdmin, "RW-01-01-02-03-04-05"), false);
  });
});
