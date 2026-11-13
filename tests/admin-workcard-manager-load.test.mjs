import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("Workcard manager list resolves customer through the explicit jobs-to-users foreign key",async()=>{
 const page=await read("../src/app/admin/[section]/page.tsx");
 assert.match(page,/customers:users!jobs_customer_id_users_fkey\(full_name,email,phone\)/);
 assert.doesNotMatch(page,/customers\(full_name,email,phone\)/);
});
