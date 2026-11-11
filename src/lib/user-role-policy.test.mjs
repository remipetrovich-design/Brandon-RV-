import test from "node:test";
import assert from "node:assert/strict";
import {GLOBAL_ADMIN_ROLES,BUILT_IN_STAFF_ROLES,isGlobalAdministrator,hasEmployeeAccess} from "./user-role-policy.mjs";

test("CEO / Founder and Website Development Specialist have unrestricted administrator access",()=>{
  assert.equal(isGlobalAdministrator("ceo_founder"),true);
  assert.equal(isGlobalAdministrator("website_development_specialist"),true);
  assert.equal(hasEmployeeAccess({user_role:"ceo_founder",employment_status:"terminated"}),true);
  assert.equal(hasEmployeeAccess({user_role:"website_development_specialist",employment_status:null}),true);
});

test("legacy administrator keys remain unrestricted during account migration",()=>{
  assert.equal(isGlobalAdministrator("owner"),true);
  assert.equal(isGlobalAdministrator("website_developer"),true);
});

test("workforce roles are not global administrators",()=>{
  for(const role of BUILT_IN_STAFF_ROLES.filter(x=>!["ceo_founder","website_development_specialist"].includes(x))){
    assert.equal(isGlobalAdministrator(role),false,role);
  }
});

test("ordinary staff access requires an active employment add-on",()=>{
  assert.equal(hasEmployeeAccess({user_role:"apprentice",employment_status:"active"}),true);
  assert.equal(hasEmployeeAccess({user_role:"apprentice",employment_status:"suspended"}),false);
  assert.equal(hasEmployeeAccess({user_role:null,employment_status:null}),false);
});

test("customer is not a staff role or global administrator",()=>{
  assert.equal(isGlobalAdministrator("customer"),false);
  assert.equal(hasEmployeeAccess({user_role:"customer",employment_status:null}),false);
  assert.equal(GLOBAL_ADMIN_ROLES.has("customer"),false);
});
