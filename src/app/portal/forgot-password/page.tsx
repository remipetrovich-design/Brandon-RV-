"use client";
import Link from "next/link";
import {FormEvent,useState} from "react";
export default function ForgotPasswordPage(){
 const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setNotice("");const email=new FormData(e.currentTarget).get("email");try{const r=await fetch("/api/auth/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});const d=await r.json();setNotice(r.ok?d.message:(d.error??"Could not send reset email."));}catch{setNotice("Could not send reset email.");}finally{setBusy(false);}}
 return <div className="auth-wrap"><div className="auth-card"><p className="eyebrow"><span className="eyebrow-line"/> ACCOUNT RECOVERY</p><h1>Reset your <em>password.</em></h1><p className="auth-intro">Enter the email address on your Brandon RV account. If it exists, a reset link will be sent.</p><form className="auth-form" onSubmit={submit}><label>Email address<input name="email" type="email" required autoComplete="email"/></label><button className="button button-primary" disabled={busy}>{busy?"Sending…":"Send reset link →"}</button></form>{notice&&<p className="inline-notice" role="status">{notice}</p>}<Link className="auth-back" href="/portal/sign-in">← Back to sign in</Link></div></div>;
}