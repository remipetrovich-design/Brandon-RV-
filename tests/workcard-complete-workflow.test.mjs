import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("Workcard has a working Job details panel",async()=>{
 const component=await read("../src/components/admin-workcard-management.tsx");
 assert.match(component,/activeTab==="job"&&<section/);
 assert.match(component,/Job details/);
 assert.match(component,/Workcard title/);
 assert.match(component,/Approved scope \/ work requested/);
});

test("service catalogue selection is a category and never replaces the actual work item",async()=>{
 const component=await read("../src/components/admin-workcard-management.tsx");
 assert.match(component,/Service category \/ type of work/);
 assert.match(component,/Actual work item description/);
 assert.match(component,/Category:/);
 assert.doesNotMatch(component,/description:s\?\.name/);
});

test("admin can create and manage a booking directly from a Workcard",async()=>{
 const component=await read("../src/components/admin-workcard-management.tsx");
 const route=await read("../src/app/api/admin/jobs/[id]/booking/route.ts");
 assert.match(component,/activeTab==="booking"&&<section/);
 assert.match(component,/Create booking/);
 assert.match(component,/\/booking/);
 assert.match(route,/authorizePermission\("jobs\.manage"\)/);
 assert.match(route,/sameOrigin\(request\)/);
 assert.match(route,/appointments/);
 assert.match(route,/starts_at/);
 assert.match(route,/ends_at/);
 assert.match(route,/location/);
 assert.match(route,/workcard\.booking_created/);
 assert.match(route,/status:"confirmed"/);
 assert.match(route,/business_id/);
 assert.match(route,/\.lt\("starts_at"/);
 assert.match(route,/\.gt\("ends_at"/);
});
