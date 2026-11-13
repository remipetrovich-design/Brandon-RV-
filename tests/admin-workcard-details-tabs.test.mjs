import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("Workcard detail API resolves customer through the explicit jobs-to-users foreign key",async()=>{
 const route=await read("../src/app/api/admin/jobs/[id]/work-entries/route.ts");
 assert.match(route,/customers:users!jobs_customer_id_users_fkey\(full_name,email,phone\)/);
 assert.doesNotMatch(route,/customers\(full_name,email,phone\)/);
});

test("full Workcard editor presents structured tabs for customer, job, parts, orders, work and notes",async()=>{
 const component=await read("../src/components/admin-workcard-management.tsx");
 for(const label of ["Customer & vehicle","Job details","Parts needed","Parts orders","Work details","Notes & history"]) assert.match(component,new RegExp(label));
});
