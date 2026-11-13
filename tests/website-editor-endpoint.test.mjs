import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("website editor saves through a dedicated permission-checked draft endpoint",async()=>{
 const editor=await source("../src/components/admin-website-editor.tsx");
 const route=await source("../src/app/api/admin/website/[id]/route.ts");
 const admin=await source("../src/app/admin/[section]/page.tsx");
 assert.match(editor,/fetch\("\/api\/admin\/website\/"\+id/);
 assert.match(editor,/<Puck[\s\S]*onPublish=\{save\}/);
 assert.match(route,/userHasPermission\(user\.id,"website\.manage"\)/);
 assert.match(route,/sameOrigin\(request\)/);
 assert.match(route,/\.eq\("business_id",membership\.business_id\)/);
 assert.match(route,/draft_content/);
 assert.match(route,/website\.page\.draft_saved/);
 assert.match(admin,/draft_content\?\?row\.content/);
 assert.match(admin,/slug=\{row\.slug\}/);
 assert.match(editor,/defaultWebsiteBuilderData\(slug,title,legacy\)/);
});

test("saving a website draft does not overwrite live content or publish it",async()=>{
 const route=await source("../src/app/api/admin/website/[id]/route.ts");
 const migration=await source("../supabase/migrations/20261113120000_website_page_drafts.sql");
 const draftSave=route.slice(route.indexOf("const draft:"),route.indexOf("return Response.json({page});",route.indexOf("const draft:")));
 assert.match(migration,/add column if not exists draft_content jsonb/);
 assert.match(migration,/select id,'request-quote'/);
 assert.match(migration,/on conflict \(business_id,slug\) do nothing/);
 assert.match(draftSave,/draft_title/);
 assert.match(draftSave,/draft_content/);
 assert.doesNotMatch(draftSave,/update\.content=|update\.is_published|update\.published_at/);
});

test("publishing copies saved draft fields to live content and refreshes the public cache",async()=>{
 const route=await source("../src/app/api/admin/website/[id]/route.ts");
 const publish=route.slice(route.indexOf("if(body.is_published"),route.indexOf("const draft:"));
 assert.match(publish,/update\.content=current\.draft_content/);
 assert.match(publish,/update\.title=current\.draft_title/);
 assert.match(publish,/update\.draft_content=null/);
 assert.match(publish,/is_published:publish/);
 assert.match(publish,/revalidateTag\("brv-public-site","max"\)/);
 assert.match(publish,/website\.page\.published/);
 assert.match(publish,/website\.page\.unpublished/);
});

test("builder exposes protected connected components without exposing form schemas",async()=>{
 const route=await source("../src/app/api/admin/website/[id]/route.ts");
 const config=await source("../src/lib/website-builder.tsx");
 assert.match(route,/body\.content/);
 assert.doesNotMatch(route,/body\.service_areas|body\.form_schema|body\.request_quote/);
 assert.match(config,/href="\/request-quote"/);
 assert.match(config,/ServicesFeed/);
 assert.match(config,/ServiceAreasFeed/);\n assert.match(config,/ServiceAreasFeed:\{[\\s\\S]*permissions:\{delete:false,duplicate:false,edit:true,drag:true\}/);
 assert.match(config,/RequestQuoteForm/);\n assert.match(config,/RequestQuoteForm:\{[\\s\\S]*permissions:\{delete:false,duplicate:false,edit:false,drag:true\}/);
 assert.match(config,/GeneralEnquiryForm/);\n assert.match(config,/GeneralEnquiryForm:\{[\\s\\S]*permissions:\{delete:false,duplicate:false,edit:false,drag:true\}/);
 assert.match(config,/fields:\{\}/);
 assert.match(config,/render:\(\)=> <section[\s\S]*<EnquiryForm\/>/);
 assert.match(config,/WebsiteGeneralEnquiryBlock/);
 assert.doesNotMatch(config,/fields:\{[^}]+name|fields:\{[^}]+email|fields:\{[^}]+message/);
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

test("FAQ and gallery pages pass published feeds to movable builder components",async()=>{
 const config=await source("../src/lib/website-builder.tsx");
 const faq=await source("../src/app/faq/page.tsx");
 const gallery=await source("../src/app/gallery/page.tsx");
 assert.match(config,/FAQList/);
 assert.match(config,/GalleryGrid/);
 assert.match(config,/legacy\.items/);
 assert.match(config,/legacy\.photos/);
 assert.match(faq,/PublicSiteBuilder/);
 assert.match(gallery,/PublicSiteBuilder/);
 assert.match(faq,/getPublishedServices/);
 assert.match(faq,/getPublishedServiceAreas/);
 assert.match(gallery,/getPublishedServices/);
 assert.match(gallery,/getPublishedServiceAreas/);
});

test("quote and general-enquiry blocks reuse the existing forms and customer profile flow",async()=>{
 const config=await source("../src/lib/website-builder.tsx");
 const quote=await source("../src/app/request-quote/page.tsx");
 const general=await source("../src/app/general-enquiry/page.tsx");
 const quoteForm=await source("../src/components/enquiry-form.tsx");
 const generalForm=await source("../src/components/general-enquiry-form.tsx");
 const wrapper=await source("../src/components/website-general-enquiry-block.tsx");
 assert.match(config,/components:\["RequestQuoteCTA","RequestQuoteForm","GeneralEnquiryForm","ServicesFeed","ServiceAreasFeed"\]/);
 assert.match(config,/import EnquiryForm from/);
 assert.match(config,/import WebsiteGeneralEnquiryBlock from/);
 assert.match(config,/render:\(\)=> <section[\s\S]*<EnquiryForm\/>/);
 assert.match(config,/render:\(\)=> <section[\s\S]*<WebsiteGeneralEnquiryBlock\/>/);
 assert.match(quote,/import EnquiryForm/);
 assert.match(quote,/getPublishedSitePage\("request-quote"\)/);
 assert.match(quote,/PublicSiteBuilder/);
 assert.match(general,/getPublishedSitePage\("contact"\)/);
 assert.match(general,/PublicSiteBuilder/);
 assert.match(general,/import GeneralEnquiryForm/);
 assert.match(quoteForm,/fetch\("\/api\/enquiries"/);
 assert.match(generalForm,/form\.set\("requestType","public_enquiry"\)/);
 assert.match(wrapper,/api\/portal\/profile/);
 assert.match(wrapper,/initialName=/);
 assert.match(config,/if\(pageId==="request-quote"\)/);
 assert.match(config,/type:"RequestQuoteForm"/);
 assert.match(config,/if\(pageId==="contact"\)/);
 assert.match(config,/type:"GeneralEnquiryForm"/);
 assert.match(config,/if\(pageId==="how-it-works"\)/);
});

test("builder preview reads published service and service-area feeds only",async()=>{
 const editor=await source("../src/components/admin-website-editor.tsx");
 const services=await source("../src/app/api/public/services/route.ts");
 const areas=await source("../src/app/api/public/service-areas/route.ts");
 assert.match(editor,/fetch\("\/api\/public\/services"/);
 assert.match(editor,/fetch\("\/api\/public\/service-areas"/);
 assert.match(editor,/isEditing:true/);
 const quoteForm=await source("../src/components/enquiry-form.tsx");
 const generalForm=await source("../src/components/general-enquiry-form.tsx");
 assert.match(quoteForm,/onSubmit=\{preview\?/);
 assert.match(quoteForm,/disabled=\{busy\|\|savingVehicle\|\|preview\}/);
 assert.match(generalForm,/onSubmit=\{preview\?/);
 assert.match(generalForm,/disabled=\{busy\|\|preview\}/);
 assert.match(services,/eq\("approval_status","approved_for_launch"\)/);
 assert.match(services,/description,price_from,pricing_label/);
 assert.match(services,/eq\("is_published",true\)/);
 assert.match(areas,/eq\("is_published",true\)/);
 assert.match(areas,/suburbs,postcodes/);
});
