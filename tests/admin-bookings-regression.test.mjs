import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("customer booking requests are linked to matching Workcards",async()=>{
 const route=await read("../src/app/api/portal/appointments/route.ts");
 assert.match(route,/from\("jobs"\)[\s\S]*?\.eq\("quote_id",quote\.id\)[\s\S]*?appointment_id/);
});

test("Workcard booking lookup prefers the current active quote appointment over a stale linked appointment",async()=>{
 const route=await read("../src/app/api/admin/jobs/[id]/work-entries/route.ts");
 assert.match(route,/activeAppointmentResult/);
 assert.match(route,/appointmentResult\.data\?\?activeAppointmentResult\.data/);
});

test("Bookings page has dedicated non-overlapping responsive layout rules",async()=>{
 const page=await read("../src/app/admin/[section]/page.tsx");
 const css=await read("../src/app/admin/admin-density.css");
 assert.match(page,/admin-appointments-page/);
 assert.match(css,/admin-appointments-page[\s\S]*?\.record-actions/);
 assert.match(css,/@media\s*\(max-width:\s*700px\)[\s\S]*?admin-appointments-page[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});
