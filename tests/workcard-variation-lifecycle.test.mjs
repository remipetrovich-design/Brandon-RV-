import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const source=path=>readFile(new URL(path,import.meta.url),"utf8");

test("guest quote portal exposes only standard quotes and enquiry messages",async()=>{
 const route=await source("../src/app/api/tickets/[id]/quote-response/route.ts");
 const ui=await source("../src/components/guest-request-workspace.tsx");
 const page=await source("../src/app/request-status/page.tsx");
 const messages=await source("../src/app/api/tickets/[id]/messages/route.ts");
 assert.match(route,/eq\("quote_kind","standard"\)/);
 assert.match(route,/Guest access is limited to standard quotes/);
 assert.doesNotMatch(route,/appointments/);
 assert.doesNotMatch(ui,/CustomerWorkApproval|booking-request|variation|workOrder/);
 assert.match(ui,/TicketConversation/);
 assert.match(page,/Review and respond to quotes, or message Brandon RV/);
 assert.match(messages,/public_enquiry.*general_enquiry.*customer_enquiry.*quote_request/);
});

test("guest booking and Workcard endpoints are denied server-side",async()=>{
 const booking=await source("../src/app/api/tickets/[id]/booking-request/route.ts");
 const workOrder=await source("../src/app/api/tickets/[id]/work-order/route.ts");
 assert.match(booking,/return jsonError\("Guest access is limited to quote responses and general enquiry messages/);
 assert.match(workOrder,/return jsonError\("Guest access is limited to quote responses and general enquiry messages/);
});

test("guest quote acceptance retains enquiry access but only accepts standard quotes",async()=>{
 const migration=await source("../supabase/migrations/20261112113000_limit_guest_access_to_quotes_and_enquiries.sql");
 assert.match(migration,/quote_kind='standard'/);
 assert.match(migration,/guest_access_token_hash=CASE WHEN p_response='declined' THEN NULL ELSE guest_access_token_hash END/);
 assert.match(migration,/guest_scope','quote_and_general_enquiry_only'/);
 assert.match(migration,/DROP FUNCTION IF EXISTS public\.respond_to_guest_job_variation/);
});

test("Workcard variations require a linked customer account",async()=>{
 const route=await source("../src/app/api/admin/jobs/[id]/variations/route.ts");
 assert.match(route,/!job\.user_id/);
 assert.match(route,/Workcard variations require a linked customer account/);
 assert.match(route,/\.not\("user_id","is",null\)/);
});

test("registered customers retain the dedicated variation lifecycle",async()=>{
 const route=await source("../src/app/api/portal/quotes/respond/route.ts");
 const migration=await source("../supabase/migrations/20261112110759_workcard_quote_variations.sql");
 const page=await source("../src/app/portal/jobcards/[id]/page.tsx");
 assert.match(route,/respond_to_job_variation/);
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.respond_to_job_variation/);
 assert.match(migration,/job_work_entries/);
 assert.match(page,/notice==="variation_declined"/);
});
