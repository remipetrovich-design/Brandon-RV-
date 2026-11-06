import test from "node:test";
import assert from "node:assert/strict";
import {hasEmployeeAccess,isGlobalAdministrator,isHireableCustomer} from "../src/lib/user-role-policy.mjs";

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
 for(const role of ["owner","website_developer"]){
  assert.equal(isGlobalAdministrator(role),true);
  assert.equal(hasEmployeeAccess({user_role:role,employment_status:null}),true);
 }
});

test("legacy developer label is not a separate global administrator role",()=>{
 assert.equal(isGlobalAdministrator("developer"),false);
 assert.equal(hasEmployeeAccess({user_role:"developer",employment_status:"active"}),true);
});

test("ordinary employee roles are not global administrators",()=>{
 assert.equal(isGlobalAdministrator("manager"),false);
 assert.equal(isGlobalAdministrator(null),false);
});

test("new active customer accounts can be hired",()=>{
 assert.equal(isHireableCustomer({primary_group:"customer",status:"active",user_role:null,employment_status:null}),true);
});

test("terminated employees can be rehired without creating a new account",()=>{
 assert.equal(isHireableCustomer({primary_group:"customer",status:"active",user_role:null,employment_status:"terminated"}),true);
});

test("active employees and accounts with a role cannot be hired twice",()=>{
 assert.equal(isHireableCustomer({primary_group:"customer",status:"active",user_role:"technician",employment_status:"active"}),false);
 assert.equal(isHireableCustomer({primary_group:"customer",status:"active",user_role:null,employment_status:"active"}),false);
});

test("inactive or non-customer accounts cannot be hired",()=>{
 assert.equal(isHireableCustomer({primary_group:"customer",status:"inactive",user_role:null,employment_status:null}),false);
 assert.equal(isHireableCustomer({primary_group:"staff",status:"active",user_role:null,employment_status:null}),false);
});
