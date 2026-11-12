import test from "node:test";
import assert from "node:assert/strict";
import { getWorkforceRankGroup, groupWorkforceMembers } from "./workforce-rank-groups.mjs";

test("maps each requested role to its automatic rank group", () => {
  assert.equal(getWorkforceRankGroup("customer").label, "Customers");
  assert.equal(getWorkforceRankGroup("trial_apprentice").label, "Base Workers");
  assert.equal(getWorkforceRankGroup("apprentice").label, "Base Workers");
  assert.equal(getWorkforceRankGroup("senior_apprentice").label, "Senior Staff");
  assert.equal(getWorkforceRankGroup("team_leader").label, "Senior Staff");
  assert.equal(getWorkforceRankGroup("office_supervisor").label, "Supervision Team");
  assert.equal(getWorkforceRankGroup("office_manager").label, "Management");
  assert.equal(getWorkforceRankGroup("manager").label, "Management");
  assert.equal(getWorkforceRankGroup("website_development_specialist").label, "Executive");
  assert.equal(getWorkforceRankGroup("ceo_founder").label, "Executive");
});

test("keeps existing additional system roles classified without changing their role keys", () => {
  assert.equal(getWorkforceRankGroup("supervisor").label, "Supervision Team");
  assert.equal(getWorkforceRankGroup("senior_manager").label, "Management");
  assert.equal(getWorkforceRankGroup("office_admin").label, "Supervision Team");
  assert.equal(getWorkforceRankGroup("general_manager").label, "Executive");
});

test("groups members automatically from their existing user_role", () => {
  const groups = groupWorkforceMembers([
    { id: "a", user_role: "apprentice" },
    { id: "b", user_role: "manager" },
    { id: "c", user_role: "customer" },
  ]);
  assert.deepEqual(groups.find((group) => group.key === "base_workers").members.map((member) => member.id), ["a"]);
  assert.deepEqual(groups.find((group) => group.key === "management").members.map((member) => member.id), ["b"]);
  assert.deepEqual(groups.find((group) => group.key === "customers").members.map((member) => member.id), ["c"]);
});

test("unknown or missing roles remain unclassified rather than receiving permissions", () => {
  assert.equal(getWorkforceRankGroup("custom_role").label, "Unclassified");
  assert.equal(getWorkforceRankGroup(null).label, "Unclassified");
});
