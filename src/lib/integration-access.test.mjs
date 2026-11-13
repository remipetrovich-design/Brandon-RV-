import test from "node:test";
import assert from "node:assert/strict";
import { hasIntegrationScope, validateIntegrationScopes, isIntegrationCredentialActive } from "./integration-access.mjs";

test("only explicitly granted scopes are accepted", () => {
  assert.equal(hasIntegrationScope(["customers.read"], "customers.read"), true);
  assert.equal(hasIntegrationScope(["customers.read"], "customers.write"), false);
  assert.equal(hasIntegrationScope([], null), true);
});

test("wildcard scope grants every operation", () => {
  assert.equal(hasIntegrationScope(["*"], "invoices.issue"), true);
});

test("scope validation rejects unknown permissions", () => {
  assert.deepEqual(validateIntegrationScopes(["customers.read", "root.database"]), { valid: false, invalid: ["root.database"] });
  assert.equal(validateIntegrationScopes(["customers.read", "quotes.draft"]).valid, true);
});

test("revoked and expired credentials are inactive", () => {
  const now = new Date("2026-11-14T00:00:00Z");
  assert.equal(isIntegrationCredentialActive({ revoked_at: null, expires_at: null, is_enabled: true }, now), true);
  assert.equal(isIntegrationCredentialActive({ revoked_at: null, expires_at: null, is_enabled: false }, now), false);
  assert.equal(isIntegrationCredentialActive({ revoked_at: "2026-11-13T00:00:00Z" }, now), false);
  assert.equal(isIntegrationCredentialActive({ revoked_at: null, expires_at: "2026-11-13T00:00:00Z" }, now), false);
});
