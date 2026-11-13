"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import AdminCreateQuote from "@/components/admin-create-quote";
import AdminQuoteTools from "@/components/admin-quote-tools";
import AdminCreateJob from "@/components/admin-create-job";
type Quote={id:string;quote_number:string;enquiry_id:string;revision_number:number;status:string;quote_kind:string;total:number;created_at:string;users?:{full_name:string}|null;enquiries?:{request_number:string;contact_name:string;request_type:string}|null};
const money=(v:number)=>new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD"}).format(Number(v||0));
const pretty=(v:string)=>v?.replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase())??"";
export default function AdminQuotesManager({canManageQuotes,canManageJobs}:{canManageQuotes:boolean;canManageJobs:boolean}){
 const [quotes,setQuotes]=useState<Quote[]>([]),[notice,setNotice]=useState(""),[filter,setFilter]=useState("all"),[showCreate,setShowCreate]=useState(false);
 async function load(){try{const r=await fetch("/api/admin/quotes",{cache:"no-store"}),d=await r.json();if(!r.ok){setNotice(d.error??"Could not load quotes.");return;}setQuotes(d.quotes??[]);}catch{setNotice("Could not load quotes.");}}
 useEffect(()=>{void load();},[]);
 const visible=quotes.filter(q=>filter==="all"||q.status===filter);
 return <div className="brv-enquiry-manager">
  <section className="portal-panel"><div className="portal-panel-heading"><div><span className="panel-kicker">QUOTE REGISTER</span><h2>All quotes</h2><p>Manage quote drafts, revisions, approvals, customer decisions and Workcard conversion.</p></div>{canManageQuotes&&<button type="button" className="button button-primary" onClick={()=>setShowCreate(v=>!v)}>{showCreate?"Close form":"+ New quote"}</button>}</div>
   <div className="brv-enquiry-filters"><label>Quote status<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All statuses</option>{["draft","sent","accepted","declined","expired","converted","superseded"].map(s=><option key={s} value={s}>{pretty(s)}</option>)}</select></label><span className="panel-footnote">{visible.length} quote(s)</span></div>
   {showCreate&&<AdminCreateQuote onCreated={()=>{setShowCreate(false);void load();}}/>}
  </section>
  <section className="portal-panel"><div className="portal-panel-heading"><div><span className="panel-kicker">{visible.length} RECORDS</span><h2>Quote history</h2></div></div>
   {visible.length?<div className="activity-list">{visible.map(q=><article className="activity-item" key={q.id}><div className="activity-date">{new Date(q.created_at).toLocaleDateString("en-AU")}</div><div className="activity-copy"><strong>{q.quote_number} · Revision {q.revision_number}</strong><span>{q.enquiries?.request_number??"Quote"} · {q.enquiries?.contact_name??q.users?.full_name??"Customer"}</span><span>{pretty(q.status)} · {money(q.total)}</span><small>{pretty(q.quote_kind??"standard")} quote</small></div><div className="brv-enquiry-row-actions">{q.enquiry_id&&<Link className="text-link" href={"/admin/enquiries/"+q.enquiry_id}>Open Jobcard →</Link>}{canManageQuotes&&<AdminQuoteTools quoteId={q.id}/>}</div>{q.status==="accepted"&&canManageJobs&&<div className="brv-ticket-workcard-create"><AdminCreateJob initialQuoteId={q.id}/></div>}{q.status==="accepted"&&!canManageJobs&&<p className="panel-footnote">Accepted. Workcard conversion requires Workcard management permission.</p>}</article>)}</div>:<p className="panel-footnote">No quotes match this status.</p>}
  </section>
  {notice&&<p className="inline-notice" role="status">{notice}</p>}
 </div>;
}
