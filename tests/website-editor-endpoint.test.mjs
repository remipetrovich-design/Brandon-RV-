import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("website editor saves through a dedicated permission-checked page endpoint",async()=>{
 const editor=await source("../src/components/admin-website-editor.tsx");
 const route=await source("../src/app/api/admin/website/[id]/route.ts");
 assert.match(editor,/fetch\("\/api\/admin\/website\/"\+id/);
 assert.match(editor,/<Puck[\s\S]*onPublish=\{save\}/);
 assert.match(route,/userHasPermission\(user\.id,"website\.manage"\)/);
 assert.match(route,/sameOrigin\(request\)/);
 assert.match(route,/\.eq\("business_id",membership\.business_id\)/);
 assert.match(route,/revalidateTag\("brv-public-site","max"\)/);
 assert.match(route,/website\.page\.updated/);
});

test("website builder cannot edit operational form definitions or service-area records",async()=>{
 const route=await source("../src/app/api/admin/website/[id]/route.ts");
 const config=await source("../src/lib/website-builder.tsx");
 assert.match(route,/body\.content/);
 assert.doesNotMatch(route,/body\.service_areas|body\.form_schema|body\.request_quote/);
 assert.match(config,/href="\/request-quote"/);
 assert.match(config,/ServicesFeed/);
 assert.match(config,/ServiceAreasFeed/);
 assert.doesNotMatch(config,/requestQuoteForm|EnquiryForm|BookingForm|ServiceAreaEditor/);
});

test("public page builder reads services and service areas from live application data",async()=>{
 const renderer=await source("../src/components/public-site-builder.tsx");
 const homepage=await source("../src/app/page.tsx");
 const about=await source("../src/app/about-services/page.tsx");
 const process=await source("../src/app/how-it-works/page.tsx");
 assert.match(renderer,/createWebsiteBuilderConfig\(\{services,areas\}\)/);
 assert.match(homepage,/getPublishedServices\(\)/);
 assert.match(homepage,/getPublishedServiceAreas\(\)/);
 assert.match(about,/getPublishedServices\(\)/);
 assert.match(about,/getPublishedServiceAreas\(\)/);
 assert.match(process,/getPublishedServiceAreas\(\)/);
});
