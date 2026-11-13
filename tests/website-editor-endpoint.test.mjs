import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source=(path)=>readFile(new URL(path,import.meta.url),"utf8");
const has=(text,part)=>assert.ok(text.includes(part),`Expected source to include: ${part}`);

test("website editor saves through a dedicated permission-checked draft endpoint",async()=>{
 const editor=await source("../src/components/admin-website-editor.tsx");
 const route=await source("../src/app/api/admin/website/[id]/route.ts");
 const admin=await source("../src/app/admin/[section]/page.tsx");
 has(editor,'fetch("/api/admin/website/"+id');
 has(editor,"onPublish={save}");
 has(route,'userHasPermission(user.id,"website.manage")');
 has(route,"sameOrigin(request)");
 has(route,'.eq("business_id",membership.business_id)');
 has(route,"draft_content");
 has(route,"website.page.draft_saved");
 has(admin,"draft_content??row.content");
 has(admin,"slug={row.slug}");
 has(editor,"defaultWebsiteBuilderData(slug,title,legacy)");
});

test("saving a website draft does not overwrite live content or publish it",async()=>{
 const route=await source("../src/app/api/admin/website/[id]/route.ts");
 const migration=await source("../supabase/migrations/20261113120000_website_page_drafts.sql");
 const start=route.indexOf("const draft:");
 const end=route.indexOf("return Response.json({page});",start);
 const draftSave=route.slice(start,end);
 has(migration,"add column if not exists draft_content jsonb");
 has(migration,"select id,'request-quote'");
 has(migration,"on conflict (business_id,slug) do nothing");
 has(draftSave,"draft_title");
 has(draftSave,"draft_content");
 assert.equal(draftSave.includes("update.content="),false);
 assert.equal(draftSave.includes("update.is_published"),false);
 assert.equal(draftSave.includes("update.published_at"),false);
});

test("publishing copies saved draft fields to live content and refreshes the public cache",async()=>{
 const route=await source("../src/app/api/admin/website/[id]/route.ts");
 const start=route.indexOf("if(body.is_published");
 const end=route.indexOf("const draft:",start);
 const publish=route.slice(start,end);
 has(publish,"update.content=current.draft_content");
 has(publish,"update.title=current.draft_title");
 has(publish,"update.draft_content=null");
 has(publish,"is_published:publish");
 has(publish,'revalidateTag("brv-public-site","max")');
 has(publish,"website.page.published");
 has(publish,"website.page.unpublished");
});

test("builder exposes protected connected components without exposing form schemas",async()=>{
 const route=await source("../src/app/api/admin/website/[id]/route.ts");
 const config=await source("../src/lib/website-builder.tsx");
 const block=(name)=>{const start=config.indexOf(name+":{");const end=config.indexOf("\n   },",start);return config.slice(start,end<0?undefined:end);};
 has(route,"body.content");
 assert.equal(route.includes("body.service_areas"),false);
 assert.equal(route.includes("body.form_schema"),false);
 assert.equal(route.includes("body.request_quote"),false);
 has(config,'href="/request-quote"');
 has(config,"ServicesFeed");
 has(config,"ServiceAreasFeed");
 has(block("RequestQuoteForm"),"permissions:{delete:false,duplicate:false,edit:false,drag:true}");
 has(block("GeneralEnquiryForm"),"permissions:{delete:false,duplicate:false,edit:false,drag:true}");
 has(block("ServicesFeed"),"permissions:{delete:false,duplicate:false,edit:true,drag:true}");
 has(block("ServiceAreasFeed"),"permissions:{delete:false,duplicate:false,edit:true,drag:true}");
 has(config,"<EnquiryForm preview={isEditing}/>");
 has(config,"<WebsiteGeneralEnquiryBlock preview={isEditing}/>");
 assert.equal(config.includes("fields:{name:"),false);
 assert.equal(config.includes("fields:{email:"),false);
 assert.equal(config.includes("fields:{message:"),false);
});

test("public page builder reads services and service areas from live application data",async()=>{
 const renderer=await source("../src/components/public-site-builder.tsx");
 const homepage=await source("../src/app/page.tsx");
 const about=await source("../src/app/about-services/page.tsx");
 const process=await source("../src/app/how-it-works/page.tsx");
 has(renderer,"createWebsiteBuilderConfig({services,areas})");
 has(homepage,"getPublishedServices()");
 has(homepage,"getPublishedServiceAreas()");
 has(about,"getPublishedServices()");
 has(about,"getPublishedServiceAreas()");
 has(process,"getPublishedServiceAreas()");
});

