import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const source=path=>readFile(new URL(path,import.meta.url),"utf8");

test("public header switches between sign-in/register and customer portal based on session",async()=>{
 const header=await source("../src/components/site-header.tsx");
 assert.match(header,/fetch\("\/api\/auth\/me"/);
 assert.match(header,/authStatus==="signed-in"/);
 assert.match(header,/Customer portal/);
 assert.match(header,/href="\/portal\/sign-in"/);
 assert.match(header,/href="\/portal\/register"/);
 assert.doesNotMatch(header,/href="\/admin"/);
});

test("customer sign-in always opens the customer portal, including staff-capable accounts",async()=>{
 const page=await source("../src/app/portal/sign-in/page.tsx");
 assert.match(page,/router\.replace\(invitationToken\?[^:]+:"\/portal"\)/);
 assert.doesNotMatch(page,/result\.hasBusinessAccess\?"/);
});
