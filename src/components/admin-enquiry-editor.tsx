"use client";
import {FormEvent,useEffect,useState} from "react";
import AdminCreateQuote from "@/components/admin-create-quote";
import AdminCreateJob from "@/components/admin-create-job";
import AdminQuoteTools from "@/components/admin-quote-tools";
import AdminEnquiryTools from "@/components/admin-enquiry-tools";

type Staff={id:string;full_name:string;job_title:string|null};
type RecordData={id:string;request_number:string;request_type:string;contact_name:string;email:string;phone:string|null;location:string|null;vehicle_description:string|null;requested_service:string|null;description:string;preferred_contact:string|null;internal_notes:string|null;stage:string;archived_at:string|null;source:string|null;created_at:string;customer_id:string|null};
type Quote={id:string;quote_number:string;enquiry_id:string|null;revision_number:number;status:string;total:number;created_at:string};
type LinkedCustomer={id:string;full_name:string;email:string|null;phone:string|null;address:string|null;suburb:string|null;state:string|null;postcode:string|null};
type Vehicle={id:string;make:string|null;model:string|null;year:number|null;vehicle_type:string|null;registration:string|null;vin:string|null;notes:string|null};
const stages=["new","contacted","awaiting_information","assessment_required","quote_in_progress","quote_sent","awaiting_approval","approved","declined","converted","closed"];
const pretty=(v:string)=>v?.replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase())??"";
const money=(v:number)=>new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD"}).format(Number(v||0));

