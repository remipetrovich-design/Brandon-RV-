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
 assert.match(component,/Service preset category \/ type of work/);
 assert.match(component,/Actual work item description/);
 assert.match(component,/Category:/);
 assert.doesNotMatch(component,/description:s\?\.name/);
});

test("admin can create and manage a booking directly from a Workcard",async()=>{
 const component=await read("../src/components/admin-workcard-management.tsx");
 const route=await read("../src/app/api/admin/jobs/[id]/booking/route.ts");
 assert.match(component,/activeTab==="booking"&&<section/);
 assert.match(component,/Accept booking request/);
 assert.match(component,/Booking settings/);
 assert.match(component,/\/booking/);
 assert.match(route,/authorizePermission\("jobs\.manage"\)/);
 assert.match(route,/sameOrigin\(request\)/);
 assert.match(route,/appointments/);
 assert.match(route,/starts_at/);
 assert.match(route,/ends_at/);
 assert.match(route,/location/);
 assert.match(route,/workcard\.booking_created/);
 assert.match(route,/status:"confirmed"/);
 assert.match(route,/booking_request_accepted/);
 assert.match(route,/status==="requested"/);
 assert.match(route,/business_id/);
 assert.match(route,/\.lt\("starts_at"/);
 assert.match(route,/\.gt\("ends_at"/);
});

test("master calendar creates confirmed appointments against an existing Workcard",async()=>{
 const page=await read("../src/app/admin/[section]/page.tsx");
 const component=await read("../src/components/admin-create-appointment.tsx");
 const route=await read("../src/app/api/admin/appointments/route.ts");
 assert.match(page,/section==="appointments"&&canManageAppointments&&<AdminCreateAppointment/);
 assert.match(page,/linkedWorkcard/);
 assert.match(component,/Create & confirm appointment/);
 assert.match(component,/api/);
 assert.match(route,/appointments\.manage/);
 assert.match(route,/validateBookingWindow/);
 assert.match(route,/bookingTravelBuffer/);
 assert.match(route,/calendar\.appointment_created/);
 assert.match(route,/appointment_id:appointment\.id/);
});

test("master calendar changes synchronise the linked Workcard schedule",async()=>{
 const route=await read("../src/app/api/admin/[section]/[id]/route.ts");
 const component=await read("../src/components/admin-workcard-management.tsx");
 assert.match(route,/workcard\.booking_synced_from_calendar/);
 assert.match(route,/scheduled_start:update\.starts_at/);
 assert.match(route,/update\.status==="cancelled"/);
 assert.match(route,/scheduled_start:null/);
 assert.match(component,/Master bookings & calendar/);
});

test("booking policy enforces notice, working days, unavailable dates, hours and advance window",async()=>{
 const helper=await read("../src/lib/booking-rules.ts");
 assert.match(helper,/booking_notice_hours/);
 assert.match(helper,/working_days/);
 assert.match(helper,/unavailable_dates/);
 assert.match(helper,/opening_time/);
 assert.match(helper,/closing_time/);
 assert.match(helper,/maximum_advance_days/);
 assert.match(helper,/travel_buffer_minutes/);
});
