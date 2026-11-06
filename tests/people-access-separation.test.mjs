import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
const profile=read("../src/components/admin-customer-profile.tsx");
const customerApi=read("../src/app/api/admin/customers/[id]/route.ts");
const staffApi=read("../src/app/api/staff/route.ts");
const adminLayout=read("../src/app/admin/layout.tsx");

test("customer profile exposes one User Role control and a separate free-text Staff Title",()=>{
  assert.equal((profile.match(/<label>User role<select/g)??[]).length,1);
  assert.match(profile,/\["jobTitle","Primary Staff Title"\]/);
  assert.doesNotMatch(profile,/employment\.userRole|userRole:employment\.userRole/);
});

test("changing User Role does not write employment status, start date or staff title",()=>{
  assert.doesNotMatch(customerApi,/update\.employment_status\s*=\s*"active"|update\.start_date\s*=|update\.job_title\s*=/);
});

test("employment updates cannot change or clear User Role",()=>{
  assert.doesNotMatch(staffApi,/body\.userRole|updates\.user_role\s*=/);
});

test("People and Access has one Workforce destination rather than anchor links to the same page",()=>{
  assert.equal((adminLayout.match(/href:"\/admin\/workforce"/g)??[]).length,1);
  assert.doesNotMatch(adminLayout,/\/admin\/workforce#/);
});
