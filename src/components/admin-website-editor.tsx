"use client";
import {useMemo,useState} from "react";
import {useRouter} from "next/navigation";
type FieldKind="text"|"list"|"json";
function kindOf(value:unknown):FieldKind{return Array.isArray(value)&&value.every(x=>typeof x==="string")?"list":value!==null&&typeof value==="object"?"json":"text";}
function displayValue(value:unknown,kind:FieldKind){return kind==="list"&&Array.isArray(value)?value.join("\n"):kind==="json"?JSON.stringify(value,null,2):String(value??"");}
export default function AdminWebsiteEditor({id,title,content,metaTitle,metaDescription}:{id:string;title:string;content:unknown;metaTitle:string|null;metaDescription:string|null}){
 const initial=content&&typeof content==="object"&&!Array.isArray(content)?content as Record<string,unknown>:{};
 const [pageTitle,setPageTitle]=useState(title);const [fields,setFields]=useState<Record<string,string>>(()=>Object.fromEntries(Object.entries(initial).map(([key,value])=>[key,displayValue(value,kindOf(value))])));
 const [seoTitle,setSeoTitle]=useState(metaTitle??"");const [seoDescription,setSeoDescription]=useState(metaDescription??"");const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);const [preview,setPreview]=useState(false);const router=useRouter();
 const previewIntro=fields.intro??fields.hero_subtitle??"";
 const previewHeading=fields.hero_title??pageTitle;
 const fieldKeys=useMemo(()=>Object.keys(fields),[fields]);
 function updateField(key:string,value:string){setFields(current=>({...current,[key]:value}));}
 function addField(){let i=1;while(fieldKeys.includes("content_"+i))i++;setFields(current=>({...current,["content_"+i]:""}));}
 function removeField(key:string){setFields(current=>{const next={...current};delete next[key];return next;});}
 async function save(){setBusy(true);setNotice("");const parsed:Record<string,unknown>={};try{for(const [key,value] of Object.entries(fields)){const original=initial[key];const kind=original===undefined?"text":kindOf(original);if(kind==="list")parsed[key]=value.split("\n").map(x=>x.trim()).filter(Boolean);else if(kind==="json")parsed[key]=JSON.parse(value);else parsed[key]=value;}}catch{setNotice("Check the JSON field format before saving.");setBusy(false);return;}
 try{const r=await fetch("/api/admin/website/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:pageTitle,content:parsed,meta_title:seoTitle,meta_description:seoDescription})});const d=await r.json();if(!r.ok){setNotice(d.error??"Could not save page.");return;}setNotice("Page content saved. Publishing is a separate action.");router.refresh();}catch{setNotice("Could not save page.");}finally{setBusy(false);}}
 return <div className="portal-panel"><div className="portal-panel-heading"><div><span className="panel-kicker">WEBSITE PAGE · {id.slice(0,8)}</span><h2>{title}</h2></div><button className="button button-secondary" type="button" onClick={()=>setPreview(value=>!value)}>{preview?"Hide preview":"Preview draft"}</button></div>
 <label>Page title<input value={pageTitle} onChange={e=>setPageTitle(e.target.value)} maxLength={160}/></label><label>SEO title<input value={seoTitle} onChange={e=>setSeoTitle(e.target.value)} maxLength={160}/></label><label>SEO description<textarea value={seoDescription} onChange={e=>setSeoDescription(e.target.value)} rows={2} maxLength={320}/></label>
 <div className="portal-panel-heading"><div><span className="panel-kicker">PAGE CONTENT</span><p className="panel-footnote">Edit the content fields below. Lists use one item per line.</p></div><button type="button" className="button button-secondary" onClick={addField}>Add content field</button></div>
 {fieldKeys.map(key=>{const original=initial[key];const kind=original===undefined?"text":kindOf(original);return <div key={key} className="activity-item" style={{display:"block"}}><div className="form-grid"><label>{key.replaceAll("_"," ")}{kind==="text"?<input value={fields[key]} onChange={e=>updateField(key,e.target.value)}/>:<textarea value={fields[key]} onChange={e=>updateField(key,e.target.value)} rows={kind==="list"?3:6} spellCheck={kind!=="json"}/>}</label><div style={{display:"flex",alignItems:"end"}}><button type="button" className="button button-secondary" onClick={()=>removeField(key)}>Remove field</button></div></div></div>;})}
 {preview&&<section className="portal-panel" aria-label="Draft preview"><span className="panel-kicker">DRAFT PREVIEW · NOT LIVE</span><h2>{previewHeading}</h2>{fields.hero_subtitle&&<p>{fields.hero_subtitle}</p>}<p>{previewIntro}</p>{fieldKeys.filter(key=>!["hero_title","hero_subtitle","intro","publication_note"].includes(key)).map(key=><p key={key}>{Array.isArray(initial[key])?fields[key].split("\n").filter(Boolean).join(" · "):fields[key]}</p>)}</section>}
 <button className="button button-primary" disabled={busy} onClick={()=>void save()}>{busy?"Saving…":"Save page content"}</button>{notice&&<p className="inline-notice" role="status">{notice}</p>}</div>;
}
