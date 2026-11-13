import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("guest Quote Requests get a customer record before quote insert",async()=>{
 const route=await read("../src/app/api/admin/quotes/route.ts");
 const schema=await read("../supabase/migrations/20261105113948_brandon_rv_core_portal_and_website.sql");
 assert.match(schema,/customer_id uuid not null references public\.customers\(id\)/);
 assert.match(route,/let customerId=enquiry\.customer_id\?\?null/);
 assert.match(route,/from\("customers"\)\.insert\(/);
 assert.match(route,/customer_id:customerId/);
 assert.match(route,/update\(\{customer_id:customerId/);
});

test("staff Workcards are available on a dedicated page, not embedded in overview",async()=>{
 const page=await read("../src/app/admin/my-workcards/page.tsx");
 const staffHome=await read("../src/app/staff/page.tsx");
 const dashboard=await read("../src/app/admin/page.tsx");
 const layout=await read("../src/app/admin/layout.tsx");
 assert.match(page,/StaffWorkOrders/);
 assert.match(page,/\/api\/staff|WORKER PANEL|My/);
 assert.match(staffHome,/\/admin\/my-workcards/);
 assert.doesNotMatch(dashboard,/StaffWorkOrders/);
 assert.match(layout,/\/admin\/my-workcards/);
});


test("admin quote register disambiguates both quote-to-Workcard foreign keys",async()=>{
 const page=await read("../src/app/admin/[section]/page.tsx");
 assert.match(page,/jobs!quotes_job_id_fkey/);
 assert.match(page,/quotes!jobs_quote_id_fkey/);
 assert.match(page,/row\.jobs\?\.id/);
});

test("Jobcard Quote tab exposes quote and linked Workcard management controls",async()=>{
 const editor=await read("../src/components/admin-enquiry-editor.tsx");
 assert.match(editor,/import AdminQuoteManagement/);
 assert.match(editor,/import AdminWorkcardManagement/);
 assert.match(editor,/AdminQuoteManagement quoteId=\{q\.id\}/);
 assert.match(editor,/AdminWorkcardManagement jobId=\{workcard\.id\}/);
});

test("quote-specific PATCH route retains atomic issue and customer email behavior",async()=>{
 const route=await read("../src/app/api/admin/quotes/[id]/route.ts");
 assert.match(route,/issue_quote_for_jobcard/);
 assert.match(route,/Your Brandon RV quote/);
 assert.match(route,/sendEmail/);
});
