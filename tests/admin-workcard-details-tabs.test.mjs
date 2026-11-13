import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("Workcard detail API resolves customer and linked records through explicit foreign keys",async()=>{
 const route=await read("../src/app/api/admin/jobs/[id]/work-entries/route.ts");
 assert.match(route,/customers:users!jobs_customer_id_users_fkey\(full_name,email,phone\)/);
 assert.match(route,/enquiries:enquiries!quotes_enquiry_id_fkey/);
 assert.match(route,/vehicles:vehicles!appointments_vehicle_id_fkey/);
 assert.match(route,/services:services!job_work_entries_service_id_fkey/);
 assert.doesNotMatch(route,/customers\(full_name,email,phone\)/);
});

test("Workcard details report the failing query instead of masking every failure",async()=>{
 const route=await read("../src/app/api/admin/jobs/[id]/work-entries/route.ts");
 for(const message of ["Could not load Workcard customer and job details.","Could not load the Workcard quote and enquiry details.","Could not load the Workcard booking and vehicle details.","Could not load Workcard work entries.","Could not load Workcard service presets."]) assert.ok(route.includes(message));
});

test("full Workcard editor presents structured tabs and is not a dropdown",async()=>{
 const component=await read("../src/components/admin-workcard-management.tsx");
 for(const label of ["Customer & vehicle","Job details","Parts needed","Parts orders","Work details","Notes & history"]) assert.match(component,new RegExp(label));
 assert.doesNotMatch(component,/<details|<summary/);
 assert.match(component,/useEffect/);
});
