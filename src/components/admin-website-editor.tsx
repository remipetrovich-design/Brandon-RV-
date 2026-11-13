"use client";

import {useMemo,useState} from "react";
import {Puck} from "@puckeditor/core";
import {createWebsiteBuilderConfig,defaultWebsiteBuilderData} from "@/lib/website-builder";

type Props={id:string;title:string;content:unknown;metaTitle:string|null;metaDescription:string|null};

export default function AdminWebsiteEditor({id,title,content,metaTitle,metaDescription}:Props){
 const legacy=content&&typeof content==="object"&&!Array.isArray(content)?content as Record<string,unknown>:{};
 const initialBuilder=useMemo(()=>legacy.builder&&typeof legacy.builder==="object"?legacy.builder:defaultWebsiteBuilderData(id,title,legacy),[id,title]);
 const [pageTitle,setPageTitle]=useState(title);
 const [seoTitle,setSeoTitle]=useState(metaTitle??"");
 const [seoDescription,setSeoDescription]=useState(metaDescription??"");
 const [notice,setNotice]=useState("Changes are saved as a draft. Publishing the page remains a separate admin action.");
 const [busy,setBusy]=useState(false);

 async function save(data:unknown){
  setBusy(true);setNotice("");
  try{
   const nextContent={...legacy,builder:data};
   const response=await fetch("/api/admin/website/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:pageTitle,content:nextContent,meta_title:seoTitle,meta_description:seoDescription})});
   const result=await response.json();
   if(!response.ok){setNotice(result.error??"Could not save page.");return;}
   setNotice("Draft saved. The live website has not been published.");
  }catch{setNotice("Could not save page.");}
  finally{setBusy(false);}
 }

 return <div className="portal-panel" style={{padding:0,overflow:"hidden"}}>
  <div style={{padding:24}}>
   <div className="portal-panel-heading"><div><span className="panel-kicker">VISUAL WEBSITE EDITOR · {id.slice(0,8)}</span><h2>{title}</h2></div><span className="status-pill">Draft editor</span></div>
   <div className="form-grid">
    <label>Page title<input value={pageTitle} onChange={event=>setPageTitle(event.target.value)} maxLength={160}/></label>
    <label>SEO title<input value={seoTitle} onChange={event=>setSeoTitle(event.target.value)} maxLength={160}/></label>
   </div>
   <label>SEO description<textarea value={seoDescription} onChange={event=>setSeoDescription(event.target.value)} rows={2} maxLength={320}/></label>
   <p className="panel-footnote">Drag and drop approved content blocks. Request-a-quote, enquiry forms, service records, service areas and booking workflows are connected components; their underlying forms, data and admin behaviour cannot be edited here.</p>
  </div>
  <div style={{minHeight:720,borderTop:"1px solid var(--line, #d8e0e5)"}}>
   <Puck key={id} config={createWebsiteBuilderConfig() as any} data={initialBuilder as any} onPublish={save}/>
  </div>
  <p className="inline-notice" role="status" style={{margin:16}}>{busy?"Saving draft…":notice}</p>
 </div>;
}
