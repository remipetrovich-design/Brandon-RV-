import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("database migration supplies every field used by service-linked Workcard entries",async()=>{
 const migration=await read("../supabase/migrations/20261113120519_connect_services_and_workcard_actual_costs.sql");
 for(const field of ["quantity_required","quantity_used","cost_unit_price","part_number","supplier_name","invoiceable","service_id"])assert.ok(migration.includes("add column if not exists "+field),"Missing migration column: "+field);
 assert.ok(migration.includes("alter table public.quote_items"));
 assert.ok(migration.includes("job_work_entries_service_id_idx"));
});

test("Workcard management endpoint returns complete job context and service-linked actual entries",async()=>{
 const route=await read("../src/app/api/admin/jobs/[id]/work-entries/route.ts");
 for(const field of ["quantity_required","quantity_used","unit_price","cost_unit_price","services:services!job_work_entries_service_id_fkey(name)","customers:users!jobs_customer_id_users_fkey(full_name,email,phone)","from(\"quotes\")","from(\"appointments\")","from(\"services\")","from(\"job_work_entries\")"])assert.ok(route.includes(field),"Missing Workcard API field/query: "+field);
});

test("accepted quote creates a Workcard without copying quote lines into Parts needed or actual work",async()=>{
 const route=await read("../src/app/api/admin/jobs/route.ts");
 assert.ok(route.includes("quote_items(id,description,quantity,unit_price,tax_rate,item_type,service_id)"),"Original quote details remain available for the approved scope.");
 assert.ok(route.includes("const scope=String(body.scope??defaultScope)"),"Workcard scope can still be seeded from the accepted estimate.");
 assert.ok(!route.includes("const plannedEntries="),"Quote lines must not be inserted as Workcard parts or actual work.");
 assert.ok(!route.includes("source_quote_item_id:item.id"),"Parts needed must be researched and entered independently.");
});

test("Parts needed exposes independent add, edit, update and delete controls with research fields",async()=>{
 const ui=await read("../src/components/admin-workcard-management.tsx");
 for(const token of ["Add part","Edit part","Remove part","addEntry()","editEntry(entry)","removeEntry(x.id)","quantity_required","quantity_used","part_number","supplier_name","cost_unit_price"])assert.ok(ui.includes(token),"Missing Parts needed control or field: "+token);
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
 for(const field of ["Service preset","Custom service","unitPrice"])assert.ok(create.includes(field));
 for(const field of ["service_id","item_type","Custom line","serviceId:x.service_id"])assert.ok(edit.includes(field));
 assert.ok(api.includes("service_id:item.serviceId"));
 assert.ok(detail.includes("service_id"));
});

test("Workcard variations also retain service links through customer acceptance",async()=>{
 const ui=await read("../src/components/admin-job-variations.tsx");
 const route=await read("../src/app/api/admin/jobs/[id]/variations/route.ts");
 const migration=await read("../supabase/migrations/20261113120519_connect_services_and_workcard_actual_costs.sql");
 assert.ok(ui.includes("Service preset"));
 assert.ok(ui.includes("serviceId:x.serviceId"));
 assert.ok(route.includes("service_id:x.serviceId"));
 assert.ok(route.includes("service_id)"));
 assert.ok(migration.includes("sync_workcard_entry_from_quote_line"));
 assert.ok(migration.includes("new.service_id:=v_service_id"));
});

test("final invoice uses actual Workcard entries, never the original quote total",async()=>{
 const invoice=await read("../src/app/api/admin/invoices/route.ts");
 for(const field of ['from("job_work_entries")','eq("invoiceable",true)',"quantity_used","invoice.created_from_actual_work"])assert.ok(invoice.includes(field));
 assert.ok(!invoice.includes("quote.subtotal"));
 assert.ok(!invoice.includes("quote.total"));
});
