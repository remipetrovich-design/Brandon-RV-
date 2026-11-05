"use client";
import {useState} from "react";
export default function AdminCustomerResetLink({customerId}:{customerId:string}){
 const [url,setUrl]=useState("");const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);
 async function create(){setBusy(true);setNotice("");setUrl("");try{const r=await fetch("/api/admin/customers/"+customerId+"/reset-link",{method:"POST"});const d=await r.json();if(!r.ok){setNotice(d.error??"Could not create reset link.");return;}setUrl(d.resetUrl);setNotice(d.emailSent?"Reset email sent. A manual link is also available.":"Email is not configured; share this private link with the customer.");}catch{setNotice("Could not create reset link.");}finally{setBusy(false);}}
 async function copy(){try{await navigator.clipboard.writeText(url);setNotice("Reset link copied.");}catch{setNotice("Select and copy the reset link below.");}}
 return <div className="record-actions"><button className="button button-secondary" type="button" disabled={busy} onClick={()=>void create()}>{busy?"Creating…":"Create password reset link"}</button>{url&&<><input aria-label="Customer password reset link" readOnly value={url}/><button className="button button-secondary" type="button" onClick={()=>void copy()}>Copy link</button></>}{notice&&<small role="status">{notice}</small>}</div>;
}