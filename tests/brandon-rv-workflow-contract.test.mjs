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