test("FAQ and gallery pages pass published feeds to movable builder components",async()=>{
 const config=await source("../src/lib/website-builder.tsx");
 const faq=await source("../src/app/faq/page.tsx");
 const gallery=await source("../src/app/gallery/page.tsx");
 has(config,"FAQList");
 has(config,"GalleryGrid");
 has(config,"legacy.items");
 has(config,"legacy.photos");
 has(faq,"PublicSiteBuilder");
 has(gallery,"PublicSiteBuilder");
 has(faq,"getPublishedServices");
 has(faq,"getPublishedServiceAreas");
 has(gallery,"getPublishedServices");
 has(gallery,"getPublishedServiceAreas");
});

test("quote and general-enquiry blocks reuse the existing forms and customer profile flow",async()=>{
 const config=await source("../src/lib/website-builder.tsx");
 const quote=await source("../src/app/request-quote/page.tsx");
 const general=await source("../src/app/general-enquiry/page.tsx");
 const quoteForm=await source("../src/components/enquiry-form.tsx");
 const generalForm=await source("../src/components/general-enquiry-form.tsx");
 const wrapper=await source("../src/components/website-general-enquiry-block.tsx");
 has(config,'components:["RequestQuoteCTA","RequestQuoteForm","GeneralEnquiryForm","ServicesFeed","ServiceAreasFeed"]');
 has(config,'import EnquiryForm from "@/components/enquiry-form"');
 has(config,'import WebsiteGeneralEnquiryBlock from "@/components/website-general-enquiry-block"');
 has(config,"<EnquiryForm preview={isEditing}/>");
 has(config,"<WebsiteGeneralEnquiryBlock preview={isEditing}/>");
 has(quote,'getPublishedSitePage("request-quote")');
 has(quote,"PublicSiteBuilder");
 has(quote,'export const dynamic="force-dynamic"');
 has(general,'getPublishedSitePage("contact")');
 has(general,"PublicSiteBuilder");
 has(general,'import GeneralEnquiryForm from "@/components/general-enquiry-form"');
 has(quoteForm,'fetch("/api/enquiries"');
 has(generalForm,'form.set("requestType","public_enquiry")');
 has(wrapper,'fetch("/api/portal/profile"');
 has(wrapper,"initialName=");
 has(config,'if(pageId==="request-quote")');
 has(config,'type:"RequestQuoteForm"');
 has(config,'if(pageId==="contact")');
 has(config,'type:"GeneralEnquiryForm"');
 has(config,'if(pageId==="how-it-works")');
});

test("builder preview reads published service and service-area feeds only",async()=>{
 const editor=await source("../src/components/admin-website-editor.tsx");
 const services=await source("../src/app/api/public/services/route.ts");
 const areas=await source("../src/app/api/public/service-areas/route.ts");
 const quoteForm=await source("../src/components/enquiry-form.tsx");
 const generalForm=await source("../src/components/general-enquiry-form.tsx");
 has(editor,'fetch("/api/public/services"');
 has(editor,'fetch("/api/public/service-areas"');
 has(editor,"isEditing:true");
 has(quoteForm,"onSubmit={preview?");
 has(quoteForm,"disabled={busy||savingVehicle||preview}");
 has(generalForm,"onSubmit={preview?");
 has(generalForm,"disabled={busy||preview}");
 has(services,'eq("approval_status","approved_for_launch")');
 has(services,"description,price_from,pricing_label");
 has(services,'eq("is_published",true)');
 has(areas,'eq("is_published",true)');
 has(areas,"suburbs,postcodes");
});

test("FAQ and gallery first-save layouts are selected by page slug, not database row id",async()=>{
 const editor=await source("../src/components/admin-website-editor.tsx");
 has(editor,"defaultWebsiteBuilderData(slug,title,legacy)");
 assert.equal(editor.includes("defaultWebsiteBuilderData(id,title,legacy)"),false);
});

test("combined About and Services route preserves each legacy section until its builder exists",async()=>{
 const page=await source("../src/app/about-services/page.tsx");
 assert.equal(page.includes("if(hasAboutBuilder||hasServicesBuilder)return"),false);
 has(page,"hasAboutBuilder?<PublicSiteBuilder");
 has(page,"hasServicesBuilder?<PublicSiteBuilder");
 has(page,"aboutTitle");
 has(page,"serviceTitle");
 has(page,"items.map(item");
});

test("combined How it Works and Service Areas route preserves each legacy section until its builder exists",async()=>{
 const page=await source("../src/app/how-it-works/page.tsx");
 assert.equal(page.includes("if(hasPageBuilder||hasAreasBuilder)return"),false);
 has(page,"hasPageBuilder?<PublicSiteBuilder");
 has(page,"hasAreasBuilder?<PublicSiteBuilder");
 has(page,"steps.map((step,i)");
 has(page,"service-area-card");
});
