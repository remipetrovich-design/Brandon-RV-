"use client";
import {useState} from "react";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
export default function AcceptStaffInvitationPage(){
 const params=useSearchParams(),token=params.get("token")??"";
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function accept(){setBusy(true);setMessage("");try{const r=await fetch("/api/staff/invitations/accept",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});const d=await r.json();if(!r.ok){setMessage(d.error??"Could not accept invitation.");return;}setMessage("Staff access activated. Your customer account and history are unchanged.");}catch{setMessage("Could not accept invitation.");}finally{setBusy(false);}}
 return <main className="portal-page"><div className="shell portal-shell" style={{display:"block",maxWidth:620}}><section className="portal-panel"><p className="eyebrow"><span className="eyebrow-line"/> BRANDON RV · STAFF ACCESS</p><h1>Accept your <em>invitation.</em></h1><p>Sign in to the customer account that received this invitation. Accepting it adds staff permissions to that same account.</p>{token?<button className="button button-primary" type="button" disabled={busy} onClick={()=>void accept()}>{busy?"Activating…":"Accept staff invitation →"}</button>:<p role="alert">This invitation link is missing its token.</p>}{message&&<p role="status" className="inline-notice">{message}</p>}<p className="panel-footnote">Not signed in? <Link href="/portal/sign-in">Sign in to your customer account</Link>, then reopen this invitation link.</p></section></div></main>;
}
