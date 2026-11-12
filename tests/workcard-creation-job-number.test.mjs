import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("accepted-quote Workcard creation supplies the required unique job number",async()=>{
  const route=await source("../src/app/api/admin/jobs/route.ts");
  const schema=await source("../supabase/migrations/20261105113948_brandon_rv_core_portal_and_website.sql");
  const uniqueness=await source("../supabase/migrations/20261112105152_workcard_booking_uniqueness.sql");
  assert.match(schema,/job_number text not null,/);
  assert.match(uniqueness,/jobs_one_workcard_per_quote_idx/);
  assert.match(route,/const jobNumber="BRV-WC-"/);
  assert.match(route,/job_number:jobNumber/);
  assert.match(route,/if\(error\?\.code==="23505"\)/);
});

test("Workcard creation logs the underlying database failure without exposing it to the client",async()=>{
  const route=await source("../src/app/api/admin/jobs/route.ts");
  assert.match(route,/console\.error\("Workcard insert failed",error\)/);
  assert.match(route,/console\.error\("Workcard creation failed",error\)/);
  assert.match(route,/return jsonError\("Could not create Workcard\.",500\)/);
});
