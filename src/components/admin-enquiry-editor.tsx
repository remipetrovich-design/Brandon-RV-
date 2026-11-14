"use client";
import {FormEvent,KeyboardEvent,useEffect,useState} from "react";
import AdminCreateQuote from "@/components/admin-create-quote";
import AdminCreateJob from "@/components/admin-create-job";
import AdminQuoteTools from "@/components/admin-quote-tools";
import AdminQuoteManagement from "@/components/admin-quote-management";
import AdminWorkcardManagement from "@/components/admin-workcard-management";
import AdminEnquiryTools from "@/components/admin-enquiry-tools";
import TicketConversation from "@/components/ticket-conversation";

type Staff={id:string;full_name:string;job_title:string|null};
type RecordData={id:string;request_number:string;request_type:string;contact_name:string;email:string;phone:string|null;location:string|null;vehicle_description:string|null;requested_service:string|null;description:string;preferred_contact:string|null;internal_notes:string|null;stage:string;archived_at:string|null;source:string|null;created_at:string;customer_id:string|null};
type Quote={id:string;quote_number:string;enquiry_id:string|null;revision_number:number;status:string;quote_kind?:string;total:number;created_at:string};
type LinkedCustomer={id:string;full_name:string;email:string|null;phone:string|null;address:string|null;suburb:string|null;state:string|null;postcode:string|null};
type Vehicle={id:string;make:string|null;model:string|null;year:number|null;vehicle_type:string|null;registration:string|null;vin:string|null;notes:string|null};
const stageGroups=[
 {label:"1 · Enquiry & assessment",values:["new","contacted","awaiting_information","assessment_required"]},
 {label:"2 · Quote & approval",values:["quote_in_progress","quote_sent","awaiting_approval","approved","workcard_created"]},
 {label:"3 · Parts procurement",values:["parts_required","parts_ordered","parts_received"]},
 {label:"4 · Booking & scheduling",values:["ready_to_schedule","booking_requested","booked"]},
 {label:"5 · Work & quality",values:["work_in_progress","quality_check","ready_to_invoice"]},
 {label:"6 · Invoice & payment",values:["invoiced","awaiting_payment","paid","completed"]},
 {label:"Other outcomes",values:["declined","cancelled","converted","closed"]}
];
const stages=stageGroups.flatMap(group=>group.values);
const localDateTime=(value:string|null|undefined)=>value?new Date(new Date(value).getTime()-new Date(value).getTimezoneOffset()*60000).toISOString().slice(0,16):"";
const pretty=(v:string)=>v?.replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase())??"";
const money=(v:number)=>new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD"}).format(Number(v||0));

