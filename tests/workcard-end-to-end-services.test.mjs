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
 assert.ok(route.includes('update({stage:"converted",status:"converted"'),"The original Jobcard must record its conversion to a Workcard.");
 assert.ok(route.includes("enquiry_stage_history"),"The Jobcard conversion must be recorded in its stage history.");
 assert.ok(route.includes("quantity_required:Number(item.quantity)"),"Required quantities must be carried into the Workcard.");
 assert.ok(route.includes("quantity_used:0"),"Planned quantities must not be mistaken for actual usage.");
 assert.ok(route.includes("invoiceable:false"),"Prepared quote lines must not be invoiced before actual work is recorded.");
 assert.ok(route.includes("if(entryError)"),"Failed conversion must roll back the new Workcard.");
});

test("staff Workcard API returns prepared quote lines and supports recording actual quantities, costs and parts orders",async()=>{
 const list=await read("../src/app/api/staff/jobs/route.ts");
 const entries=await read("../src/app/api/staff/jobs/[id]/work-entries/route.ts");
 for(const field of ["source_quote_item_id","quantity_required","quantity_used","quantity_ordered","quantity_received","quantity_returned","part_order_status","supplier_order_reference","cost_unit_price","part_number","supplier_name","invoiceable"])assert.ok(list.includes(field),"Missing prepared Workcard field: "+field);
 assert.ok(list.includes("const firstRelation="),"Nested Supabase relations must be normalised to single records before returning Workcards.");
 assert.ok(list.includes("firstRelation(x.quotes)"),"The quote relationship must be returned as one quote record.");
 assert.ok(list.includes("firstRelation(quote?.enquiries)"),"The original Jobcard relationship must be returned as one Jobcard record.");
 assert.ok(list.includes("firstRelation(enquiry.vehicles)"),"The Jobcard vehicle relationship must be returned as one vehicle record.");
 assert.ok(list.includes("firstRelation(x.vehicles)"),"The appointment vehicle relationship must be returned as one vehicle record.");
 assert.ok(entries.includes("export async function PATCH"),"Workers must update prepared lines instead of re-entering them.");
 for(const field of ["quantity_required","quantity_used","cost_unit_price","supplier_name","part_number","invoiceable"])assert.ok(entries.includes(field),"Missing worker update field: "+field);
 assert.ok(entries.includes("work_order.entry_updated"),"Worker changes must be audited.");
 assert.ok(entries.includes('["pending","scheduled","waiting_parts","in_progress"].includes(access.job.status)'),"Workers must be able to update supplier orders before starting the repair.");
 assert.ok(entries.includes("Actual work, costs and customer-visible completion details can only be recorded after work starts."),"Pre-start updates must be limited to parts ordering.");
});

test("Workcard part-order fields preserve ordered, received and outstanding quantities",async()=>{
 const migration=await read("../supabase/migrations/20261114100000_jobcard_workcard_roundtrip.sql");
 for(const field of ["quantity_ordered","quantity_received","quantity_returned","part_order_status","supplier_order_reference","ordered_at","expected_at","received_at"])assert.ok(migration.includes(field),"Missing part-order field: "+field);
 assert.ok(migration.includes("quantity_received <= quantity_ordered"),"Received quantity must not exceed ordered quantity.");
 assert.ok(migration.includes("quantity_returned <= quantity_received"),"Returned quantity must not exceed received quantity.");
 assert.ok(migration.includes("INSERT INTO public.job_work_entries"),"Existing Workcards must be backfilled from their accepted quote lines.");
 assert.ok(migration.includes("Existing customer Jobcards remain the master record"),"Existing Jobcards must remain the customer-facing master record.");
});

test("worker Workcard displays prepared scope and parts, then records actual completion details",async()=>{
 const ui=await read("../src/components/staff-work-orders.tsx");
 for(const token of ["quantity_required","quantity_used","cost_unit_price","part_number","supplier_name","invoiceable","Save prepared item","Save parts order","Parts required before starting","Work completed summary","Submit Workcard & sign off"])assert.ok(ui.includes(token),"Missing worker Workcard field or workflow: "+token);
});

test("Parts needed exposes independent add, edit, update and delete controls with research fields",async()=>{
 const ui=await read("../src/components/admin-workcard-management.tsx");
 for(const token of ["Add part","Edit part","Remove part","addEntry()","editEntry(entry)","removeEntry(x.id)","quantity_required","quantity_used","part_number","supplier_name","cost_unit_price","entries.filter(x=>x.entry_type===\"parts\")"])assert.ok(ui.includes(token),"Missing Parts needed control, independent-source filter or field: "+token);
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


test("worker sign-off creates charges only from actual invoiceable usage, never planned quote quantities",async()=>{
 const route=await read("../src/app/api/staff/jobs/[id]/status/route.ts");
 assert.ok(route.includes('x.invoiceable&&Number(x.quantity_used)>0'),"Only actual, invoiceable use can be billed.");
 assert.ok(route.includes("quantity:Number(x.quantity_used)"),"Invoice quantities must use actual usage.");
 assert.ok(!route.includes("if(!items.length&&job.quote_id)"),"The accepted quote must never be used as a fallback invoice.");
 assert.ok(route.includes("Planned quote quantities are never substituted"),"The intended separation must remain explicit.");
});

test("worker completion data is returned on the original customer Jobcard",async()=>{
 const page=await read("../src/app/portal/jobcards/[id]/page.tsx");
 assert.ok(page.includes('in("quote_id",quoteIds)'),"The original Jobcard must load its linked Workcard.");
 assert.ok(page.includes("work_summary"),"The worker completion summary must return to the Jobcard.");
 assert.ok(page.includes('eq("customer_visible",true)'),"Only customer-visible completed work may be shown.");
 assert.ok(page.includes("CustomerWorkApproval"),"The customer Jobcard must expose the review and handover step.");
});


test("worker Workcard includes the original Jobcard description, contact context and submitted files",async()=>{
 const route=await read("../src/app/api/staff/jobs/route.ts");
 const ui=await read("../src/components/staff-work-orders.tsx");
 for(const field of ["requested_service","description","location","contact_name","enquiry_attachments","createSignedUrl"])assert.ok(route.includes(field),"Missing original Jobcard context: "+field);
 for(const token of ["ORIGINAL JOBCARD REQUEST","jobcardAttachments","Original customer Jobcard attachment"])assert.ok(ui.includes(token),"Missing original Jobcard details on worker Workcard: "+token);
});


test("workers cannot change accepted quantities or customer prices outside an approved variation",async()=>{
 const route=await read("../src/app/api/staff/jobs/[id]/work-entries/route.ts");
 assert.ok(route.includes("const quantityRequired=Number(current.quantity_required)"),"Approved quantities must remain fixed.");
 assert.ok(route.includes("const unitPrice=Number(current.unit_price)"),"Customer prices must remain fixed to the approved quote.");
 assert.ok(route.includes("Actual use exceeds the approved quantity"),"Extra quantity requires an approved variation.");
 assert.ok(route.includes("Only items from an accepted quote or approved variation can be marked invoiceable"),"Unapproved worker-added lines cannot be invoiced.");
 assert.ok(route.includes("quantityUsed>quantityReceived-quantityReturned"),"Workers cannot record use beyond parts actually received and retained.");
});
