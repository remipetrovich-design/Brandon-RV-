"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
export default function AdminEnquiryTools({enquiryId,customerId}:{enquiryId:string;customerId:string|null}){
 const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);const router=useRouter();
 async function convert(){setBusy(true);setNotice("");try{const r=await fetch("/api/admin/enquiries/"+enquiryId+"/convert",{method:"POST"});const d=await r.json();if(!r.ok){setNotice(d.error??"Could not create customer.");return;}setNotice("Customer record linked. You can now prepare a quote.");router.refresh();}catch{setNotice("Could not create customer.");}finally{setBusy(false);}}
 return <div className="portal-panel brv-ticket-customer-convert"><span className="panel-kicker">CUSTOMER RECORD</span>{customerId?<p>This enquiry is linked to an existing customer.</p>:<><p>Convert this enquiry into a customer record so quotes, jobs and invoices can be linked to the same customer.</p><button className="button button-secondary" disabled={busy} onClick={()=>void convert()}>{busy?"Creating…":"Create customer record →"}</button></>}{notice&&<p className="inline-notice" role="status">{notice}</p>}</div>;
}