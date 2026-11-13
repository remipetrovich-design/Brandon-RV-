import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const source=path=>readFile(new URL(path,import.meta.url),"utf8");

test("authorised staff can approve quotes and completed Workcards they prepared or signed off",async()=>{
 const migration=await source("../supabase/migrations/20261114133311_allow_self_approval_for_authorised_staff.sql");
 const quoteRoute=await source("../src/app/api/admin/quotes/[id]/approval/route.ts");
 const workcardRoute=await source("../src/app/api/admin/jobs/[id]/approval/route.ts");
 const workcardUi=await source("../src/components/admin-job-tools.tsx");
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.review_quote/);
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.review_workcard/);
 assert.doesNotMatch(migration,/prepared_by\s*=\s*p_actor_user_id/);
 assert.doesNotMatch(migration,/worker_signed_off_by\s*=\s*p_actor_user_id/);
 assert.match(quoteRoute,/authorizePermission\("quotes\.approve"\)/);
 assert.match(workcardRoute,/authorizePermission\("jobs\.manage"\)/);
 assert.doesNotMatch(workcardUi,/cannot approve their own work/);
 assert.match(workcardUi,/Approve Workcard/);
});

test("Workcard setup review remains available to authorised managers without a creator restriction",async()=>{
 const migration=await source("../supabase/migrations/20261112111146_workcard_setup_review_rpc.sql");
 const route=await source("../src/app/api/admin/jobs/[id]/workcard-review/route.ts");
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.review_workcard_setup/);
 assert.doesNotMatch(migration,/created_by|prepared_by|reviewed_by\s*=\s*p_actor_user_id/);
 assert.match(route,/authorizePermission\("jobs\.manage"\)/);
});
