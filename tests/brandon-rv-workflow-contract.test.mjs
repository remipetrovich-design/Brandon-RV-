import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("Request a Quote is not a second General Enquiry form",async()=>{
 const form=await source("../src/components/enquiry-form.tsx");
 assert.match(form,/requestType","quote_request"/);
 assert.doesNotMatch(form,/setMode|mode==="conversation"|Start a conversation \/ general enquiry|General question/);
 assert.match(form,/name="vehicleMake"/);
 assert.match(form,/name="vehicleModel"/);
 assert.match(form,/name="registration"/);
 assert.match(form,/name="vin"/);
 assert.match(form,/name="preferredDate"/);
 assert.match(form,/name="accessDetails"/);
});

test("account and guest quote responses use atomic database transactions",async()=>{
 const account=await source("../src/app/api/portal/quotes/respond/route.ts");
 const guest=await source("../src/app/api/tickets/[id]/quote-response/route.ts");
 const accountMigration=await source("../supabase/migrations/20261111100000_atomic_customer_quote_response.sql");
 const guestMigration=await source("../supabase/migrations/20261111110000_atomic_guest_quote_response.sql");
 assert.match(account,/respond_to_customer_quote/);
 assert.match(guest,/respond_to_guest_quote/);
 for(const migration of [accountMigration,guestMigration]){
  assert.match(migration,/FOR UPDATE/);
  assert.match(migration,/archived_at = CASE WHEN p_response = 'declined'/);
  assert.match(migration,/guest_access_token_hash = CASE WHEN p_response = 'declined' THEN NULL/);
  assert.match(migration,/enquiry_stage_history/);
  assert.match(migration,/customer_messages/);
  assert.match(migration,/audit_events/);
 }
 assert.match(accountMigration,/v_quote\.customer_id, p_user_id/);
 assert.match(accountMigration,/request_type <> 'quote_request'/);
});

test("declined Jobcards are excluded from active enquiry queues but remain filterable",async()=>{
 const api=await source("../src/app/api/admin/enquiries/route.ts");
 assert.match(api,/stage==="archived"/);
 assert.match(api,/query\.not\("archived_at","is",null\)/);
 assert.match(api,/query\.is\("archived_at",null\)/);
});

test("a Workcard can only be created from an accepted quote and confirmed booking",async()=>{
 const api=await source("../src/app/api/admin/jobs/route.ts");
 assert.match(api,/eq\("status","confirmed"\)/);
 assert.match(api,/eq\("status","accepted"\)/);
 assert.match(api,/Only a complete confirmed booking can create a Work Order/);
});

test("general enquiries never expose the ticket reply composer",async()=>{
 const page=await source("../src/app/admin/enquiries/[id]/page.tsx");
 assert.match(page,/\["customer_enquiry","quote_request"\]\.includes\(item\.request_type\)/);
 assert.match(page,/General enquiries are handled by phone or email/);
});

test("quotes can only be prepared for active Quote Request Jobcards",async()=>{
 const api=await source("../src/app/api/admin/quotes/route.ts");
 const form=await source("../src/components/admin-create-quote.tsx");
 assert.match(api,/eq\("request_type","quote_request"\)/);
 assert.match(api,/\.is\("archived_at",null\)/);
 assert.match(form,/Quote Request Jobcard/);
 assert.doesNotMatch(form,/No ticket|Select customer|customerId/);
});

test("issuing a quote advances the Jobcard atomically",async()=>{
 const route=await source("../src/app/api/admin/[section]/[id]/route.ts");
 const migration=await source("../supabase/migrations/20261111120000_atomic_quote_issue.sql");
 assert.match(route,/issue_quote_for_jobcard/);
 assert.match(migration,/FOR UPDATE/);
 assert.match(migration,/status = 'sent'/);
 assert.match(migration,/stage = 'quote_sent'/);
 assert.match(migration,/enquiry_stage_history/);
 assert.match(migration,/audit_events/);
});


test("admin cannot reclassify a general enquiry into a quote request",async()=>{
 const api=await source("../src/app/api/admin/enquiries/[id]/route.ts");
 assert.doesNotMatch(api,/const allowed=\[[^\]]*request_type/);
 assert.match(api,/archived_at=before\.archived_at/);
 assert.match(api,/guest_access_token_hash=null/);
});

test("quote issue email resolves the real customer foreign key",async()=>{
 const route=await source("../src/app/api/admin/[section]/[id]/route.ts");
 assert.match(route,/select\("quote_number,total,customer_id,user_id,enquiry_id"\)/);
 assert.match(route,/eq\("id",quoteRecord\.user_id\)/);
 assert.match(route,/from\("customers"\)\.select\("full_name,email"\)/);
});


test("worker completion is separately signed off and cannot bypass senior review",async()=>{
 const worker=await source("../src/app/api/staff/jobs/[id]/status/route.ts");
 const senior=await source("../src/app/api/admin/jobs/[id]/approval/route.ts");
 const migration=await source("../supabase/migrations/20261111130000_workcard_senior_signoff.sql");
 const customer=await source("../src/app/api/portal/jobs/[id]/approval/route.ts");
 assert.match(worker,/worker_signed_off_by:user\.id/);
 assert.match(worker,/senior_approval_status:"pending"/);
 assert.match(senior,/review_workcard/);
 assert.match(migration,/worker_signed_off_at IS NULL/);
 assert.match(migration,/customer_approval_status = 'pending'/);
 assert.match(migration,/status = 'in_progress'/);
 assert.match(customer,/senior_approval_status/);
});

test("staff work entry and completion endpoints require an accepted assignment",async()=>{
 const status=await source("../src/app/api/staff/jobs/[id]/status/route.ts");
 const entries=await source("../src/app/api/staff/jobs/[id]/work-entries/route.ts");
 assert.match(status,/if\(assignment\?\.status!=="accepted"\)/);
 assert.match(entries,/allowed:assignment\?\.status==="accepted"/);
});

test("admin Workcard assignment edits preserve accepted workers",async()=>{
 const api=await source("../src/app/api/admin/jobs/[id]/assign/route.ts");
 assert.match(api,/currentByStaff/);
 assert.match(api,/status:"removed"/);
 assert.match(api,/status:"assigned"/);
 assert.doesNotMatch(api,/from\\("job_assignments"\\)\\.delete\\(\\)/);
});

test("staff Workcard lists expand one detailed record at a time",async()=>{
 const page=await source("../src/components/staff-work-orders.tsx");
 assert.match(page,/expandedId/);
 assert.match(page,/aria-expanded/);
 assert.match(page,/Open Workcard/);
});


test("quote preparation is itemised and requires a different senior reviewer before issue",async()=>{
 const api=await source("../src/app/api/admin/quotes/route.ts");
 const form=await source("../src/components/admin-create-quote.tsx");
 const review=await source("../src/app/api/admin/quotes/[id]/approval/route.ts");
 const issue=await source("../supabase/migrations/20261111140000_quote_senior_review.sql");
 assert.ok(api.includes("items.length<1"));
 assert.ok(api.includes("quote_items"));
 assert.ok(api.includes("prepared_by:access.user!.id"));
 assert.ok(form.includes("Add line item"));
 assert.ok(form.includes("subtotal+tax"));
 assert.ok(review.includes("review_quote"));
 assert.ok(issue.includes("prepared_by = p_actor_user_id"));
 assert.ok(issue.includes("senior_approval_status NOT IN ('approved','legacy_approved')"));
});

test("customer Jobcards aggregate quotes, bookings, Workcards, reports and invoices",async()=>{
 const page=await source("../src/app/portal/jobcards/[id]/page.tsx");
 const list=await source("../src/app/portal/jobcards/page.tsx");
 assert.ok(page.includes('eq("request_type","quote_request")'));
 assert.ok(page.includes("quote_items"));
 assert.ok(page.includes("appointments"));
 assert.ok(page.includes("jobs"));
 assert.ok(page.includes("job_work_entries"));
 assert.ok(page.includes("invoices"));
 assert.ok(page.includes("TicketConversation"));
 assert.ok(list.includes("/portal/jobcards/"));
});

test("legacy Contact routes to a separate General Enquiry page",async()=>{
 const contact=await source("../src/app/contact/page.tsx");
 const general=await source("../src/app/general-enquiry/page.tsx");
 const form=await source("../src/components/general-enquiry-form.tsx");
 assert.ok(contact.includes('redirect("/general-enquiry")'));
 assert.ok(general.includes("GeneralEnquiryForm"));
 assert.ok(form.includes('form.set("requestType","public_enquiry")'));
 assert.ok(form.includes("Request a quote for specific work"));
});

test("customer invoice is hidden until the final Jobcard is approved",async()=>{
 const component=await source("../src/components/customer-work-approval.tsx");
 assert.ok(component.includes('invoice&&approvalStatus==="approved"'));
});


test("Workcard photo evidence is private by default and customer-visible only by choice",async()=>{
 const migration=await source("../supabase/migrations/20261111150000_workcard_photos_and_tests.sql");
 const upload=await source("../src/app/api/staff/jobs/[id]/attachments/route.ts");
 const customer=await source("../src/components/customer-work-approval.tsx");
 assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS public.job_attachments"));
 assert.ok(migration.includes("customer_visible boolean NOT NULL DEFAULT false"));
 assert.ok(upload.includes("file.size>10*1024*1024"));
 assert.ok(upload.includes('customer_visible:customerVisible'));
 assert.ok(customer.includes("attachments.map"));
});

test("guest and account booking requests use one quote and the configured availability rules",async()=>{
 const account=await source("../src/app/api/portal/appointments/route.ts");
 const guest=await source("../src/app/api/tickets/[id]/booking-request/route.ts");
 assert.ok(account.includes("existingBooking"));
 assert.ok(guest.includes("existingBooking"));
 assert.ok(guest.includes("working_days"));
 assert.ok(guest.includes("unavailable_dates"));
 assert.ok(guest.includes("travel_buffer_minutes"));
 assert.ok(guest.includes("appointments"));
});

test("Workcard test/check entries are non-billable",async()=>{
 const route=await source("../src/app/api/staff/jobs/[id]/work-entries/route.ts");
 const helper=await source("../src/lib/work-order-lifecycle.mjs");
 const finish=await source("../src/app/api/staff/jobs/[id]/status/route.ts");
 assert.ok(route.includes('"labour","parts","note","test"'));
 assert.ok(helper.includes('["note", "test"]'));
 assert.ok(finish.includes('!["note","test"].includes(x.entry_type)'));
});
