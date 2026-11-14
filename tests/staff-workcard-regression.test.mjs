import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("a confirmed booking with a start and location can start a Workcard without a promised finish",async()=>{
 const route=await read("../src/app/api/staff/jobs/[id]/status/route.ts");
 assert.match(route,/booking\.status!==\"confirmed\"/);
 assert.match(route,/!booking\.starts_at/);
 assert.match(route,/!booking\.location/);
 assert.doesNotMatch(route,/!booking\.ends_at/);
});

test("worker booking requests do not store an implied preferred finish time",async()=>{
 const route=await read("../src/app/api/staff/jobs/[id]/booking-request/route.ts");
 assert.doesNotMatch(route,/const durationRaw/);
 assert.doesNotMatch(route,/preferred_end:end/);
 assert.match(route,/preferred_end:null/);
});

test("worker-facing Workcards do not expose customer prices or invoice controls",async()=>{
 const route=await read("../src/app/api/staff/jobs/route.ts");
 const entries=await read("../src/app/api/staff/jobs/[id]/work-entries/route.ts");
 const ui=await read("../src/components/staff-work-orders.tsx");
 assert.doesNotMatch(route,/quotes\(quote_number,status,total/);
 assert.doesNotMatch(route,/unit_price,cost_unit_price,tax_rate,line_total/);
 assert.doesNotMatch(entries,/unit_price,tax_rate,line_total/);
 assert.doesNotMatch(ui,/Customer charge/);
 assert.doesNotMatch(ui,/Mark actual work as invoiceable/);
 assert.doesNotMatch(ui,/job\.quotes\?\.total/);
});

test("workers can record actual quantities and costs but cannot set customer billing values",async()=>{
 const route=await read("../src/app/api/staff/jobs/[id]/work-entries/route.ts");
 assert.match(route,/cost_unit_price:costUnitPrice/);
 assert.doesNotMatch(route,/invoiceable:body\.invoiceable/);
 assert.doesNotMatch(route,/unit_price:unitPrice/);
 assert.match(route,/invoiceable:false/);
});

test("Jobcard booking details require appointment view or manage permission and hide private notes",async()=>{
 const route=await read("../src/app/api/admin/enquiries/[id]/booking/route.ts");
 const page=await read("../src/app/admin/enquiries/[id]/page.tsx");
 const editor=await read("../src/components/admin-enquiry-editor.tsx");
 assert.match(route,/appointments\.view/);
 assert.match(route,/appointments\.manage/);
 assert.match(route,/internal_notes:canManageAppointments\?/);
 assert.match(page,/canViewBookings/);
 assert.match(editor,/canViewBookings/);
});
