"use client";
import {useState} from "react";
type Review={id:string;quote_number:string;status:string;prepared_by:string|null;senior_approval_status:string;senior_approved_at:string|null;senior_approval_note:string|null;issue_date:string|null};
type Line={id?:string;description:string;quantity:number;unit_price:number;tax_rate:number};
type Editable={quote:Review&{expiry_date:string|null;notes:string|null;terms:string|null};items:Line[]};
export default function AdminQuoteTools({quoteId}:{quoteId:string}){
 const [review,setReview]=useState<Review|null>(null),[editable,setEditable]=useState<Editable|null>(null);
 const [note,setNote]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[editing,setEditing]=useState(false);
 async function load(){
  try{const m=await fetch("/api/admin/quotes/"+quoteId+"/manage",{cache:"no-store"});const md=await m.json();if(!m.ok){setNotice(md.error??"Could not load quote details.");return;}const r=await fetch("/api/admin/quotes/"+quoteId+"/approval",{cache:"no-store"});const d=await r.json();setReview(r.ok?d.quote:md.quote);setEditable(md);setLoaded(true);}
  catch{setNotice("Could not load quote details.");}
 }
 async function decide(decision:"approved"|"changes_requested"){
  if(decision==="changes_requested"&&note.trim().length<5){setNotice("Describe the changes required.");return;}
  setBusy(true);setNotice("");
  try{const r=await fetch("/api/admin/quotes/"+quoteId+"/approval",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision,note})});const d=await r.json();if(!r.ok){setNotice(d.error??"Could not save quote review.");return;}setNotice(decision==="approved"?"Senior approval recorded. The quote can now be issued.":"Quote returned for revision.");setNote("");await load();}
  catch{setNotice("Could not save quote review.");}finally{setBusy(false);}
 }
 async function issue(){
  setBusy(true);setNotice("");
  try{const r=await fetch("/api/admin/quotes/"+quoteId,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"sent"})});const d=await r.json();if(!r.ok){setNotice(d.error??"Could not issue quote.");return;}setNotice("Quote issued to the customer.");await load();}
  catch{setNotice("Could not issue quote.");}finally{setBusy(false);}
 }
 async function save(){
  if(!editable)return;setBusy(true);setNotice("");
  try{const r=await fetch("/api/admin/quotes/"+quoteId+"/manage",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:editable.items,expiryDate:editable.quote.expiry_date,notes:editable.quote.notes,terms:editable.quote.terms})});const d=await r.json();if(!r.ok){setNotice(d.error??"Could not save quote.");return;}setNotice("Quote updated. Senior approval has been reset and must be completed again.");setEditing(false);await load();}
  catch{setNotice("Could not save quote.");}finally{setBusy(false);}
 }
 async function remove(){
  if(!window.confirm("Permanently delete this draft quote? This cannot be undone."))return;
  setBusy(true);setNotice("");
  try{const r=await fetch("/api/admin/quotes/"+quoteId+"/manage",{method:"DELETE"});const d=await r.json();if(!r.ok){setNotice(d.error??"Could not delete quote.");return;}setNotice("Draft quote deleted.");setReview({...review!,status:"deleted"});}
  catch{setNotice("Could not delete quote.");}finally{setBusy(false);}
 }
 function updateLine(index:number,key:keyof Line,value:string){if(!editable)return;setEditable({...editable,items:editable.items.map((line,i)=>i===index?{...line,[key]:key==="description"?value:Number(value)}:line)});}
 return <details className="brv-admin-quote-tools" onToggle={e=>{if(e.currentTarget.open&&!loaded)void load();}}>
  <summary>Quote controls</summary><div className="brv-admin-quote-tools-content">
   {!loaded&&<p className="panel-footnote">Open to load quote controls.</p>}
   {review&&review.status!=="deleted"&&editable&&<>
    <div className="brv-admin-quote-status"><strong>{review.quote_number}</strong><span>{review.status.replaceAll("_"," ")} · {review.senior_approval_status.replaceAll("_"," ")}</span></div>
    {review.status==="draft"&&<div className="brv-admin-quote-actions"><button className="button button-secondary" disabled={busy} onClick={()=>setEditing(v=>!v)}>{editing?"Cancel edit":"Edit quote"}</button><button className="button button-secondary" disabled={busy} onClick={()=>void remove()}>Delete draft</button></div>}
    {editing&&<div className="auth-form"><strong>Edit quote lines</strong>{editable.items.map((line,index)=><div className="brv-quote-line" key={line.id??index}><label>Description<input value={line.description} onChange={e=>updateLine(index,"description",e.target.value)}/></label><div className="form-grid"><label>Quantity<input type="number" min="0.01" step="0.01" value={line.quantity} onChange={e=>updateLine(index,"quantity",e.target.value)}/></label><label>Unit price<input type="number" min="0" step="0.01" value={line.unit_price} onChange={e=>updateLine(index,"unit_price",e.target.value)}/></label><label>Tax rate (%)<input type="number" min="0" max="100" step="0.01" value={line.tax_rate} onChange={e=>updateLine(index,"tax_rate",e.target.value)}/></label></div><button type="button" className="text-link" onClick={()=>setEditable({...editable,items:editable.items.filter((_,i)=>i!==index)})} disabled={editable.items.length===1}>Remove line</button></div>)}<button type="button" className="button button-secondary" onClick={()=>setEditable({...editable,items:[...editable.items,{description:"",quantity:1,unit_price:0,tax_rate:editable.items[0]?.tax_rate??0}]})} disabled={editable.items.length>=30}>+ Add line</button><label>Expiry date<input type="date" value={editable.quote.expiry_date??""} onChange={e=>setEditable({...editable,quote:{...editable.quote,expiry_date:e.target.value||null}})}/></label><label>Notes<textarea rows={2} value={editable.quote.notes??""} onChange={e=>setEditable({...editable,quote:{...editable.quote,notes:e.target.value}})}/></label><label>Terms<textarea rows={2} value={editable.quote.terms??""} onChange={e=>setEditable({...editable,quote:{...editable.quote,terms:e.target.value}})}/></label><button className="button button-primary" type="button" disabled={busy||!editable.items.length||editable.items.some(x=>x.description.trim().length<3||x.quantity<=0||x.unit_price<0)} onClick={()=>void save()}>Save quote changes</button></div>}
    {review.status==="draft"&&review.senior_approval_status==="pending"&&<><label>Senior review note<textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} maxLength={2000} placeholder="Corrections required, or approval notes."/></label><div className="brv-admin-quote-actions"><button className="button button-primary" disabled={busy} onClick={()=>void decide("approved")}>Approve quote</button><button className="button button-secondary" disabled={busy||note.trim().length<5} onClick={()=>void decide("changes_requested")}>Return for revision</button></div></>}
    {review.status==="draft"&&["approved","legacy_approved"].includes(review.senior_approval_status)&&<><p className="inline-notice">Senior approval recorded. {review.senior_approved_at?new Date(review.senior_approved_at).toLocaleString("en-AU"):""}</p><button className="button button-primary" disabled={busy} onClick={()=>void issue()}>Issue quote to customer</button></>}
    {review.senior_approval_status==="changes_requested"&&<p className="panel-footnote">Returned for revision: {review.senior_approval_note??"Create a revised draft quote for this Jobcard."}</p>}
    {review.status==="sent"&&<p className="inline-notice">Quote issued {review.issue_date?new Date(review.issue_date).toLocaleDateString("en-AU"):""}.</p>}
    {["sent","accepted","converted"].includes(review.status)&&<p className="panel-footnote">This quote is retained as a customer-facing record. Create a revision to change its terms; accepted quotes can be converted into Workcards.</p>}
   </>}
   {notice&&<p className="inline-notice" role="status">{notice}</p>}
  </div>
 </details>;
}
