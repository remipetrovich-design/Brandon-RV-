"use client";
import {useState} from "react";

export default function AdminCustomerResetLink({customerId}:{customerId:string}){
 const [resetUrl,setResetUrl]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 async function createLink(){
  setBusy(true);setNotice("");setResetUrl("");
  try{
   const response=await fetch("/api/admin/customers/"+customerId+"/reset-link",{method:"POST"});
   const data=await response.json();
   if(!response.ok){setNotice(data.error??"Could not create reset link.");return;}
   setResetUrl(data.resetUrl);
   setNotice(data.emailSent?"Reset email sent. A manual link is also available.":"Email is not configured; share this private link with the customer.");
  }catch{setNotice("Could not create reset link.");}
  finally{setBusy(false);}
 }
 async function copyLink(){
  try{await navigator.clipboard.writeText(resetUrl);setNotice("Reset link copied.");}
  catch{setNotice("Select and copy the reset link below.");}
 }
 return <div className="record-actions">
  <button className="button button-secondary" type="button" disabled={busy} onClick={()=>void createLink()}>{busy?"Creating…":"Create password reset link"}</button>
  {resetUrl&&<><input className="customer-reset-link-field" aria-label="Customer password reset link" readOnly value={resetUrl}/><button className="button button-secondary" type="button" onClick={()=>void copyLink()}>Copy link</button></>}
  {notice&&<small role="status">{notice}</small>}
 </div>;
}