export default function AdminEnquiryEditor({enquiryId,canManageEnquiries=true,canManageQuotes=false,canManageJobs=false,canManageBookings=false}:{enquiryId:string;canManageEnquiries?:boolean;canManageQuotes?:boolean;canManageJobs?:boolean;canManageBookings?:boolean}){
 const [record,setRecord]=useState<RecordData|null>(null),[customer,setCustomer]=useState<LinkedCustomer|null>(null),[vehicle,setVehicle]=useState<Vehicle|null>(null);
 const [staff,setStaff]=useState<Staff[]>([]),[assigned,setAssigned]=useState<string[]>([]),[history,setHistory]=useState<any[]>([]),[attachments,setAttachments]=useState<any[]>([]);
 const [quotes,setQuotes]=useState<Quote[]>([]),[workcard,setWorkcard]=useState<any>(null),[bookings,setBookings]=useState<any[]>([]),[bookingEdits,setBookingEdits]=useState<Record<string,{starts_at:string;location:string}>>({});
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[stageNote,setStageNote]=useState(""),[quotePanelOpen,setQuotePanelOpen]=useState(false),[confirmCancelId,setConfirmCancelId]=useState<string|null>(null),[confirmCloseStage,setConfirmCloseStage]=useState<string|null>(null),[selectedTab,setSelectedTab]=useState<"customer"|"request"|"conversation"|"attachments"|"activity"|"quote"|"workcard"|"booking">("customer");
 function handleTabKeyDown(event:KeyboardEvent<HTMLDivElement>){
  const tabIds=["customer","request","conversation","attachments","activity",...(isQuoteRequest?["quote","workcard","booking"]:[])];
  const current=tabIds.indexOf(selectedTab),key=event.key;
  const next=key==="ArrowRight"?tabIds[(current+1)%tabIds.length]:key==="ArrowLeft"?tabIds[(current-1+tabIds.length)%tabIds.length]:key==="Home"?tabIds[0]:key==="End"?tabIds[tabIds.length-1]:null;
  if(!next)return;
  event.preventDefault();setSelectedTab(next as typeof selectedTab);window.requestAnimationFrame(()=>document.getElementById("brv-tab-"+next)?.focus());
 }
 async function load(){
  try{
   const requests:[Promise<Response>,Promise<Response|null>]=[fetch("/api/admin/enquiries/"+enquiryId,{cache:"no-store"}),canManageQuotes?fetch("/api/admin/quotes",{cache:"no-store"}):Promise.resolve(null)];
   const [r,qr]=await Promise.all(requests),d=await r.json();
   if(!r.ok){setNotice(d.error??"Could not load Jobcard.");return;}
   setRecord(d.enquiry);setCustomer(d.customer??null);setVehicle(d.vehicle??null);setStaff(d.staff??[]);
   if(d.enquiry?.request_type==="quote_request"){const br=await fetch("/api/admin/enquiries/"+enquiryId+"/booking",{cache:"no-store"});const bd=await br.json();if(br.ok){const rows=bd.bookings??[];setBookings(rows);setBookingEdits(Object.fromEntries(rows.map((b:any)=>[b.id,{starts_at:localDateTime(b.starts_at??b.preferred_start),location:b.location??""}])));}else setNotice(bd.error??"Could not load booking requests.");}
   setAssigned((d.assignments??[]).map((x:any)=>x.staff_id));setHistory(d.history??[]);setAttachments(d.attachments??[]);
   if(qr){const qd=await qr.json();if(qr.ok){const ticketQuotes=(qd.quotes??[]).filter((q:Quote)=>q.enquiry_id===enquiryId&&(q.quote_kind??"standard")==="standard");setQuotes(ticketQuotes);const accepted=ticketQuotes.find((q:Quote)=>q.status==="accepted");if(accepted&&canManageJobs){const wr=await fetch("/api/admin/jobs?quoteId="+encodeURIComponent(accepted.id),{cache:"no-store"});const wd=await wr.json();if(wr.ok)setWorkcard(wd.existingWorkcard??null);}}}
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
 async function updateBooking(appointmentId:string,action:"confirm"|"reschedule"|"cancel"){
  const draft=bookingEdits[appointmentId];
  if(action==="cancel"&&confirmCancelId!==appointmentId){setConfirmCancelId(appointmentId);return;}
  if(action!=="cancel"&&(!draft?.starts_at||!draft.location.trim())){setNotice("Enter the booking start and service location.");return;}
  setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/admin/enquiries/"+enquiryId+"/booking",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({appointmentId,action,starts_at:draft?.starts_at?new Date(draft.starts_at).toISOString():null,ends_at:null,location:draft?.location??""})});
   const d=await r.json();if(!r.ok){setNotice(d.error??"Could not update booking.");return;}
   setConfirmCancelId(null);setNotice(action==="cancel"?"Booking cancelled.":action==="confirm"?"Booking confirmed and linked to the Workcard.":"Booking rescheduled and Workcard updated.");
   await load();
  }catch{setNotice("Could not update booking.");}finally{setBusy(false);}
 }
 async function changeStage(stage:string){
  if(!record)return;
  if(["closed","declined","cancelled"].includes(stage)&&confirmCloseStage!==stage){setConfirmCloseStage(stage);return;}
  setBusy(true);setNotice("");
  try{const r=await fetch("/api/admin/enquiries/"+enquiryId,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({stage,stage_note:stageNote||"Updated from Jobcard action"})});const d=await r.json();if(!r.ok){setNotice(d.error??"Could not update Jobcard status.");return;}setNotice("Jobcard status changed to "+pretty(stage)+".");setConfirmCloseStage(null);setStageNote("");await load();}
  catch{setNotice("Could not update Jobcard status.");}finally{setBusy(false);}
 }
 if(!record)return <section className="portal-panel"><p>{notice||"Loading Jobcard…"}</p></section>;
 const isQuoteRequest=record.request_type==="quote_request",acceptedQuote=quotes.find(q=>q.status==="accepted"),activeQuotes=[...quotes].sort((a,b)=>b.revision_number-a.revision_number);
 return <div className="brv-enquiry-editor brv-ticket-workspace brv-ticket-tabbed-workspace">
  <section className="portal-panel brv-ticket-summary">
   <div className="portal-panel-heading"><div><span className="panel-kicker">{isQuoteRequest?"CUSTOMER JOBCARD":"CUSTOMER ENQUIRY"} · {record.request_number}</span><h2>{record.requested_service||"Customer request"}</h2><p>{record.contact_name} · Received {new Date(record.created_at).toLocaleString("en-AU")} · {pretty(record.source??"website")}</p></div><span className="status-pill">{pretty(record.stage)}</span></div>
  </section>
  <div className="brv-ticket-tabs" role="tablist" aria-label="Request workspace" onKeyDown={handleTabKeyDown}>
   <button id="brv-tab-customer" type="button" role="tab" aria-selected={selectedTab==="customer"} aria-controls="brv-panel-customer" tabIndex={selectedTab==="customer"?0:-1} onClick={()=>setSelectedTab("customer")}>Customer &amp; Vehicle</button>
   <button id="brv-tab-request" type="button" role="tab" aria-selected={selectedTab==="request"} aria-controls="brv-panel-request" tabIndex={selectedTab==="request"?0:-1} onClick={()=>setSelectedTab("request")}>Job Request</button>
   <button id="brv-tab-conversation" type="button" role="tab" aria-selected={selectedTab==="conversation"} aria-controls="brv-panel-conversation" tabIndex={selectedTab==="conversation"?0:-1} onClick={()=>setSelectedTab("conversation")}>{record.request_type==="general_enquiry"?"Follow-up":"Conversation"}</button>
   <button id="brv-tab-attachments" type="button" role="tab" aria-selected={selectedTab==="attachments"} aria-controls="brv-panel-attachments" tabIndex={selectedTab==="attachments"?0:-1} onClick={()=>setSelectedTab("attachments")}>Attachments <span>{attachments.length}</span></button>
   <button id="brv-tab-activity" type="button" role="tab" aria-selected={selectedTab==="activity"} aria-controls="brv-panel-activity" tabIndex={selectedTab==="activity"?0:-1} onClick={()=>setSelectedTab("activity")}>Activity <span>{history.length}</span></button>
   {isQuoteRequest&&<button id="brv-tab-quote" type="button" role="tab" aria-selected={selectedTab==="quote"} aria-controls="brv-panel-quote" tabIndex={selectedTab==="quote"?0:-1} onClick={()=>setSelectedTab("quote")}>Quote <span>{quotes.length}</span></button>}
   {isQuoteRequest&&<button id="brv-tab-workcard" type="button" role="tab" aria-selected={selectedTab==="workcard"} aria-controls="brv-panel-workcard" tabIndex={selectedTab==="workcard"?0:-1} onClick={()=>setSelectedTab("workcard")}>Workcard</button>}
   {isQuoteRequest&&<button id="brv-tab-booking" type="button" role="tab" aria-selected={selectedTab==="booking"} aria-controls="brv-panel-booking" tabIndex={selectedTab==="booking"?0:-1} onClick={()=>setSelectedTab("booking")}>Booking <span>{bookings.filter(b=>["requested","confirmed","rescheduled"].includes(b.status)).length}</span></button>}
  </div>

  <section id="brv-panel-customer" className="portal-panel brv-ticket-tab-panel" role="tabpanel" aria-labelledby="brv-tab-customer" hidden={selectedTab!=="customer"}>
   <div className="portal-panel-heading"><div><span className="panel-kicker">CUSTOMER &amp; VEHICLE</span><h2>Customer details</h2><p>Contact details and vehicle information linked to this Jobcard.</p></div></div>
   <form className="auth-form brv-ticket-edit" noValidate onSubmit={save}>
    <div className="form-grid">
     <label>Customer name<input required value={record.contact_name??""} readOnly={!canManageEnquiries} onChange={e=>setRecord({...record,contact_name:e.target.value})}/></label>
     <label>Email<input required type="email" value={record.email??""} readOnly={!canManageEnquiries} onChange={e=>setRecord({...record,email:e.target.value})}/></label>
     <label>Phone<input value={record.phone??""} readOnly={!canManageEnquiries} onChange={e=>setRecord({...record,phone:e.target.value})}/></label>
     <label>Service location<input value={record.location??""} readOnly={!canManageEnquiries} onChange={e=>setRecord({...record,location:e.target.value})}/></label>
     <label>Preferred contact<select value={record.preferred_contact??"email"} disabled={!canManageEnquiries} onChange={e=>setRecord({...record,preferred_contact:e.target.value})}><option value="email">Email</option><option value="phone">Phone</option><option value="sms">SMS</option></select></label>
     <label>Vehicle details<input value={record.vehicle_description??""} readOnly={!canManageEnquiries} onChange={e=>setRecord({...record,vehicle_description:e.target.value})}/></label>
    </div>
    {vehicle&&<div className="brv-ticket-customer-grid"><div><small>Vehicle</small><strong>{[vehicle.year,vehicle.make,vehicle.model].filter(Boolean).join(" ")||"Vehicle details incomplete"}</strong><span>{vehicle.vehicle_type??"Vehicle type not recorded"}</span></div><div><small>Registration</small><strong>{vehicle.registration||"Not supplied"}</strong></div><div><small>VIN / chassis</small><strong>{vehicle.vin||"Not supplied"}</strong></div></div>}
    {vehicle?.notes&&<div className="brv-ticket-vehicle-notes"><span className="panel-kicker">VEHICLE NOTES</span><p>{vehicle.notes}</p></div>}
    {customer&&<div className="brv-ticket-linked-customer"><span className="panel-kicker">LINKED CUSTOMER RECORD</span><h3>{customer.full_name}</h3><p>{[customer.address,customer.suburb,customer.state,customer.postcode].filter(Boolean).join(", ")||"No postal address recorded"}</p><a className="text-link" href={"/admin/customers/"+customer.id}>Open customer record →</a></div>}
    {canManageEnquiries&&<button className="button button-primary" disabled={busy}>{busy?"Saving…":"Save customer details"}</button>}
   </form>
   {!customer&&canManageEnquiries&&<AdminEnquiryTools enquiryId={enquiryId} customerId={record.customer_id??null}/>}
  </section>

  <section id="brv-panel-request" className="portal-panel brv-ticket-tab-panel" role="tabpanel" aria-labelledby="brv-tab-request" hidden={selectedTab!=="request"}>
   <div className="portal-panel-heading"><div><span className="panel-kicker">JOB REQUEST</span><h2>Request details &amp; follow-up</h2><p>Manage the request, intake stage, staff follow-up and internal notes.</p></div></div>
   {canManageEnquiries&&<section className="brv-ticket-actions"><div><span className="panel-kicker">TICKET ACTIONS</span><h3>Move this request forward</h3></div><div className="brv-ticket-action-buttons">
    {record.stage==="new"&&<button className="button button-secondary" type="button" disabled={busy} onClick={()=>void changeStage("contacted")}>Mark contacted</button>}
    {["new","contacted"].includes(record.stage)&&<button className="button button-secondary" type="button" disabled={busy} onClick={()=>void changeStage("awaiting_information")}>Request information</button>}
    {["new","contacted","awaiting_information"].includes(record.stage)&&<button className="button button-secondary" type="button" disabled={busy} onClick={()=>void changeStage("assessment_required")}>Assessment required</button>}
    {isQuoteRequest&&["new","contacted","awaiting_information","assessment_required"].includes(record.stage)&&<button className="button button-primary" type="button" disabled={busy} onClick={()=>void changeStage("quote_in_progress")}>Start preparing quote</button>}
    {!["closed","declined","archived"].includes(record.stage)&&<button className="button button-secondary" type="button" disabled={busy} onClick={()=>void changeStage("closed")}>Close Jobcard</button>}{confirmCloseStage&&<div className="brv-inline-confirm" role="group" aria-label="Confirm Jobcard closure"><p>Closing this Jobcard revokes its guest access. This does not delete its history.</p><button className="button brv-action-danger" type="button" disabled={busy} onClick={()=>void changeStage(confirmCloseStage)}>Confirm close</button><button className="button button-secondary" type="button" disabled={busy} onClick={()=>setConfirmCloseStage(null)}>Keep open</button></div>}
   </div></section>}
   <form className="auth-form brv-ticket-edit" onSubmit={save}>
    <label>Pipeline status<select value={record.stage} disabled={!canManageEnquiries} onChange={e=>setRecord({...record,stage:e.target.value})}>{stageGroups.map(group=><optgroup key={group.label} label={group.label}>{group.values.map(stage=><option key={stage} value={stage}>{pretty(stage)}</option>)}</optgroup>)}</select></label><p className="panel-footnote">Stages follow the job from first enquiry through assessment, quote approval, parts, booking, work, quality checks, invoice and payment. Update the stage when each step is completed.</p>
    <label>Customer request<textarea rows={6} required value={record.description??""} readOnly={!canManageEnquiries} onChange={e=>setRecord({...record,description:e.target.value})}/></label>
    <fieldset className="brv-ticket-staff-fieldset" disabled={!canManageEnquiries}><legend>Assign staff to follow up</legend><p className="panel-footnote">Choose everyone responsible for contacting the customer. Workcard assignment happens separately after senior setup review.</p>
     {staff.length?<div className="brv-ticket-staff-options">{staff.map(s=><label className="brv-ticket-staff-option" key={s.id}><input type="checkbox" checked={assigned.includes(s.id)} onChange={e=>setAssigned(current=>e.target.checked?[...current,s.id]:current.filter(id=>id!==s.id))}/><span><strong>{s.full_name}</strong>{s.job_title&&<small>{s.job_title}</small>}</span></label>)}</div>:<p className="panel-footnote">No active staff are available for assignment.</p>}
    </fieldset>
    <label>Internal notes<textarea rows={4} value={record.internal_notes??""} readOnly={!canManageEnquiries} onChange={e=>setRecord({...record,internal_notes:e.target.value})}/></label>
    <label>Status change note (optional)<input value={stageNote} onChange={e=>setStageNote(e.target.value)} placeholder="Reason for changing the status"/></label>
    {canManageEnquiries&&<button className="button button-primary" disabled={busy}>{busy?"Saving…":"Save Job Request"}</button>}
   </form>
  </section>

  <section id="brv-panel-attachments" className="portal-panel brv-ticket-tab-panel" role="tabpanel" aria-labelledby="brv-tab-attachments" hidden={selectedTab!=="attachments"}>
   <section className="brv-ticket-attachments"><span className="panel-kicker">CUSTOMER ATTACHMENTS</span><h2>Files supplied with the request</h2>{attachments.length?attachments.map(f=><p key={f.id}><a href={f.url??"#"} target="_blank" rel="noreferrer">{f.file_name}</a> · {f.mime_type} · {Math.round(Number(f.size_bytes??0)/1024)} KB</p>):<p className="panel-footnote">No customer files attached.</p>}</section>
  </section>

  <section id="brv-panel-activity" className="portal-panel brv-ticket-tab-panel" role="tabpanel" aria-labelledby="brv-tab-activity" hidden={selectedTab!=="activity"}>
   <section className="brv-ticket-history"><span className="panel-kicker">ACTIVITY HISTORY</span><h2>Jobcard timeline</h2>{history.length?<div className="activity-list">{history.map(h=><article className="activity-item" key={h.id}><div className="activity-date">{new Date(h.created_at).toLocaleString("en-AU")}</div><div className="activity-copy"><strong>{h.from_stage?pretty(h.from_stage)+" → ":""}{pretty(h.to_stage)}</strong>{h.note&&<span>{h.note}</span>}</div></article>)}</div>:<p className="panel-footnote">No status changes recorded.</p>}</section>
  </section>

  <section id="brv-panel-conversation" className="portal-panel brv-ticket-tab-panel" role="tabpanel" aria-labelledby="brv-tab-conversation" hidden={selectedTab!=="conversation"}>
   {["customer_enquiry","quote_request"].includes(record.request_type)&&<TicketConversation ticketId={enquiryId} staff/>}
   {record.request_type==="general_enquiry"&&<><span className="panel-kicker">FOLLOW-UP</span><h2>Contact the customer directly</h2><p>General enquiries are handled by phone or email. Record call attempts and outcomes in internal notes; this record has no customer reply composer.</p></>}
  </section>

  {isQuoteRequest&&<section id="brv-panel-quote" className="portal-panel brv-ticket-tab-panel" role="tabpanel" aria-labelledby="brv-tab-quote" hidden={selectedTab!=="quote"}>
   <div className="portal-panel-heading"><div><span className="panel-kicker">QUOTE</span><h2>Quote history &amp; preparation</h2><p>Each revision is retained against this Jobcard. Issued quotes require separate senior approval.</p></div><button className="button button-primary" type="button" onClick={()=>setQuotePanelOpen(v=>!v)}>{quotePanelOpen?"Close quote form":"Create quote"}</button></div>
   {activeQuotes.length?activeQuotes.map(q=><article className="brv-ticket-quote" key={q.id}><div><strong>{q.quote_number} · Revision {q.revision_number}</strong><span>{pretty(q.status)} · {money(q.total)}</span><small>{new Date(q.created_at).toLocaleDateString("en-AU")}</small></div><AdminQuoteManagement quoteId={q.id}/><AdminQuoteTools quoteId={q.id}/></article>):<p className="panel-footnote">No quotes have been created for this Jobcard.</p>}
   {quotePanelOpen&&<div className="brv-ticket-quote-create"><AdminCreateQuote initialEnquiryId={enquiryId} onCreated={()=>void load()}/></div>}
   
  </section>}
  {isQuoteRequest&&<section id="brv-panel-workcard" className="portal-panel brv-ticket-tab-panel" role="tabpanel" aria-labelledby="brv-tab-workcard" hidden={selectedTab!=="workcard"}>
   <div className="portal-panel-heading"><div><span className="panel-kicker">WORKCARD</span><h2>Workshop job</h2><p>The worker-facing Workcard is managed separately from the customer quote and booking.</p></div></div>
   {acceptedQuote&&canManageJobs&&(workcard?<div className="brv-ticket-workcard-create"><span className="panel-kicker">WORKCARD CREATED</span><h3>{workcard.job_number} · {workcard.title}</h3><p>{pretty(workcard.status)} · Setup review: {pretty(workcard.workcard_review_status??"legacy_approved")}</p><a className="text-link" href={"/admin/jobs/"+workcard.id}>Open full Workcard →</a><AdminWorkcardManagement jobId={workcard.id} showBookingTab={false}/></div>:<div className="brv-ticket-workcard-create"><AdminCreateJob initialQuoteId={acceptedQuote.id} onCreated={()=>void load()}/></div>)}
   {acceptedQuote&&!canManageJobs&&<p className="panel-footnote">The quote has been accepted. A user with Workcard management permission can create the Workcard.</p>}
   {!acceptedQuote&&<p className="panel-footnote">A Workcard becomes available after the customer accepts a quote.</p>}
  </section>}
  {isQuoteRequest&&<section id="brv-panel-booking" className="portal-panel brv-ticket-tab-panel" role="tabpanel" aria-labelledby="brv-tab-booking" hidden={selectedTab!=="booking"}>
   <div className="portal-panel-heading"><div><span className="panel-kicker">BOOKING</span><h2>Booking requests &amp; appointments</h2><p>Manage each customer request here. Confirmations and changes synchronise to the linked Workcard.</p></div><a className="button button-secondary" href="/admin/appointments">Open bookings calendar →</a></div>
   {bookings.length?bookings.map(b=><article className="brv-ticket-quote booking-action" key={b.id}><div><strong>{pretty(b.status)} · {b.workcard?.job_number??"Workcard not created yet"}</strong><span>Customer preferred: {b.preferred_start?new Date(b.preferred_start).toLocaleString("en-AU"):"Not supplied"}</span><span>Confirmed: {b.starts_at?new Date(b.starts_at).toLocaleString("en-AU"):"Not confirmed"}</span><span>Location: {b.location??"Not supplied"}</span><span>Customer notes: {b.customer_notes??"None"}</span>{b.workcard&&<a className="text-link" href={"/admin/jobs/"+b.workcard.id}>Open linked Workcard →</a>}{!canManageBookings&&<p className="panel-footnote">View only. Booking changes require appointment management permission.</p>}
    {canManageBookings&&["requested","confirmed","rescheduled"].includes(b.status)&&<div className="brv-workcard-entry-form"><h3>{b.status==="requested"?"Confirm customer booking": "Change confirmed booking"}</h3><div className="form-grid"><label>Agreed start<input type="datetime-local" value={bookingEdits[b.id]?.starts_at??""} onChange={e=>setBookingEdits(v=>({...v,[b.id]:{...v[b.id],starts_at:e.target.value}}))}/></label></div><label>Service location<input value={bookingEdits[b.id]?.location??""} onChange={e=>setBookingEdits(v=>({...v,[b.id]:{...v[b.id],location:e.target.value}}))} maxLength={200}/></label><div className="brv-ticket-action-buttons">{b.status!=="confirmed"&&<button type="button" className="button button-primary" disabled={busy} onClick={()=>void updateBooking(b.id,"confirm")}>Confirm booking</button>}<button type="button" className="button button-secondary" disabled={busy} onClick={()=>void updateBooking(b.id,"reschedule")}>Reschedule booking</button>{confirmCancelId===b.id?<><button type="button" className="button brv-action-danger" disabled={busy} onClick={()=>void updateBooking(b.id,"cancel")}>Confirm cancellation</button><button type="button" className="button button-secondary" disabled={busy} onClick={()=>setConfirmCancelId(null)}>Keep booking</button></>:<button type="button" className="button button-secondary" disabled={busy} onClick={()=>void updateBooking(b.id,"cancel")}>Cancel booking</button>}</div></div>}
   </div></article>):<p className="panel-footnote">No booking requests or appointments are linked to this Jobcard yet.</p>}
  </section>}
  {notice&&<p className="inline-notice" role="status">{notice}</p>}
 </div>;
}
