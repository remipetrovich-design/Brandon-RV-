"use client";

import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {Puck} from "@puckeditor/core";
import {createWebsiteBuilderConfig,defaultWebsiteBuilderData} from "@/lib/website-builder";

type Page={
 id:string;slug:string;title:string;content:unknown;meta_title:string|null;meta_description:string|null;
 draft_title?:string|null;draft_content?:unknown;draft_meta_title?:string|null;draft_meta_description?:string|null;
 is_published:boolean;updated_at?:string|null;draft_updated_at?:string|null;
};
type Props={pages:Page[]};
const asRecord=(value:unknown):Record<string,unknown>=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
const pageLabel=(slug:string)=>slug==="home"?"Home":slug.split("-").map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(" ");

export default function AdminWebsiteWorkspace({pages:initialPages}:Props){
 const [pages,setPages]=useState(initialPages);
 const [selectedSlug,setSelectedSlug]=useState(initialPages[0]?.slug??"");
 const selectedPage=pages.find(page=>page.slug===selectedSlug)??pages[0];
 const sourceContent=selectedPage?.draft_content??selectedPage?.content;
 const legacy=asRecord(sourceContent);
 const initialData=useMemo(()=>legacy.builder&&typeof legacy.builder==="object"?legacy.builder:defaultWebsiteBuilderData(selectedPage?.slug??"home",selectedPage?.draft_title??selectedPage?.title??"Home",legacy),[selectedPage?.id,selectedPage?.draft_updated_at,selectedPage?.updated_at]);
 const [editorData,setEditorData]=useState<any>(initialData);
 const [pageTitle,setPageTitle]=useState(selectedPage?.draft_title??selectedPage?.title??"");
 const [seoTitle,setSeoTitle]=useState(selectedPage?.draft_meta_title??selectedPage?.meta_title??"");
 const [seoDescription,setSeoDescription]=useState(selectedPage?.draft_meta_description??selectedPage?.meta_description??"");
 const [dirty,setDirty]=useState(false);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("Select a page, make changes, then save its draft. Publishing remains a separate action.");
 const [services,setServices]=useState<any[]>([]);
 const [areas,setAreas]=useState<any[]>([]);
 const builderConfig=useMemo(()=>createWebsiteBuilderConfig({services,areas,isEditing:true}) as any,[services,areas]);

 useEffect(()=>{let active=true;void Promise.all([fetch("/api/public/services",{cache:"no-store"}).then(r=>r.ok?r.json():{services:[]}),fetch("/api/public/service-areas",{cache:"no-store"}).then(r=>r.ok?r.json():{areas:[]})]).then(([serviceData,areaData])=>{if(active){setServices(serviceData.services??[]);setAreas(areaData.areas??[]);}}).catch(()=>{});return()=>{active=false;};},[]);

 function switchPage(slug:string){
  if(slug===selectedSlug)return;
  if(dirty&&!window.confirm("You have unsaved changes on this page. Switch pages without saving them?"))return;
  const next=pages.find(page=>page.slug===slug);if(!next)return;
  const content=asRecord(next.draft_content??next.content);
  const builder=content.builder&&typeof content.builder==="object"?content.builder:defaultWebsiteBuilderData(next.slug,next.draft_title??next.title,content);
  setSelectedSlug(slug);setEditorData(builder);setPageTitle(next.draft_title??next.title);setSeoTitle(next.draft_meta_title??next.meta_title??"");setSeoDescription(next.draft_meta_description??next.meta_description??"");setDirty(false);setNotice("Editing "+pageLabel(slug)+".");
 }

 async function save(data:unknown=editorData){
  if(!selectedPage)return;
  setBusy(true);setNotice("");
  try{
   const content={...legacy,builder:data};
   const response=await fetch("/api/admin/website/"+selectedPage.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:pageTitle,content,meta_title:seoTitle,meta_description:seoDescription})});
   const result=await response.json();
   if(!response.ok){setNotice(result.error??"Could not save this page.");return;}
   setPages(current=>current.map(page=>page.id===selectedPage.id?{...page,draft_title:pageTitle,draft_content:content,draft_meta_title:seoTitle,draft_meta_description:seoDescription,draft_updated_at:new Date().toISOString()}:page));
   setDirty(false);setNotice("Draft saved for "+pageLabel(selectedPage.slug)+". The live website has not changed.");
  }catch{setNotice("Could not save this page. Check your connection and try again.");}
  finally{setBusy(false);}
 }

 if(!selectedPage)return <section className="portal-panel"><h2>No website pages found</h2><p>There are no pages available for this business yet.</p></section>;

 return <main className="portal-page brv-builder-page"><div className="shell portal-shell brv-builder-shell">
  <div className="portal-page-heading brv-builder-intro"><p className="eyebrow"><span className="eyebrow-line"/> WEBSITE MANAGEMENT</p><h1>Website Builder.</h1><p>Edit every page from one workspace. Each page keeps its own draft and publishing status.</p></div>
  <section className="portal-panel brv-unified-builder" id="brv-unified-builder">
   <div className="brv-builder-toolbar">
    <div className="brv-builder-page-picker"><label htmlFor="brv-page-select">Editing page</label><select id="brv-page-select" value={selectedPage.slug} onChange={event=>switchPage(event.target.value)}>{pages.map(page=><option key={page.id} value={page.slug}>{pageLabel(page.slug)}</option>)}</select></div>
    <div className="brv-builder-toolbar-actions"><span className={"status-pill "+(selectedPage.is_published?"":"status-pill-draft")}>{selectedPage.is_published?"Live page":"Unpublished"}</span><Link className="button button-secondary brv-builder-view-link" href={"/"+(selectedPage.slug==="home"?"":selectedPage.slug)} target="_blank">View page ↗</Link><button className="button button-primary" type="button" disabled={busy||!dirty} onClick={()=>void save()}>{busy?"Saving…":"Save draft"}</button></div>
   </div>
   <div className="brv-builder-page-meta">
    <label>Page title<input value={pageTitle} onChange={event=>{setPageTitle(event.target.value);setDirty(true);}} maxLength={160}/></label>
    <label>SEO title<input value={seoTitle} onChange={event=>{setSeoTitle(event.target.value);setDirty(true);}} maxLength={160}/></label>
    <label className="brv-builder-seo-description">SEO description<textarea value={seoDescription} onChange={event=>{setSeoDescription(event.target.value);setDirty(true);}} rows={2} maxLength={320}/></label>
   </div>
   <p className="panel-footnote brv-builder-help">Choose a page above, then edit its layout below. On a phone, rotate to landscape if you need more room for the block library and settings. Protected enquiry forms and live admin-managed service data stay connected and cannot be broken.</p>
   <div className="brv-builder-canvas">
    <Puck key={selectedPage.id} config={builderConfig} data={editorData as any} onChange={(data:any)=>{setEditorData(data);setDirty(true);}} onPublish={(data:any)=>void save(data)}/>
   </div>
   <p className="inline-notice brv-builder-notice" role="status">{busy?"Saving draft…":notice}</p>
  </section>
  <p className="portal-muted-note brv-builder-footer">Saving a draft does not publish it. Use the page publishing controls in Website Management when you are ready to make changes live.</p>
 </div></main>;
}
