import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("customer booking requests are linked to matching Workcards and are not blocked by operating hours",async()=>{
 const route=await read("../src/app/api/portal/appointments/route.ts");
 assert.match(route,/from\("jobs"\)\.update\(\{appointment_id:appointment\.id/);
 assert.doesNotMatch(route,/opening_time|closing_time|outside Brandon RV.s configured operating hours/);
});

test("Workcard booking lookup prefers the current active quote appointment over a stale linked appointment",async()=>{
 const route=await read("../src/app/api/admin/jobs/[id]/work-entries/route.ts");
 assert.match(route,/activeAppointmentResult/);
 assert.match(route,/activeAppointmentResult\.data\?\?appointmentResult\.data/);
});

test("Bookings page has dedicated non-overlapping responsive layout rules",async()=>{
 const page=await read("../src/app/admin/[section]/page.tsx");
 const css=await read("../src/app/admin/admin-density.css");
 assert.match(page,/admin-appointments-page/);
 assert.match(css,/admin-appointments-page[\s\S]*?\.record-actions/);
 assert.match(css,/@media\s*\(max-width:\s*700px\)[\s\S]*?admin-appointments-page[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test("Jobcard exposes Workcard and Booking as separate top-level tabs",async()=>{
 const editor=await read("../src/components/admin-enquiry-editor.tsx");
 assert.match(editor,/brv-tab-workcard/);
 assert.match(editor,/brv-tab-booking/);
 assert.match(editor,/selectedTab===\"workcard\"/);
 assert.match(editor,/selectedTab===\"booking\"/);
});
test("Jobcard booking feed loads customer requests by original enquiry and active states",async()=>{
 const route=await read("../src/app/api/admin/enquiries/[id]/booking/route.ts");
 assert.match(route,/eq\("enquiry_id",id\)/);
 assert.match(route,/requested.*confirmed.*rescheduled/);
});

test("Jobcard booking tab exposes actions to confirm, reschedule and cancel each booking",async()=>{
 const editor=await read("../src/components/admin-enquiry-editor.tsx");
 assert.match(editor,/booking-action/);
 assert.match(editor,/Confirm booking/);
 assert.match(editor,/Reschedule booking/);
 assert.match(editor,/Cancel booking/);
 const route=await read("../src/app/api/admin/enquiries/[id]/booking/route.ts");
 assert.match(route,/export async function PATCH/);
 assert.match(route,/appointment_id/);
});

test("Workcard shows confirmed booking date, time and location even when its booking controls are hidden",async()=>{
 const editor=await read("../src/components/admin-workcard-management.tsx");
 assert.match(editor,/Confirmed booking details/);
 assert.match(editor,/job\.appointments\.starts_at/);
 assert.match(editor,/job\.appointments\.location/);
});

test("service presets create service or labour quote lines rather than parts lines",async()=>{
 const editor=await read("../src/components/admin-create-quote.tsx");
 assert.match(editor,/itemType:"labour"/);
 assert.match(editor,/itemType:e.target.value/);
 const jobs=await read("../src/app/api/admin/jobs/route.ts");
 assert.match(jobs,/entry_type:item\.item_type==="parts"\?"parts":"labour"/);
});

test("Jobcard pipeline includes procurement, booking, work, quality, invoice and payment stages",async()=>{
 const editor=await read("../src/components/admin-enquiry-editor.tsx");
 for(const stage of ["parts_required","parts_ordered","parts_received","ready_to_schedule","booking_requested","booked","work_in_progress","quality_check","ready_to_invoice","invoiced","awaiting_payment","paid","completed"]) assert.ok(editor.includes(stage),"missing stage "+stage);
 const route=await read("../src/app/api/admin/enquiries/[id]/route.ts");
 assert.match(route,/parts_required/);
});


test("Jobcard booking does not require an agreed finish time and manager-level roles bypass scheduling policy limits",async()=>{
 const editor=await read("../src/components/admin-enquiry-editor.tsx");
 const workcard=await read("../src/components/admin-workcard-management.tsx");
 const jobcardRoute=await read("../src/app/api/admin/enquiries/[id]/booking/route.ts");
 const workcardRoute=await read("../src/app/api/admin/jobs/[id]/booking/route.ts");
 const calendarRoute=await read("../src/app/api/admin/appointments/route.ts");
 const calendarEditRoute=await read("../src/app/api/admin/[section]/[id]/route.ts");
 const calendarForm=await read("../src/components/admin-create-appointment.tsx");
 const policy=await read("../src/lib/booking-rules.ts");
 const roles=await read("../src/lib/user-role-policy.mjs");
 assert.doesNotMatch(editor,/Agreed finish|draft\?\.ends_at/);
 assert.doesNotMatch(workcard,/Agreed finish date and time|bookingEnd/);
 assert.doesNotMatch(calendarForm,/Appointment finish|\[end,setEnd\]/);
 assert.match(jobcardRoute,/isManagerOrAbove/);
 assert.match(workcardRoute,/isManagerOrAbove/);
 assert.match(calendarRoute,/isManagerOrAbove/);
 assert.match(calendarEditRoute,/isManagerOrAbove/);
 assert.match(calendarEditRoute,/update\.ends_at=endsAt\?\.toISOString\(\)\?\?null/);
 assert.match(calendarEditRoute,/update\.ends_at!==undefined\?update\.ends_at:null/);
 assert.match(roles,/isManagerOrAbove/);
 assert.match(policy,/bypassRestrictions/);
 assert.match(policy,/const localParts/);
 for(const role of ["office_manager","manager","senior_manager","website_development_specialist","ceo_founder"]) assert.ok(roles.includes(role),"missing manager-level role "+role);
 assert.match(jobcardRoute,/ends_at:endsAt\?\.toISOString\(\)\?\?null/);
});


test("Jobcard booking mutations use appointment permission rather than general enquiry edit permission",async()=>{
 const page=await read("../src/app/admin/enquiries/[id]/page.tsx");
 const editor=await read("../src/components/admin-enquiry-editor.tsx");
 const route=await read("../src/app/api/admin/enquiries/[id]/booking/route.ts");
 assert.match(page,/canManageBookings/);
 assert.match(editor,/canManageBookings/);
 assert.match(route,/authorizePermission\("appointments\.manage"\)/);
});

test("Workcard detail reads and edits follow separate view and manage permissions",async()=>{
 const page=await read("../src/app/admin/jobs/[id]/page.tsx");
 const route=await read("../src/app/api/admin/jobs/[id]/work-entries/route.ts");
 assert.match(page,/jobs\.view/);
 assert.match(route,/authorizePermission\("jobs\.view"\)/);
});


test("Workcard management navigation is not exposed to ordinary workers",async()=>{
 const layout=await read("../src/app/admin/layout.tsx");
 assert.match(layout,/label:"Workcard management",href:"\/admin\/jobs",permission:"jobs\.manage"/);
 assert.match(layout,/label:"My Workcards",href:"\/admin\/my-workcards",permission:"jobs\.view"/);
});

test("Workcard detail read access is assignment-scoped and private data is permission-filtered",async()=>{
 const route=await read("../src/app/api/admin/jobs/[id]/work-entries/route.ts");
 assert.match(route,/authorizePermission\("jobs\.view"\)/);
 assert.match(route,/job_assignments/);
 assert.match(route,/This Workcard is not assigned to you/);
 assert.match(route,/internal_notes:canManage\?/);
 assert.match(route,/cost_unit_price:canViewCosts\?/);
 assert.match(route,/supplier_name:canViewSuppliers\?/);
 assert.match(route,/unit_price:canViewSales\?/);
 assert.match(route,/userHasPermission\(access\.user!\.id,"expenses\.manage"\)/);
 assert.match(route,/userHasPermission\(access\.user!\.id,"invoices\.manage"\)/);
});

test("Workcard read-only view does not expose edit controls",async()=>{
 const editor=await read("../src/components/admin-workcard-management.tsx");
 assert.match(editor,/WorkcardReadOnly/);
 assert.match(editor,/:job\?canManage\?/);
});
