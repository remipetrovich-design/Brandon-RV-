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

test("Workcard section menu renders as compact horizontal folder tabs, not stacked buttons",async()=>{
 const ui=await read("../src/components/admin-workcard-management.tsx");
 const css=await read("../src/app/globals.css");
 assert.ok(ui.includes('className="brv-workcard-tabs"'),"Workcard sections need a dedicated tab strip.");
 assert.ok(ui.includes('className={activeTab===id?"brv-workcard-tab active":"brv-workcard-tab"}'),"Tabs must use their dedicated compact style rather than full-size generic buttons.");
 assert.ok(ui.includes("aria-pressed={activeTab===id}"),"The active section must be exposed accessibly.");
 assert.ok(css.includes(".brv-workcard-tabs")&&css.includes("flex-wrap:nowrap!important"),"Tabs must stay in one horizontal row.");
 assert.ok(css.includes("overflow-x:auto"),"The tab row must scroll horizontally on narrow screens.");
 assert.ok(css.includes("border-radius:8px 8px 0 0!important"),"Tabs must have folder-like top corners.");
 assert.ok(css.includes("width:auto!important"),"Tabs must not expand to full-width stacked buttons.");
});

test("Workcard management endpoint returns complete job context and service-linked actual entries",async()=>{
 const route=await read("../src/app/api/admin/jobs/[id]/work-entries/route.ts");
 for(const field of ["quantity_required","quantity_used","unit_price","cost_unit_price","services:services!job_work_entries_service_id_fkey(name)","customers:users!jobs_customer_id_users_fkey(full_name,email,phone)","from(\"quotes\")","from(\"appointments\")","from(\"services\")","from(\"job_work_entries\")"])assert.ok(route.includes(field),"Missing Workcard API field/query: "+field);
});

test("accepted quote converts the Jobcard into a pre-populated Workcard without losing approved line detail",async()=>{
 const route=await read("../src/app/api/admin/jobs/route.ts");
 assert.ok(route.includes("quote_items(id,description,quantity,unit_price,tax_rate,item_type,service_id)"),"Original quote lines must be loaded for conversion.");
 assert.ok(route.includes("const scope=String(body.scope??defaultScope)"),"The approved scope remains attached to the Workcard.");
 assert.ok(route.includes("const plannedEntries="),"Accepted quote lines must become prepared Workcard entries.");
 assert.ok(route.includes("source_quote_item_id:item.id"),"Each prepared line must retain its source quote line.");
 assert.ok(route.includes("quantity_required:Number(item.quantity)"),"Required quantities must be carried into the Workcard.");
 assert.ok(route.includes("quantity_used:0"),"Planned quantities must not be mistaken for actual usage.");
 assert.ok(route.includes("invoiceable:false"),"Prepared quote lines must not be invoiced before actual work is recorded.");
 assert.ok(route.includes("if(entryError)"),"Failed conversion must roll back the new Workcard.");
});

test("staff Workcard API returns prepared quote lines and supports recording actual quantities, costs and parts orders",async()=>{
 const list=await read("../src/app/api/staff/jobs/route.ts");
 const entries=await read("../src/app/api/staff/jobs/[id]/work-entries/route.ts");
 for(const field of ["source_quote_item_id","quantity_required","quantity_used","cost_unit_price","part_number","supplier_name","invoiceable"])assert.ok(list.includes(field),"Missing prepared Workcard field: "+field);
 assert.ok(entries.includes("export async function PATCH"),"Workers must update prepared lines instead of re-entering them.");
 for(const field of ["quantity_required","quantity_used","cost_unit_price","supplier_name","part_number","invoiceable"])assert.ok(entries.includes(field),"Missing worker update field: "+field);
 assert.ok(entries.includes("work_order.entry_updated"),"Worker changes must be audited.");
});

test("worker Workcard displays prepared scope and parts, then records actual completion details",async()=>{
 const ui=await read("../src/components/staff-work-orders.tsx");
 for(const token of ["quantity_required","quantity_used","cost_unit_price","part_number","supplier_name","invoiceable","Update prepared item","Parts required before starting","Work completed summary","Submit Workcard & sign off"])assert.ok(ui.includes(token),"Missing worker Workcard field or workflow: "+token);
});

test("Parts needed exposes independent add, edit, update and delete controls with research fields",async()=>{
 const ui=await read("../src/components/admin-workcard-management.tsx");
 for(const token of ["Add part","Edit part","Remove part","addEntry()","editEntry(entry)","removeEntry(x.id)","quantity_required","quantity_used","part_number","supplier_name","cost_unit_price","!x.source_quote_item_id"])assert.ok(ui.includes(token),"Missing Parts needed control, independent-source filter or field: "+token);
 const entriesApi=await read("../src/app/api/admin/jobs/[id]/work-entries/route.ts");
 assert.ok(entriesApi.includes("id,source_quote_item_id,entry_type"),"The Parts needed view must be able to distinguish quote-linked lines.");
});

test("Workcard part deletion is scoped to its Workcard and recorded in the audit history",async()=>{
 const route=await read("../src/app/api/admin/jobs/[id]/work-entries/route.ts");
 assert.ok(route.includes('.delete().eq("id",entryId).eq("job_id",id).eq("business_id",businessId)'),"Entry deletion must be scoped to the active business and Workcard.");
 assert.ok(route.includes('action:"workcard.entry_deleted"'),"Entry deletions must be audited.");
 assert.ok(route.includes('if(!deletedEntry)return jsonError("Workcard entry not found.",404)'),"Deleting a missing entry must not report success.");
});

test("Admin Workcards list uses a compact summary and preserves manage permissions",async()=>{
 const page=await read("../src/app/admin/[section]/page.tsx");
 assert.ok(page.includes('className="brv-admin-workcard-link"'),"Workcard rows should use the compact Jobcard-style summary.");
 assert.ok(page.includes('section==="jobs"?canManageJobs?'),"Only staff with Workcard management permission should receive the open link.");
 assert.ok(!page.includes("Setup review:"),"The list should not expand internal review details into every row.");
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
