"use client";
import {FormEvent,useCallback,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
type Quote={id:string;quote_number:string;total:number;revision_number:number;users:{full_name:string}|null;enquiries:{contact_name:string;request_number:string;request_type:string}|null;quote_items:{description:string;quantity:number;unit_price:number}[];existingWorkcard?:{id:string;job_number:string;title:string;status:string;senior_approval_status:string}|null};
const money=(v:number)=>new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD"}).format(Number(v||0));
export default function AdminCreateJob({initialQuoteId=""}:{initialQuoteId?:string}){
 const [quotes,setQuotes]=useState<Quote[]>([]),[quoteId,setQuoteId]=useState(initialQuoteId),[title,setTitle]=useState(""),[scope,setScope]=useState(""),[notice,setNotice]=useState(""),[loadError,setLoadError]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const router=useRouter();
 const loadQuotes=useCallback(async()=>{
  setLoading(true);setLoadError("");
  try{const url="/api/admin/jobs"+(initialQuoteId?"?quoteId="+encodeURIComponent(initialQuoteId):"");const r=await fetch(url,{cache:"no-store"}),d=await r.json();if(!r.ok){setLoadError(d.error??"Could not load accepted quotes.");return;}setQuotes(d.acceptedQuotes??[]);}
  catch{setLoadError("Could not load accepted quotes. Check the connection and try again.");}
  finally{setLoading(false);}
 },[initialQuoteId]);
 useEffect(()=>{void loadQuotes();},[loadQuotes]);
 function chooseQuote(id:string){setQuoteId(id);const q=quotes.find(item=>item.id===id);if(q){setTitle("Work for "+q.quote_number);setScope((q.quote_items??[]).map(item=>item.description+" (Qty "+item.quantity+" × "+money(item.unit_price)+")").join("\n"));}}
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setNotice("");try{
  const r=await fetch("/api/admin/jobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({quoteId,title,scope})}),d=await r.json();
  if(!r.ok){setNotice(d.error??"Could not create Workcard.");return;}
  setNotice(d.alreadyCreated?"This accepted quote already has Workcard "+d.job.job_number+".":"Workcard "+d.job.job_number+" created. It is awaiting senior setup review before assignment.");
  await loadQuotes();router.refresh();
 }catch{setNotice("Could not create Workcard.");}finally{setBusy(false);}}
 const selected=quotes.find(q=>q.id===quoteId);
 if(selected?.existingWorkcard)return <section className="portal-panel"><span className="panel-kicker">WORKCARD CREATED</span><h3>{selected.existingWorkcard.job_number} · {selected.existingWorkcard.title}</h3><p>{selected.existingWorkcard.status.replaceAll("_"," ")} · Setup review: {selected.existingWorkcard.senior_approval_status.replaceAll("_"," ")}</p><a className="text-link" href="/admin/jobs">Open Workcards →</a></section>;
 return <section className="portal-panel"><span className="panel-kicker">NEW WORKCARD</span><h2>Create a Workcard from an accepted quote</h2>
  {loading?<p className="panel-footnote" role="status">Loading accepted quotes…</p>:loadError?<div className="inline-notice" role="alert"><p>{loadError}</p><button type="button" className="button button-secondary" onClick={()=>void loadQuotes()}>Retry loading accepted quotes</button></div>:quotes.length?<form className="auth-form" onSubmit={submit}>
   <label>Customer-accepted quote<select value={quoteId} onChange={e=>chooseQuote(e.target.value)} required><option value="">Select an accepted quote</option>{quotes.map(q=><option key={q.id} value={q.id}>{q.quote_number} · {q.enquiries?.request_number??"Jobcard"} · {q.users?.full_name??q.enquiries?.contact_name??"Customer"} · {money(q.total)}</option>)}</select></label>
   {selected&&<p className="panel-footnote">Customer accepted Revision {selected.revision_number}. The Workcard will retain this exact quote as its approved source.</p>}
   <label>Workcard title<input value={title} onChange={e=>setTitle(e.target.value)} required minLength={3} maxLength={180}/></label>
   <label>Approved work scope<textarea value={scope} onChange={e=>setScope(e.target.value)} rows={4} required minLength={3} maxLength={5000} placeholder="The accepted quote lines are prefilled. Confirm the approved deliverables and worker instructions."/></label>
   <button className="button button-primary" disabled={busy||!quoteId||!title.trim()||scope.trim().length<3}>{busy?"Creating Workcard…":"Create Workcard →"}</button>
  </form>:<p className="panel-footnote">{initialQuoteId?"This accepted quote is already linked to a Workcard, or it is no longer available for creation. Refresh the Jobcard to see its current state.":"No accepted quotes are currently available for a new Workcard. A Workcard can be created as soon as the customer accepts a quote; booking coordination remains a separate step."}</p>}
  {notice&&<p className="inline-notice" role="status">{notice}</p>}
 </section>;
}