export default function AdminEnquiryEditor({enquiryId,canManageEnquiries=true,canManageQuotes=false,canManageJobs=false}:{enquiryId:string;canManageEnquiries?:boolean;canManageQuotes?:boolean;canManageJobs?:boolean}){
 const [record,setRecord]=useState<RecordData|null>(null),[customer,setCustomer]=useState<LinkedCustomer|null>(null),[vehicle,setVehicle]=useState<Vehicle|null>(null);
 const [staff,setStaff]=useState<Staff[]>([]),[assigned,setAssigned]=useState<string[]>([]),[history,setHistory]=useState<any[]>([]),[attachments,setAttachments]=useState<any[]>([]);
 const [quotes,setQuotes]=useState<Quote[]>([]),[workcard,setWorkcard]=useState<any>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[stageNote,setStageNote]=useState(""),[quotePanelOpen,setQuotePanelOpen]=useState(false);
 async function load(){
  try{
   const requests:[Promise<Response>,Promise<Response|null>]=[fetch("/api/admin/enquiries/"+enquiryId,{cache:"no-store"}),canManageQuotes?fetch("/api/admin/quotes",{cache:"no-store"}):Promise.resolve(null)];
   const [r,qr]=await Promise.all(requests),d=await r.json();
   if(!r.ok){setNotice(d.error??"Could not load Jobcard.");return;}
   setRecord(d.enquiry);setCustomer(d.customer??null);setVehicle(d.vehicle??null);setStaff(d.staff??[]);
   setAssigned((d.assignments??[]).map((x:any)=>x.staff_id));setHistory(d.history??[]);setAttachments(d.attachments??[]);
   if(qr){const qd=await qr.json();if(qr.ok)setQuotes((qd.quotes??[]).filter((q:Quote)=>q.enquiry_id===enquiryId));}
  }catch{setNotice("Could not load Jobcard details.");}
 }
 useEffect(()=>{void load();},[enquiryId]);
 async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!record)return;setBusy(true);setNotice("");try{
  const r=await fetch("/api/admin/enquiries/"+enquiryId,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...record,stage_note:stageNote})}),d=await r.json();
  if(!r.ok){setNotice(d.error??"Could not save Jobcard changes.");return;}
  const a=await fetch("/api/admin/enquiries/"+enquiryId+"/assign",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({staffIds:assigned})}),ad=await a.json();
  if(!a.ok){setNotice("Jobcard changes saved, but staff assignments failed: "+(ad.error??"Unknown error"));await load();return;}
  setNotice("Jobcard details and assignments saved.");setStageNote("");await load();
 }catch{setNotice("Could not save Jobcard changes.");}finally{setBusy(false);}}
 async function changeStage(stage:string){
  if(!record)return;
  if(["closed","declined"].includes(stage)&&!window.confirm("This will close the Jobcard and revoke its guest access. Continue?"))return;
  setBusy(true);setNotice("");
  try{const r=await fetch("/api/admin/enquiries/"+enquiryId,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({stage,stage_note:stageNote||"Updated from Jobcard action"})});const d=await r.json();if(!r.ok){setNotice(d.error??"Could not update Jobcard status.");return;}setNotice("Jobcard status changed to "+pretty(stage)+".");setStageNote("");await load();}
  catch{setNotice("Could not update Jobcard status.");}finally{setBusy(false);}
 }
 if(!record)return <section className="portal-panel"><p>{notice||"Loading Jobcard…"}</p></section>;
 const isQuoteRequest=record.request_type==="quote_request",acceptedQuote=quotes.find(q=>q.status==="accepted"),activeQuotes=[...quotes].sort((a,b)=>b.revision_number-a.revision_number);
 return <div className="brv-enquiry-editor brv-ticket-workspace">
  <section className="portal-panel brv-ticket-summary"><div className="portal-panel-heading"><div><span className="panel-kicker">{isQuoteRequest?"CUSTOMER JOBCARD":"CUSTOMER ENQUIRY"} · {record.request_number}</span><h2>{record.requested_service||"Customer request"}</h2><p>Received {new Date(record.created_at).toLocaleString("en-AU")} · {pretty(record.source??"website")}</p></div><span className="status-pill">{pretty(record.stage)}</span></div>
   <div className="brv-ticket-customer-grid"><div><small>Customer</small><strong>{record.contact_name}</strong><a href={"mailto:"+record.email}>{record.email}</a>{record.phone&&<a href={"tel:"+record.phone}>{record.phone}</a>}</div><div><small>Vehicle</small><strong>{vehicle?[vehicle.year,vehicle.make,vehicle.model].filter(Boolean).join(" "):record.vehicle_description||"Not supplied"}</strong><span>{vehicle?.vehicle_type??"Vehicle type not confirmed"}{vehicle?.registration?" · "+vehicle.registration:""}</span>{vehicle?.vin&&<span>VIN {vehicle.vin}</span>}</div><div><small>Service location</small><strong>{record.location||"To be confirmed"}</strong><span>Preferred contact: {pretty(record.preferred_contact??"email")}</span></div></div>
   <div className="brv-ticket-request"><span className="panel-kicker">CUSTOMER REQUEST</span><p>{record.description}</p></div>
  </section>
  {customer&&<section className="portal-panel brv-ticket-linked-customer"><div><span className="panel-kicker">LINKED CUSTOMER RECORD</span><h3>{customer.full_name}</h3><p>{[customer.address,customer.suburb,customer.state,customer.postcode].filter(Boolean).join(", ")||"No postal address recorded"}</p></div><a className="text-link" href={"/admin/customers/"+customer.id}>Open customer record →</a></section>}
  {vehicle?.notes&&<section className="portal-panel"><span className="panel-kicker">VEHICLE NOTES</span><p>{vehicle.notes}</p></section>}
  {canManageEnquiries&&<section className="portal-panel brv-ticket-actions"><div><span className="panel-kicker">TICKET ACTIONS</span><h3>Move this request forward</h3></div><div className="brv-ticket-action-buttons">
   {record.stage==="new"&&<button className="button button-secondary" type="button" disabled={busy} onClick={()=>void changeStage("contacted")}>Mark contacted</button>}
   {["new","contacted"].includes(record.stage)&&<button className="button button-secondary" type="button" disabled={busy} onClick={()=>void changeStage("awaiting_information")}>Request information</button>}
   {["new","contacted","awaiting_information"].includes(record.stage)&&<button className="button button-secondary" type="button" disabled={busy} onClick={()=>void changeStage("assessment_required")}>Assessment required</button>}
   {isQuoteRequest&&["new","contacted","awaiting_information","assessment_required"].includes(record.stage)&&<button className="button button-primary" type="button" disabled={busy} onClick={()=>void changeStage("quote_in_progress")}>Start preparing quote</button>}
   {!["closed","declined","archived"].includes(record.stage)&&<button className="button button-secondary" type="button" disabled={busy} onClick={()=>void changeStage("closed")}>Close ticket</button>}
  </div></section>}
  {isQuoteRequest&&canManageQuotes&&<section className="portal-panel brv-ticket-quotes"><div className="portal-panel-heading"><div><span className="panel-kicker">QUOTES ATTACHED TO THIS JOBCARD</span><h2>Quote history</h2></div><button className="button button-primary" type="button" onClick={()=>setQuotePanelOpen(v=>!v)}>{quotePanelOpen?"Close quote form":"Create quote"}</button></div>
   {activeQuotes.length?activeQuotes.map(q=><article className="brv-ticket-quote" key={q.id}><div><strong>{q.quote_number} · Revision {q.revision_number}</strong><span>{pretty(q.status)} · {money(q.total)}</span><small>{new Date(q.created_at).toLocaleDateString("en-AU")}</small></div><AdminQuoteTools quoteId={q.id}/></article>):<p className="panel-footnote">No quotes have been created for this Jobcard.</p>}
   {quotePanelOpen&&<div className="brv-ticket-quote-create"><AdminCreateQuote initialEnquiryId={enquiryId} onCreated={()=>void load()}/></div>}
   {acceptedQuote&&canManageJobs&&<div className="brv-ticket-workcard-create"><AdminCreateJob initialQuoteId={acceptedQuote.id}/></div>}
   {acceptedQuote&&!canManageJobs&&<p className="panel-footnote">The quote has been accepted. A user with Workcard management permission can create the Workcard.</p>}
  </section>}
  {isQuoteRequest&&canManageJobs&&!acceptedQuote&&<section className="portal-panel"><span className="panel-kicker">WORKCARD</span><p>A Workcard becomes available after the customer accepts a quote.</p></section>}
  <AdminEnquiryTools enquiryId={enquiryId} customerId={record.customer_id??null}/>
  <form className="portal-panel auth-form brv-ticket-edit" onSubmit={save}>
   <div className="portal-panel-heading"><div><span className="panel-kicker">RECORD MANAGEMENT</span><h2>Update Jobcard details</h2></div><span>{record.archived_at?"Archived":pretty(record.stage)}</span></div>
   <div className="form-grid"><label>Pipeline status<select value={record.stage} disabled={!canManageEnquiries} onChange={e=>setRecord({...record,stage:e.target.value})}>{stages.map(s=><option key={s} value={s}>{pretty(s)}</option>)}</select></label><label>Preferred contact<select value={record.preferred_contact??"email"} disabled={!canManageEnquiries} onChange={e=>setRecord({...record,preferred_contact:e.target.value})}><option value="email">Email</option><option value="phone">Phone</option><option value="sms">SMS</option></select></label><label>Customer name<input required value={record.contact_name??""} readOnly={!canManageEnquiries} onChange={e=>setRecord({...record,contact_name:e.target.value})}/></label><label>Email<input required type="email" value={record.email??""} readOnly={!canManageEnquiries} onChange={e=>setRecord({...record,email:e.target.value})}/></label><label>Phone<input value={record.phone??""} readOnly={!canManageEnquiries} onChange={e=>setRecord({...record,phone:e.target.value})}/></label><label>Requested service<input value={record.requested_service??""} readOnly={!canManageEnquiries} onChange={e=>setRecord({...record,requested_service:e.target.value})}/></label><label>Service location<input value={record.location??""} readOnly={!canManageEnquiries} onChange={e=>setRecord({...record,location:e.target.value})}/></label><label>Vehicle details<input value={record.vehicle_description??""} readOnly={!canManageEnquiries} onChange={e=>setRecord({...record,vehicle_description:e.target.value})}/></label></div>
   <label>Request details<textarea rows={5} required value={record.description??""} readOnly={!canManageEnquiries} onChange={e=>setRecord({...record,description:e.target.value})}/></label>
   <label>Assign staff<select multiple value={assigned} disabled={!canManageEnquiries} onChange={e=>setAssigned(Array.from(e.target.selectedOptions).map(o=>o.value))}>{staff.map(s=><option key={s.id} value={s.id}>{s.full_name}{s.job_title?" · "+s.job_title:""}</option>)}</select><small>Staff can be assigned to follow up this ticket. Workcard assignment is a separate step after senior review.</small></label>
   <label>Internal notes<textarea rows={3} value={record.internal_notes??""} readOnly={!canManageEnquiries} onChange={e=>setRecord({...record,internal_notes:e.target.value})}/></label>
   <label>Status change note (optional)<input value={stageNote} onChange={e=>setStageNote(e.target.value)} placeholder="Reason for changing the status"/></label>
   {canManageEnquiries&&<button className="button button-primary" disabled={busy}>Save Jobcard changes</button>}
  </form>
  <section className="portal-panel"><span className="panel-kicker">CUSTOMER ATTACHMENTS</span><h2>Files supplied with the request</h2>{attachments.length?attachments.map(f=><p key={f.id}><a href={f.url??"#"} target="_blank" rel="noreferrer">{f.file_name}</a> · {f.mime_type} · {Math.round(Number(f.size_bytes??0)/1024)} KB</p>):<p className="panel-footnote">No customer files attached.</p>}</section>
  <section className="portal-panel"><span className="panel-kicker">ACTIVITY HISTORY</span><h2>Ticket timeline</h2>{history.length?<div className="activity-list">{history.map(h=><article className="activity-item" key={h.id}><div className="activity-date">{new Date(h.created_at).toLocaleString("en-AU")}</div><div className="activity-copy"><strong>{h.from_stage?pretty(h.from_stage)+" → ":""}{pretty(h.to_stage)}</strong>{h.note&&<span>{h.note}</span>}</div></article>)}</div>:<p className="panel-footnote">No status changes recorded.</p>}</section>
  {notice&&<p className="inline-notice" role="status">{notice}</p>}
 </div>;
}
