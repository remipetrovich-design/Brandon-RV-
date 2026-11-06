import test from "node:test";
import assert from "node:assert/strict";
import {hasEmployeeAccess,isGlobalAdministrator} from "../src/lib/user-role-policy.mjs";

test("customer-only accounts have no employee access",()=>{
 assert.equal(hasEmployeeAccess({user_role:null,employment_status:null}),false);
});

test("active employees with an assigned user role have access",()=>{
 assert.equal(hasEmployeeAccess({user_role:"technician",employment_status:"active"}),true);
});

test("leave, suspended and terminated employees have no employee access",()=>{
 for(const employment_status of ["leave","suspended","terminated",null]){
  assert.equal(hasEmployeeAccess({user_role:"technician",employment_status}),false);
 }
});

test("Owner and Website Developer are global administrators",()=>{
 for(const role of ["owner","website_developer","developer"]){
  assert.equal(isGlobalAdministrator(role),true);
  assert.equal(hasEmployeeAccess({user_role:role,employment_status:null}),true);
 }
});

test("ordinary employee roles are not global administrators",()=>{
 assert.equal(isGlobalAdministrator("manager"),false);
 assert.equal(isGlobalAdministrator(null),false);
});
