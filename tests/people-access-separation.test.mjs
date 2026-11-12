import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";

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

test("employment updates change User Role only through the separately validated roleKey field",()=>{
  assert.doesNotMatch(staffApi,/body\.userRole/);
  assert.match(staffApi,/if\(body\.roleKey!==undefined\)/);
  assert.match(staffApi,/roleKeys\.includes\(value\)&&!isGlobalAdministrator/);
  assert.match(staffApi,/updates\.user_role=value/);
});

test("the duplicate root app directory cannot shadow the real src app",()=>{
  assert.equal(existsSync(new URL("../app/api/admin/customers/[id]/route.ts",import.meta.url)),false);
});

test("People and Access has one Workforce destination rather than anchor links to the same page",()=>{
  assert.equal((adminLayout.match(/href:"\/admin\/workforce"/g)??[]).length,1);
  assert.doesNotMatch(adminLayout,/\/admin\/workforce#/);
});
