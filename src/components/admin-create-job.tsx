"use client";
import {FormEvent,useCallback,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
type Quote={id:string;quote_number:string;total:number;users:{full_name:string}|null;enquiries:{contact_name:string;request_number:string}|null};
export default function AdminCreateJob({initialQuoteId=""}:{initialQuoteId?:string}){
 const [quotes,setQuotes]=useState<Quote[]>([]),[quoteId,setQuoteId]=useState(initialQuoteId),[title,setTitle]=useState(""),[scope,setScope]=useState(""),[notice,setNotice]=useState(""),[loadError,setLoadError]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const router=useRouter();
 const loadQuotes=useCallback(async()=>{
  setLoading(true);setLoadError("");
  try{
   const url="/api/admin/jobs"+(initialQuoteId?"?quoteId="+encodeURIComponent(initialQuoteId):"");
   const r=await fetch(url,{cache:"no-store"}),d=await r.json();
   if(!r.ok){setLoadError(d.error??"Could not load accepted quotes.");return;}
   setQuotes(d.quotes??[]);
   if(initialQuoteId){const q=(d.quotes??[]).find((x:Quote)=>x.id===initialQuoteId);if(q)setTitle(current=>current||"Work for "+q.quote_number);}
  }catch{setLoadError("Could not load accepted quotes. Check the connection and try again.");}
  finally{setLoading(false);}
 },[initialQuoteId]);
 useEffect(()=>{void loadQuotes();},[loadQuotes]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setNotice("");
  try{const r=await fetch("/api/admin/jobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({quoteId,title,scope})});const d=await r.json();if(!r.ok){setNotice(d.error??"Could not create Workcard.");return;}setNotice("Workcard "+d.job.job_number+" created. It is awaiting senior setup review before assignment.");setQuoteId("");setTitle("");setScope("");await loadQuotes();router.refresh();}
  catch{setNotice("Could not create Workcard.");}
  finally{setBusy(false);}
 }
 return <section className="portal-panel"><span className="panel-kicker">NEW WORKCARD</span><h2>Create a Workcard from an accepted quote</h2>
  {loading?<p className="panel-footnote" role="status">Loading accepted quotes…</p>:loadError?<div className="inline-notice" role="alert"><p>{loadError}</p><button type="button" className="button button-secondary" onClick={()=>void loadQuotes()}>Retry loading accepted quotes</button></div>:quotes.length?<form className="auth-form" onSubmit={submit}>
   <label>Accepted quote<select value={quoteId} onChange={e=>{setQuoteId(e.target.value);const q=quotes.find(x=>x.id===e.target.value);if(q)setTitle("Work for "+q.quote_number);}} required><option value="">Select an accepted quote</option>{quotes.map(q=><option key={q.id} value={q.id}>{q.quote_number} · {q.enquiries?.request_number??"Jobcard"} · {q.users?.full_name??q.enquiries?.contact_name??"Customer"}</option>)}</select></label>
   <label>Workcard title<input value={title} onChange={e=>setTitle(e.target.value)} required minLength={3} maxLength={180}/></label>
   <label>Work scope<textarea value={scope} onChange={e=>setScope(e.target.value)} rows={4} required minLength={3} maxLength={5000} placeholder="Describe the approved work, deliverables and any instructions for the worker."/></label>
   <button className="button button-primary" disabled={busy||!quoteId||!title.trim()||scope.trim().length<3}>{busy?"Creating Workcard…":"Create Workcard →"}</button>
  </form>:<p className="panel-footnote">No accepted quotes are currently available for a new Workcard. A Workcard can be created after the customer accepts a quote.</p>}
  {notice&&<p className="inline-notice" role="status">{notice}</p>}
 </section>;
}
