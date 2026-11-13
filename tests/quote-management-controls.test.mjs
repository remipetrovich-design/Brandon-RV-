import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("admin quote register exists and exposes quote management and accepted-quote conversion",async()=>{
 const page=await read("../src/app/admin/quotes/page.tsx");
 const manager=await read("../src/components/admin-quotes-manager.tsx");
 assert.match(page,/quotes\.view/);
 assert.match(manager,/AdminQuoteTools/);
 assert.match(manager,/AdminCreateJob/);
 assert.match(manager,/q\.status==="accepted"/);
});

test("quote management API supports editing and deleting with dependent-record protection",async()=>{
 const route=await read("../src/app/api/admin/quotes/[id]/manage/route.ts");
 assert.match(route,/export async function GET/);
 assert.match(route,/export async function PATCH/);
 assert.match(route,/export async function DELETE/);
 assert.match(route,/authorizePermission\("quotes\.manage"\)/);
 assert.match(route,/senior_approval_status:"pending"/);
 assert.match(route,/from\("jobs"\).*quote_id/s);
 assert.match(route,/from\("appointments"\).*quote_id/s);
 assert.match(route,/from\("invoices"\).*quote_id/s);
});

test("quote controls expose edit and delete while retaining approval and issue workflow",async()=>{
 const tools=await read("../src/components/admin-quote-tools.tsx");
 assert.match(tools,/Edit quote/);
 assert.match(tools,/Delete quote/);
 assert.match(tools,/Approve quote/);
 assert.match(tools,/Issue quote to customer/);
});
