import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("website editor saves through a dedicated permission-checked page endpoint",async()=>{
 const editor=await source("../src/components/admin-website-editor.tsx");
 const route=await source("../src/app/api/admin/website/[id]/route.ts");
 assert.match(editor,/fetch\("\/api\/admin\/website\/"\+id/);
 assert.match(route,/userHasPermission\(user\.id,"website\.manage"\)/);
 assert.match(route,/sameOrigin\(request\)/);
 assert.match(route,/\.eq\("business_id",membership\.business_id\)/);
 assert.match(route,/revalidateTag\("brv-public-site","max"\)/);
 assert.match(route,/website\.page\.updated/);
});

test("website page editing cannot mutate operational forms, service areas or publication state",async()=>{
 const route=await source("../src/app/api/admin/website/[id]/route.ts");
 assert.match(route,/body\.title/);
 assert.match(route,/body\.content/);
 assert.match(route,/body\.meta_title/);
 assert.match(route,/body\.meta_description/);
 assert.doesNotMatch(route,/body\.is_published|body\.service_areas|body\.form_schema|body\.request_quote/);
 assert.match(route,/site_pages/);
});
