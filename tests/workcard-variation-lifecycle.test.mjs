import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const source=path=>readFile(new URL(path,import.meta.url),"utf8");

test("guest variation decisions never close the original Jobcard",async()=>{
 const route=await source("../src/app/api/tickets/[id]/quote-response/route.ts");
 const migration=await source("../supabase/migrations/20261112112401_guest_workcard_variation_decisions.sql");
 const ui=await source("../src/components/guest-request-workspace.tsx");
 assert.match(route,/respond_to_guest_job_variation/);
 assert.match(route,/quote_kind/);
 assert.match(migration,/quote_kind='variation'/);
 assert.match(migration,/guest_access_token_hash=p_guest_token_hash/);
 assert.match(migration,/archived_at IS NULL/);
 assert.doesNotMatch(migration,/UPDATE public\.enquiries/);
 assert.match(ui,/q\.quote_kind==="variation"\?"Decline variation"/);
 assert.match(ui,/selected\?\.quote_kind!=="variation"/);
 assert.match(ui,/q\.quote_kind!=="variation"&&!appointments/);
});

test("account variation decisions use their dedicated lifecycle and preserve the Jobcard",async()=>{
 const route=await source("../src/app/api/portal/quotes/respond/route.ts");
 const migration=await source("../supabase/migrations/20261112110759_workcard_quote_variations.sql");
 const page=await source("../src/app/portal/jobcards/[id]/page.tsx");
 assert.match(route,/respond_to_job_variation/);
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.respond_to_job_variation/);
 assert.match(migration,/job_work_entries/);
 assert.match(page,/q\.quote_kind==="variation"\?"Decline variation"/);
 assert.match(page,/notice==="variation_declined"/);
});

test("guest and account quote histories identify variation scope and price",async()=>{
 const guest=await source("../src/components/guest-request-workspace.tsx");
 const account=await source("../src/app/portal/quotes/page.tsx");
 assert.match(guest,/variation_reason/);
 assert.match(guest,/Approve additional work/);
 assert.match(account,/WORKCARD VARIATION/);
 assert.match(account,/Reason for additional work/);
});

test("guest variation approval is a service-only atomic database operation",async()=>{
 const migration=await source("../supabase/migrations/20261112112401_guest_workcard_variation_decisions.sql");
 assert.match(migration,/FOR UPDATE/);
 assert.match(migration,/ON CONFLICT\(source_quote_item_id\)/);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.respond_to_guest_job_variation/);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.respond_to_guest_job_variation.*TO service_role/);
});
