import {notFound,redirect} from "next/navigation";
import {currentUser,database} from "@/lib/auth";
import Link from "next/link";
import TicketConversation from "@/components/ticket-conversation";
import CustomerWorkApproval from "@/components/customer-work-approval";
import CustomerJobcardBookingRequest from "@/components/customer-jobcard-booking-request";
import PrintDocumentButton from "@/components/print-document-button";
export const dynamic="force-dynamic";
const money=(v:number)=>new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD"}).format(Number(v||0));
const pretty=(v:string)=>String(v??"").replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());
export default async function JobcardDetailPage({params,searchParams}:{params:Promise<{id:string}>;searchParams?:Promise<{notice?:string}>}){
 const user=await currentUser();if(!user)redirect("/portal/sign-in");
 const {id}=await params;const db=database();
 const {data:jobcard,error}=await db.from("enquiries").select("id,request_number,request_type,contact_name,email,phone,location,vehicle_description,vehicle_id,requested_service,description,preferred_contact,status,stage,created_at,updated_at").eq("id",id).eq("user_id",user.id).eq("request_type","quote_request").maybeSingle();
 if(error||!jobcard)notFound();
 const [{data:quotes,error:quoteError},{data:appointments,error:appointmentError},{data:attachments,error:attachmentError}]=await Promise.all([
  db.from("quotes").select("id,quote_number,revision_number,status,quote_kind,variation_reason,job_id,issue_date,expiry_date,subtotal,tax_amount,total,notes,terms,quote_items(id,description,quantity,unit_price,line_total,item_type)").eq("enquiry_id",id).eq("user_id",user.id).order("revision_number",{ascending:false}),
  db.from("appointments").select("id,status,preferred_start,preferred_end,starts_at,ends_at,location,customer_notes,quote_id,vehicle_id,created_at").eq("enquiry_id",id).eq("user_id",user.id).order("created_at",{ascending:false}),
  db.from("enquiry_attachments").select("id,file_name,mime_type,size_bytes,storage_path,created_at").eq("enquiry_id",id).order("created_at",{ascending:false})
 ]);
 if(quoteError||appointmentError||attachmentError)throw new Error("Could not load the complete Jobcard.");
 const appointmentIds=(appointments??[]).map(x=>x.id);
 const quoteIds=(quotes??[]).map(x=>x.id);
 const jobSelect="id,job_number,title,status,work_summary,customer_approval_status,senior_approval_status,senior_approval_note,worker_signed_off_at,completed_at,scheduled_start,appointment_id,quote_id,customer_visible_notes";
 const [quoteLinkedJobs,appointmentLinkedJobs,vehicleResult]=await Promise.all([
  quoteIds.length?db.from("jobs").select(jobSelect).eq("user_id",user.id).in("quote_id",quoteIds).order("created_at",{ascending:false}):Promise.resolve({data:[]}),
  appointmentIds.length?db.from("jobs").select(jobSelect).eq("user_id",user.id).in("appointment_id",appointmentIds).order("created_at",{ascending:false}):Promise.resolve({data:[]}),
  jobcard.vehicle_id?db.from("vehicles").select("make,model,year,vehicle_type,registration,vin").eq("id",jobcard.vehicle_id).eq("customer_id",user.id).maybeSingle():Promise.resolve({data:null})
 ]);
 const jobsById=new Map<string,any>();
 for(const job of [...(quoteLinkedJobs.data??[]),...(appointmentLinkedJobs.data??[])])jobsById.set(job.id,job);
 const jobs=[...jobsById.values()];
 const vehicle=vehicleResult.data;
 const jobIds=jobs.map(x=>x.id);
 const [{data:entries},{data:invoices},{data:appointmentVehicle},{data:workPhotos}]=await Promise.all([
  jobIds.length?db.from("job_work_entries").select("id,job_id,entry_type,description,quantity,line_total,customer_visible").in("job_id",jobIds).eq("customer_visible",true).order("occurred_at"):Promise.resolve({data:[]}),
  jobIds.length?db.from("invoices").select("id,job_id,invoice_number,subtotal,tax_amount,total,status,issue_date,due_date,amount_paid,payments(id,amount,method,reference,paid_at,status),invoice_items(id,description,quantity,unit_price,line_total)").in("job_id",jobIds).order("created_at",{ascending:false}):Promise.resolve({data:[]}),
  !jobcard.vehicle_id&&appointmentIds.length?db.from("vehicles").select("make,model,year,vehicle_type,registration,vin").eq("customer_id",user.id).eq("id",(appointments??[]).find(x=>x.vehicle_id)?.vehicle_id??"00000000-0000-0000-0000-000000000000").maybeSingle():Promise.resolve({data:null}),
  jobIds.length?db.from("job_attachments").select("id,job_id,file_name,mime_type,storage_path").in("job_id",jobIds).eq("customer_visible",true).order("created_at",{ascending:false}):Promise.resolve({data:[]})
 ]);
 const signedAttachments=await Promise.all((attachments??[]).map(async file=>{const {data}=await db.storage.from("brandon-rv-private").createSignedUrl(file.storage_path,300);return {...file,url:data?.signedUrl??null};}));
 const quoteRows=quotes??[],bookingRows=appointments??[],jobRows=jobs;
 const invoiceByJob=new Map((invoices??[]).map(x=>[x.job_id,x]));
 const entriesByJob=new Map<string,any[]>();
 for(const entry of entries??[]){const rows=entriesByJob.get(entry.job_id)??[];rows.push(entry);entriesByJob.set(entry.job_id,rows);}
 const photosByJob=new Map<string,any[]>();
 for(const file of workPhotos??[]){const {data:signed}=await db.storage.from("brandon-rv-private").createSignedUrl(file.storage_path,300);const rows=photosByJob.get(file.job_id)??[];rows.push({...file,url:signed?.signedUrl??null});photosByJob.set(file.job_id,rows);}
 const selectedVehicle=vehicle??appointmentVehicle;
 const notice=(await searchParams)?.notice;
 return <div className="brv-jobcard-document">
  <div className="brv-jobcard-top-actions"><Link href="/portal/jobcards">← All Jobcards</Link><PrintDocumentButton/></div>
  <header className="brv-jobcard-header"><div><span className="panel-kicker">CUSTOMER JOBCARD · {jobcard.request_number}</span><h1>{jobcard.requested_service||"RV service request"}</h1><p>{selectedVehicle?[selectedVehicle.year,selectedVehicle.make,selectedVehicle.model].filter(Boolean).join(" "):jobcard.vehicle_description||"Vehicle details to be confirmed"}{selectedVehicle?.registration?" · "+selectedVehicle.registration:""}</p></div><span className="status-pill">{pretty(jobcard.stage||jobcard.status)}</span></header>
  {notice&&<p className="inline-notice" role="status">{notice==="accepted"?"Quote accepted. Your next step is to request a booking.":notice==="declined"?"Quote declined. This Jobcard has been closed and archived.":"Jobcard updated."}</p>}
  <section className="brv-jobcard-section"><div className="brv-jobcard-section-heading"><span>01</span><div><h2>Request details</h2><p>Original information supplied with your quote request.</p></div></div>
   <div className="brv-jobcard-facts"><div><small>Jobcard reference</small><strong>{jobcard.request_number}</strong></div><div><small>Submitted</small><strong>{new Date(jobcard.created_at).toLocaleString("en-AU")}</strong></div><div><small>Vehicle</small><strong>{selectedVehicle?[selectedVehicle.year,selectedVehicle.make,selectedVehicle.model].filter(Boolean).join(" "):jobcard.vehicle_description||"To be confirmed"}</strong></div><div><small>Registration</small><strong>{selectedVehicle?.registration||"Not supplied"}</strong></div><div><small>Location</small><strong>{jobcard.location||"To be confirmed"}</strong></div><div><small>Preferred contact</small><strong>{pretty(jobcard.preferred_contact||"email")}</strong></div></div>
   <div className="brv-jobcard-description"><strong>Requested work</strong><p>{jobcard.description}</p></div>
   {signedAttachments.length>0&&<div className="brv-jobcard-files"><strong>Submitted photos and documents</strong>{signedAttachments.map(file=><a key={file.id} href={file.url??"#"} target="_blank" rel="noreferrer">{file.file_name}</a>)}</div>}
  </section>
  <section className="brv-jobcard-section"><div className="brv-jobcard-section-heading"><span>02</span><div><h2>Quotes & decisions</h2><p>Every quote revision remains attached to this Jobcard.</p></div></div>
   {quoteRows.length?quoteRows.map(q=><article className="brv-jobcard-quote" key={q.id}><div className="brv-jobcard-quote-head"><div><strong>{q.quote_kind==="variation"?"Variation · ":""}{q.quote_number} · Revision {q.revision_number}</strong><small>{q.issue_date?"Issued "+new Date(q.issue_date).toLocaleDateString("en-AU"):"Draft"}{q.expiry_date?" · Expires "+new Date(q.expiry_date).toLocaleDateString("en-AU"):""}</small></div><span className="status-pill">{pretty(q.status)}</span></div>
    {q.quote_items?.length?<ul className="brv-jobcard-items">{q.quote_items.map(i=><li key={i.id}><span>{i.description}<small>{i.quantity} × {money(i.unit_price)}</small></span><strong>{money(i.line_total)}</strong></li>)}</ul>:<p className="panel-footnote">No itemised quote lines are available for this revision.</p>}
    {q.variation_reason&&<p><strong>Why this variation is needed:</strong> {q.variation_reason}</p>}{q.notes&&<p>{q.notes}</p>}{q.terms&&<p className="panel-footnote">{q.terms}</p>}
    <div className="brv-jobcard-totals"><div><span>Subtotal</span><strong>{money(q.subtotal)}</strong></div><div><span>GST</span><strong>{money(q.tax_amount)}</strong></div><div className="brv-jobcard-total"><span>Quote total</span><strong>{money(q.total)}</strong></div></div>
    {q.status==="sent"&&<div className="quote-actions brv-jobcard-quote-actions"><form action="/api/portal/quotes/respond" method="post"><input type="hidden" name="quoteId" value={q.id}/><input type="hidden" name="response" value="accepted"/><input type="hidden" name="returnTo" value={"/portal/jobcards/"+id}/><button className="button button-primary">{q.quote_kind==="variation"?"Approve additional work":"Accept quote"}</button></form><form action="/api/portal/quotes/respond" method="post"><input type="hidden" name="quoteId" value={q.id}/><input type="hidden" name="response" value="declined"/><input type="hidden" name="returnTo" value={"/portal/jobcards/"+id}/><label>Reason (optional)<input name="responseNote" maxLength={1000} placeholder="Not proceeding, timing, price, etc."/></label><button className="button button-secondary">{q.quote_kind==="variation"?"Decline variation":"Decline & close Jobcard"}</button></form></div>}
    {q.status==="accepted"&&q.quote_kind!=="variation"&&!bookingRows.some(a=>a.quote_id===q.id&&["requested","confirmed","rescheduled"].includes(a.status))&&<CustomerJobcardBookingRequest quoteId={q.id} quoteNumber={q.quote_number} vehicleId={jobcard.vehicle_id??null}/>}
   </article>):<p className="panel-footnote">The quote is being assessed. No quote has been issued yet.</p>}
  </section>
  <section className="brv-jobcard-section"><div className="brv-jobcard-section-heading"><span>03</span><div><h2>Booking & Workcard</h2><p>Requested visits, confirmed appointments and work progress.</p></div></div>
   {bookingRows.length?bookingRows.map(a=><article className="brv-jobcard-booking" key={a.id}><div><strong>{a.status==="confirmed"?"Confirmed booking":a.status==="requested"?"Booking request":pretty(a.status)}</strong><span>{a.starts_at?new Date(a.starts_at).toLocaleString("en-AU"):a.preferred_start?new Date(a.preferred_start).toLocaleString("en-AU"):"Date to be arranged"}{a.ends_at?" – "+new Date(a.ends_at).toLocaleTimeString("en-AU"):""}</span><small>{a.location||"Service location to be confirmed"}</small></div><span className="status-pill">{pretty(a.status)}</span></article>):<p className="panel-footnote">No booking has been requested yet. Accept a quote first, then request a preferred visit time.</p>}
   {jobRows.length?jobRows.map(j=>{const invoice=invoiceByJob.get(j.id)??null;return <div className="brv-jobcard-workcard" key={j.id}><div className="brv-jobcard-workcard-head"><div><strong>Workcard {j.job_number}</strong><small>{pretty(j.status)}{j.scheduled_start?" · "+new Date(j.scheduled_start).toLocaleDateString("en-AU"):""}</small></div><span className="status-pill">{j.senior_approval_status==="pending"?"Senior review":pretty(j.senior_approval_status||j.status)}</span></div><p>{j.customer_visible_notes||"Work updates will appear here as they are shared."}</p><CustomerWorkApproval jobId={j.id} jobNumber={j.job_number} summary={j.work_summary} approvalStatus={j.customer_approval_status??"not_ready"} seniorApprovalStatus={j.senior_approval_status} entries={entriesByJob.get(j.id)??[]} attachments={photosByJob.get(j.id)??[]} invoice={invoice?{...invoice,items:invoice.invoice_items??[]}:null} booking={bookingRows.find(a=>a.id===j.appointment_id)??null} quote={quoteRows.find(q=>q.id===j.quote_id)??null} vehicle={selectedVehicle}/></div>; }):<p className="panel-footnote">After you accept a quote, Brandon RV prepares and reviews the Workcard. Your visit is scheduled and confirmed separately.</p>}
  </section>
  <section className="brv-jobcard-section brv-jobcard-messages"><div className="brv-jobcard-section-heading"><span>04</span><div><h2>Discussion & updates</h2><p>Messages about this Jobcard stay in one thread.</p></div></div><TicketConversation ticketId={id}/></section>
  <footer className="brv-jobcard-footer"><span>Brandon RV · Tamworth NSW</span><span>{jobcard.request_number} · Updated {new Date(jobcard.updated_at).toLocaleDateString("en-AU")}</span></footer>
 </div>;
}
