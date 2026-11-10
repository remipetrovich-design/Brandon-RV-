"use client";
import {FormEvent,useEffect,useState} from "react";

type Entry={id:string;entry_type:string;description:string;quantity:number;unit_price:number;line_total:number;occurred_at:string};
type Attachment={id:string;file_name:string;mime_type:string;customer_visible:boolean;url:string|null};
type WorkOrder={id:string;job_number:string;title:string;status:string;scope_of_work:string|null;scheduled_start:string|null;senior_approval_status?:string;senior_approval_note?:string|null;senior_approved_at?:string|null;worker_signed_off_at?:string|null;work_summary?:string|null;customer_name?:string;entries:Entry[];assignment_status:string};

export default function StaffWorkOrders(){
 const [orders,setOrders]=useState<WorkOrder[]>([]);
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [expandedId,setExpandedId]=useState<string|null>(null);
 const [entryForms,setEntryForms]=useState<Record<string,{entryType:string;description:string;quantity:string;unitPrice:string;customerVisible:boolean}>>({});
 const [summaries,setSummaries]=useState<Record<string,string>>({});
 const [attachments,setAttachments]=useState<Record<string,Attachment[]>>({});
 const [photoVisibility,setPhotoVisibility]=useState<Record<string,boolean>>({});

 async function load(){
  try{
   const r=await fetch("/api/staff/jobs",{cache:"no-store"});
   const d=await r.json();
   if(!r.ok){setNotice(d.error??"Could not load Workcards.");return;}
   setOrders((d.workOrders??[]).map((x:any)=>({...x.job,assignment_status:x.status,entries:x.entries??[]})));
  }catch{setNotice("Could not load Workcards.");}
 }
 useEffect(()=>{void load();},[]);

 function form(id:string){return entryForms[id]??{entryType:"labour",description:"",quantity:"1",unitPrice:"",customerVisible:true};}
 async function loadAttachments(id:string){try{const r=await fetch("/api/staff/jobs/"+id+"/attachments",{cache:"no-store"});const d=await r.json();if(r.ok)setAttachments(v=>({...v,[id]:d.attachments??[]}));}catch{setNotice("Could not load Workcard photos.");}}
 async function uploadPhotos(e:FormEvent<HTMLFormElement>,id:string){e.preventDefault();const form=e.currentTarget;const data=new FormData(form);data.set("customerVisible",String(photoVisibility[id]??false));setBusy(true);setNotice("");try{const r=await fetch("/api/staff/jobs/"+id+"/attachments",{method:"POST",body:data});const d=await r.json();if(!r.ok){setNotice(d.error??"Could not upload photos.");return;}setAttachments(v=>({...v,[id]:[...(v[id]??[]),...(d.attachments??[])]}));form.reset();setNotice("Workcard photos uploaded.");}catch{setNotice("Could not upload photos.");}finally{setBusy(false);}}
 async function action(url:string,body:any,method="POST"){
  setBusy(true);setNotice("");
  try{
   const r=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   const d=await r.json();
   if(!r.ok){setNotice(d.error??"Could not update Workcard.");return false;}
   setNotice("Workcard updated.");await load();return true;
  }catch{setNotice("Could not update Workcard.");return false;}
  finally{setBusy(false);}
 }
 async function addEntry(e:FormEvent<HTMLFormElement>,id:string){
  e.preventDefault();const f=form(id);
  if(await action("/api/staff/jobs/"+id+"/work-entries",{entryType:f.entryType,description:f.description,quantity:Number(f.quantity),unitPrice:Number(f.unitPrice),customerVisible:f.customerVisible})){
   setEntryForms(v=>({...v,[id]:{...form(id),description:"",unitPrice:""}}));
  }
 }
 const pretty=(v:string)=>v.replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());

 return <section className="portal-panel brv-workcards-panel">
  <div className="portal-panel-heading"><div><span className="panel-kicker">YOUR ASSIGNED WORK</span><h2>Workcards</h2><p>Open one Workcard at a time. Record the work as you complete it.</p></div><button type="button" className="button button-secondary" onClick={()=>void load()} disabled={busy}>Refresh</button></div>
  {orders.length?<div className="brv-workcard-list">{orders.map(job=><article className="brv-workcard-card" key={job.id}>
   <div className="brv-workcard-summary">
    <div className="brv-workcard-identity"><strong>{job.job_number}</strong><span>{job.title}</span><small>{pretty(job.status)} · {job.scheduled_start?new Date(job.scheduled_start).toLocaleString("en-AU"):"Schedule to be confirmed"}</small></div>
    <button type="button" className="button button-secondary brv-workcard-open" aria-expanded={expandedId===job.id} aria-controls={"workcard-detail-"+job.id} onClick={()=>{const opening=expandedId!==job.id;setExpandedId(current=>current===job.id?null:job.id);if(opening&&!attachments[job.id])void loadAttachments(job.id);}}>{expandedId===job.id?"Close Workcard":"Open Workcard"}</button>
   </div>
   {expandedId===job.id&&<div className="brv-workcard-detail" id={"workcard-detail-"+job.id}><div className="brv-workcard-detail-actions"><button className="button button-secondary" type="button" onClick={()=>window.print()}>Print Workcard</button></div>
    {job.scope_of_work&&<div className="brv-workcard-scope"><span className="panel-kicker">APPROVED SCOPE</span><p>{job.scope_of_work}</p></div>}
    {(job.status==="pending"||job.status==="scheduled")&&<div className="brv-workcard-next"><p>{job.assignment_status==="assigned"?"This Workcard is assigned to you. Accept it before starting.":"Accept the assignment before recording work."}</p>{job.assignment_status==="assigned"?<button className="button button-primary" disabled={busy} onClick={()=>void action("/api/staff/jobs/"+job.id+"/accept",{})}>Accept assignment</button>:<button className="button button-primary" disabled={busy} onClick={()=>void action("/api/staff/jobs/"+job.id+"/status",{action:"start"},"PATCH")}>Start Workcard / mark arrived</button>}</div>}
    {job.status==="in_progress"&&<>
     <div className="brv-workcard-entries"><strong>Work recorded</strong>{job.entries.length?job.entries.map(x=><div className="brv-workcard-entry" key={x.id}><span>{pretty(x.entry_type)}</span><p>{x.description}</p><small>{x.entry_type==="note"?"Non-billable note":"Qty "+x.quantity+" · $"+Number(x.line_total).toFixed(2)}</small></div>):<p className="panel-footnote">No work entries yet.</p>}</div>
     <form className="auth-form brv-workcard-entry-form" onSubmit={e=>void addEntry(e,job.id)}>
      <strong>Add work entry</strong>
      <label>Entry type<select value={form(job.id).entryType} onChange={e=>setEntryForms(v=>({...v,[job.id]:{...form(job.id),entryType:e.target.value}}))}><option value="labour">Labour</option><option value="parts">Parts</option><option value="test">Test / check (not billed)</option><option value="note">Work note (not billed)</option></select></label>
      <label>Description<input required minLength={2} maxLength={2000} value={form(job.id).description} onChange={e=>setEntryForms(v=>({...v,[job.id]:{...form(job.id),description:e.target.value}}))}/></label>
      <div className="form-grid"><label>Quantity / hours<input type="number" min="0.01" step="0.01" value={form(job.id).quantity} onChange={e=>setEntryForms(v=>({...v,[job.id]:{...form(job.id),quantity:e.target.value}}))}/></label><label>Unit price AUD<input type="number" min="0" step="0.01" value={form(job.id).unitPrice} onChange={e=>setEntryForms(v=>({...v,[job.id]:{...form(job.id),unitPrice:e.target.value}}))}/></label></div>
      <small>Tax uses the confirmed business settings. Keep internal notes and customer-visible work updates separate.</small>
      <label className="brv-workcard-checkbox"><input type="checkbox" checked={form(job.id).customerVisible} onChange={e=>setEntryForms(v=>({...v,[job.id]:{...form(job.id),customerVisible:e.target.checked}}))}/> Show this entry on the customer Jobcard</label>
      <button className="button button-secondary" disabled={busy||!form(job.id).description.trim()}>Add entry</button>
     </form>
     <section className="brv-workcard-photos"><div><strong>Photos & evidence</strong><small>Upload up to 8 images per batch. Customer visibility is controlled separately.</small></div>{attachments[job.id]?.length?<div className="brv-workcard-photo-grid">{attachments[job.id].map(file=><a href={file.url??"#"} key={file.id} target="_blank" rel="noreferrer">{file.url&&<img src={file.url} alt={file.file_name}/>}<span>{file.file_name}</span><small>{file.customer_visible?"Customer-visible":"Staff only"}</small></a>)}</div>:<p className="panel-footnote">No photos uploaded yet.</p>}<form onSubmit={e=>void uploadPhotos(e,job.id)}><label>Choose photos<input type="file" name="files" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple required/></label><label className="brv-workcard-checkbox"><input type="checkbox" checked={photoVisibility[job.id]??false} onChange={e=>setPhotoVisibility(v=>({...v,[job.id]:e.target.checked}))}/> Make these photos visible on the customer Jobcard</label><button className="button button-secondary" disabled={busy}>Upload photos</button></form></section>
     <div className="brv-workcard-finish"><label>Work completed summary<textarea rows={3} minLength={10} maxLength={8000} value={summaries[job.id]??""} onChange={e=>setSummaries(v=>({...v,[job.id]:e.target.value}))} placeholder="Describe completed work, tests performed and any follow-up required."/></label><button className="button button-primary" disabled={busy||(summaries[job.id]??"").trim().length<10} onClick={()=>void action("/api/staff/jobs/"+job.id+"/status",{action:"finish",workSummary:summaries[job.id]},"PATCH")}>Submit Workcard & sign off</button></div>
    </>}
    {job.status==="completed"&&<div className="brv-workcard-completed"><span className="panel-kicker">SUBMITTED WORKCARD</span><p>{job.work_summary||"Worker sign-off recorded."}</p><div className="brv-workcard-entries"><strong>Recorded work</strong>{job.entries.length?job.entries.map(x=><div className="brv-workcard-entry" key={x.id}><span>{pretty(x.entry_type)}</span><p>{x.description}</p><small>{["note","test"].includes(x.entry_type)?"Non-billable":"Qty "+x.quantity+" · $"+Number(x.line_total).toFixed(2)}</small></div>):<p className="panel-footnote">No work entries were recorded.</p>}</div>{attachments[job.id]?.length>0&&<div className="brv-workcard-photo-grid">{attachments[job.id].map(file=><a href={file.url??"#"} key={file.id} target="_blank" rel="noreferrer">{file.url&&<img src={file.url} alt={file.file_name}/>}<span>{file.file_name}</span><small>{file.customer_visible?"Customer-visible":"Staff only"}</small></a>)}</div>}<p className="inline-notice">Worker sign-off: {job.worker_signed_off_at?new Date(job.worker_signed_off_at).toLocaleString("en-AU"):"Recorded"} · Senior review: {pretty(job.senior_approval_status??"pending")}{job.senior_approved_at?" · "+new Date(job.senior_approved_at).toLocaleString("en-AU"):""}</p>{job.senior_approval_note&&<p className="panel-footnote">{job.senior_approval_note}</p>}</div>}
    {job.status==="waiting_parts"&&<p className="panel-footnote">This Workcard is waiting for parts. Keep the job notes up to date.</p>}
   </div>}
  </article>)}</div>:<p className="panel-footnote">No Workcards are currently assigned to you.</p>}
  {notice&&<p className="inline-notice" role="status">{notice}</p>}
 </section>;
}
