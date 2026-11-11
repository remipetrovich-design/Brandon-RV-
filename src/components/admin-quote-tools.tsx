"use client";
import {useState} from "react";
type Review={id:string;quote_number:string;status:string;prepared_by:string|null;senior_approval_status:string;senior_approved_at:string|null;senior_approval_note:string|null;issue_date:string|null};
export default function AdminQuoteTools({quoteId}:{quoteId:string}){
 const [review,setReview]=useState<Review|null>(null);const [preparedByCurrentUser,setPreparedByCurrentUser]=useState(false);
 const [note,setNote]=useState("");const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);const [loaded,setLoaded]=useState(false);
 async function load(){
  try{const r=await fetch("/api/admin/quotes/"+quoteId+"/approval",{cache:"no-store"});const d=await r.json();if(!r.ok){setNotice(d.error??"Could not load quote review.");return;}setReview(d.quote);setPreparedByCurrentUser(d.preparedByCurrentUser===true);setLoaded(true);}
  catch{setNotice("Could not load quote review.");}
 }
 async function decide(decision:"approved"|"changes_requested"){
  if(decision==="changes_requested"&&note.trim().length<5){setNotice("Describe the changes required.");return;}
  setBusy(true);setNotice("");
  try{const r=await fetch("/api/admin/quotes/"+quoteId+"/approval",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision,note})});const d=await r.json();if(!r.ok){setNotice(d.error??"Could not save quote review.");return;}setNotice(decision==="approved"?"Senior approval recorded. The quote can now be issued.":"Quote returned for revision.");setNote("");await load();}
  catch{setNotice("Could not save quote review.");}
  finally{setBusy(false);}
 }
 async function issue(){
  setBusy(true);setNotice("");
  try{const r=await fetch("/api/admin/quotes/"+quoteId,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"sent"})});const d=await r.json();if(!r.ok){setNotice(d.error??"Could not issue quote.");return;}setNotice("Quote issued to the customer.");await load();}
  catch{setNotice("Could not issue quote.");}
  finally{setBusy(false);}
 }
 return <details className="brv-admin-quote-tools" onToggle={e=>{if(e.currentTarget.open&&!loaded)void load();}}>
  <summary>Quote review & issue</summary>
  <div className="brv-admin-quote-tools-content">
   {!loaded&&<p className="panel-footnote">Open to load quote review.</p>}
   {review&&<><div className="brv-admin-quote-status"><strong>{review.quote_number}</strong><span>{review.status.replaceAll("_"," ")} · {review.senior_approval_status.replaceAll("_"," ")}</span></div>
    {review.status==="draft"&&review.senior_approval_status==="pending"&&(preparedByCurrentUser?<p className="panel-footnote">A different authorised senior staff member must review this quote.</p>:<><label>Senior review note<textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} maxLength={2000} placeholder="Corrections required, or approval notes."/></label><div className="brv-admin-quote-actions"><button className="button button-primary" disabled={busy} onClick={()=>void decide("approved")}>Approve quote</button><button className="button button-secondary" disabled={busy||note.trim().length<5} onClick={()=>void decide("changes_requested")}>Return for revision</button></div></>)}
    {review.status==="draft"&&["approved","legacy_approved"].includes(review.senior_approval_status)&&<><p className="inline-notice">{review.senior_approval_status==="approved"?"Senior approval recorded.":"Legacy quote approval retained."} {review.senior_approved_at?new Date(review.senior_approved_at).toLocaleString("en-AU"):""}</p><button className="button button-primary" disabled={busy} onClick={()=>void issue()}>Issue quote to customer</button></>}
    {review.senior_approval_status==="changes_requested"&&<p className="panel-footnote">Returned for revision: {review.senior_approval_note??"Create a revised draft quote for this Jobcard."}</p>}
    {review.status==="sent"&&<p className="inline-notice">Quote issued {review.issue_date?new Date(review.issue_date).toLocaleDateString("en-AU"):""}.</p>}
   </>}
   {notice&&<p className="inline-notice" role="status">{notice}</p>}
  </div>
 </details>;
}
