import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("database migration supplies every field used by service-linked Workcard entries",async()=>{
 const migration=await read("../supabase/migrations/20261113010000_connect_services_and_workcard_actual_costs.sql");
 for(const field of ["quantity_required","quantity_used","cost_unit_price","part_number","supplier_name","invoiceable","service_id"])assert.match(migration,new RegExp("add column if not exists "+field));
 assert.match(migration,/quote_items[\\s\\S]*add column if not exists service_id/);
 assert.match(migration,/job_work_entries_service_id_idx/);
});

test("Workcard management endpoint returns complete job context and service-linked actual entries",async()=>{
 const route=await read("../src/app/api/admin/jobs/[id]/work-entries/route.ts");
 assert.match(route,/quantity_required,quantity_used,unit_price,cost_unit_price/);
 assert.match(route,/services\\(name\\)/);
 assert.match(route,/customers\\(full_name,email,phone\\)/);
 assert.match(route,/quotes!jobs_quote_id_fkey/);
 assert.match(route,/appointments\\(status,starts_at,ends_at,location/);
});

test("accepted quote creates planned Workcard lines without treating the estimate as actual invoice charges",async()=>{
 const route=await read("../src/app/api/admin/jobs/route.ts");
 assert.match(route,/quote_items\\(id,description,quantity,unit_price,tax_rate,item_type,service_id\\)/);
 assert.match(route,/quantity_required:Number\\(item\\.quantity/);
 assert.match(route,/quantity_used:0/);
 assert.match(route,/invoiceable:false/);
 assert.match(route,/source_quote_item_id:item\\.id/);
});

test("Workcard UI supports service presets, custom entries, required versus used quantities, and actual costs",async()=>{
 const ui=await read("../src/components/admin-workcard-management.tsx");
 for(const token of ["Custom entry","quantity_required","quantity_used","cost_unit_price","unit_price","part_number","supplier_name","invoiceable","Service preset","Retry loading Workcard","Vehicle","Original estimate"])assert.ok(ui.includes(token),"Missing Workcard UI feature: "+token);
});

test("quote creation and revision editing both preserve service links and custom pricing",async()=>{
 const create=await read("../src/components/admin-create-quote.tsx");
 const edit=await read("../src/components/admin-quote-management.tsx");
 const api=await read("../src/app/api/admin/quotes/route.ts");
 const detail=await read("../src/app/api/admin/quotes/[id]/route.ts");
 assert.match(create,/Service preset/);
 assert.match(create,/Custom service/);
 assert.match(create,/unitPrice/);
 assert.match(edit,/service_id/);
 assert.match(edit,/item_type/);
 assert.match(edit,/Custom line/);
 assert.match(edit,/serviceId:x\\.service_id/);
 assert.match(api,/service_id:item\\.serviceId/);
 assert.match(detail,/service_id/);
});

test("final invoice uses actual Workcard entries, never the original quote total",async()=>{
 const invoice=await read("../src/app/api/admin/invoices/route.ts");
 assert.match(invoice,/from\\("job_work_entries"\\)/);
 assert.match(invoice,/eq\\("invoiceable",true\\)/);
 assert.match(invoice,/quantity_used/);
 assert.match(invoice,/invoice\\.created_from_actual_work/);
 assert.doesNotMatch(invoice,/quote\\.subtotal/);
 assert.doesNotMatch(invoice,/quote\\.total/);
});
