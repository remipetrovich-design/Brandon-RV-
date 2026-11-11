import Link from "next/link";
import {redirect} from "next/navigation";
import {currentUser,database} from "@/lib/auth";
export const dynamic="force-dynamic";
const pretty=(value:string)=>String(value??"").replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());
export default async function JobcardsPage(){
 const user=await currentUser();if(!user)redirect("/portal/sign-in");
 const {data,error}=await database().from("enquiries").select("id,request_number,requested_service,vehicle_description,location,status,stage,created_at,updated_at").eq("user_id",user.id).eq("request_type","quote_request").order("created_at",{ascending:false});
 if(error)throw new Error("Could not load your Jobcards.");
 const rows=data??[];
 return <><div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line"/> CUSTOMER JOBCARDS</p><h1>Your service <em>Jobcards.</em></h1><p>Each quote request has one Jobcard. Quotes, booking, work updates, approvals and invoices stay linked to it.</p></div>
 <div className="brv-jobcard-list-heading"><strong>{rows.length} Jobcards</strong><Link className="button button-primary" href="/request-quote">Request a quote</Link></div>
 {rows.length?<div className="brv-jobcard-list">{rows.map(item=><Link className="brv-jobcard-list-item" href={"/portal/jobcards/"+item.id} key={item.id}>
  <div><span className="panel-kicker">{item.request_number}</span><strong>{item.requested_service||"RV service request"}</strong><small>{item.vehicle_description||"Vehicle details to be confirmed"}</small></div>
  <div className="brv-jobcard-list-meta"><span className="status-pill">{pretty(item.stage||item.status)}</span><small>{new Date(item.created_at).toLocaleDateString("en-AU")}</small><span aria-hidden="true">→</span></div>
 </Link>)}</div>:<section className="portal-panel"><p className="panel-footnote">No quote requests have been submitted yet.</p><Link className="button button-primary" href="/request-quote">Request a quote →</Link></section>}
 </>;
}
