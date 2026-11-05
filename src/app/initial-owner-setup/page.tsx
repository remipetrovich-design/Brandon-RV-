"use client";
import {FormEvent,useState} from "react";
import {useRouter} from "next/navigation";
export default function InitialOwnerSetupPage(){
 const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);const router=useRouter();
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setNotice("");setBusy(true);const form=new FormData(event.currentTarget);
  const password=String(form.get("password")??"");if(password!==String(form.get("confirmPassword")??"")){setNotice("The passwords do not match.");setBusy(false);return;}
  try{
   const response=await fetch("/api/auth/bootstrap-owner",{method:"POST",headers:{"Content-Type":"application/json","x-setup-secret":String(form.get("setupSecret")??"")},body:JSON.stringify({fullName:form.get("fullName"),email:form.get("email"),password})});
   const result=await response.json();if(!response.ok){setNotice(result.error??"Owner setup failed.");return;}
   router.replace("/staff");router.refresh();
  }catch{setNotice("Owner setup is temporarily unavailable.");}finally{setBusy(false);}
 }
 return <main className="auth-wrap"><section className="auth-card auth-card-wide"><p className="eyebrow"><span className="eyebrow-line"/> FIRST-TIME SETUP</p><h1>Create the <em>business owner.</em></h1><p className="auth-intro">This one-time setup creates the primary Brandon RV owner account and assigns full business permissions. Keep the setup code private. This page stops working once an owner account exists.</p><form className="auth-form" onSubmit={submit}><label>One-time setup code<input name="setupSecret" type="password" autoComplete="off" required/></label><label>Owner full name<input name="fullName" required minLength={2} maxLength={120} autoComplete="name"/></label><label>Owner email<input name="email" type="email" required autoComplete="email"/></label><label>Password<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label><label>Confirm password<input name="confirmPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label><button className="button button-primary" disabled={busy}>{busy?"Creating owner account…":"Create owner account →"}</button></form>{notice&&<p className="inline-notice" role="alert">{notice}</p>}</section></main>;
}
