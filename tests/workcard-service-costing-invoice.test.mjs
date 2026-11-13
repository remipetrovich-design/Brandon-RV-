import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("Workcard editor exposes detailed actual-work entries and service presets",async()=>{
 const ui=await read("../src/components/admin-workcard-management.tsx");
 const api=await read("../src/app/api/admin/jobs/[id]/work-entries/route.ts");
 assert.match(ui,/work-entries/);
 assert.match(ui,/service_id/);
 assert.match(ui,/quantity_used/);
 assert.match(ui,/cost_unit_price/);
 assert.match(api,/jobs\.manage/);
 assert.match(api,/services/);
});

test("final invoice is calculated from actual Workcard entries, never the estimate quote",async()=>{
 const api=await read("../src/app/api/admin/invoices/route.ts");
 assert.match(api,/job_work_entries/);
 assert.match(api,/invoiceable/);
 assert.doesNotMatch(api,/quote\.quote_items/);
 assert.doesNotMatch(api,/Number\(quote\.subtotal\)/);
});

test("quote creation links catalogue services and retains custom-priced lines",async()=>{
 const ui=await read("../src/components/admin-create-quote.tsx");
 const api=await read("../src/app/api/admin/quotes/route.ts");
 assert.match(ui,/serviceId/);
 assert.match(ui,/Custom service/);
 assert.match(api,/service_id/);
 assert.match(api,/services/);
});
