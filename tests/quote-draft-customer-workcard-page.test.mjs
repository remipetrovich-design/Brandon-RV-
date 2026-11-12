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
