"use client";
import {FormEvent,Suspense,useState} from "react";
import {useRouter,useSearchParams} from "next/navigation";
function OwnerSetupForm(){
 const params=useSearchParams();const token=params.get("token")??"";const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);const router=useRouter();
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setNotice("");setBusy(true);const form=new FormData(event.currentTarget);
  const password=String(form.get("password")??"");if(password!==String(form.get("confirmPassword")??"")){setNotice("The passwords do not match.");setBusy(false);return;}
  try{
   const response=await fetch("/api/auth/accept-invitation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,fullName:form.get("fullName"),email:form.get("email"),password})});
   const result=await response.json();if(!response.ok){setNotice(result.error??"Owner setup failed.");return;}
   router.replace("/staff");router.refresh();
  }catch{setNotice("Owner setup is temporarily unavailable.");}finally{setBusy(false);}
 }
 return <main className="auth-wrap"><section className="auth-card auth-card-wide"><p className="eyebrow"><span className="eyebrow-line"/> FIRST-TIME SETUP</p><h1>Create the <em>business owner.</em></h1><p className="auth-intro">This private one-time setup link creates the primary Brandon RV owner account and assigns full business permissions. Choose the owner's name, email and password. The link expires and can only be used once.</p>{token?<form className="auth-form" onSubmit={submit}><label>Owner full name<input name="fullName" required minLength={2} maxLength={120} autoComplete="name"/></label><label>Owner email<input name="email" type="email" required autoComplete="email"/></label><label>Password<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label><label>Confirm password<input name="confirmPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label><button className="button button-primary" disabled={busy}>{busy?"Creating owner account…":"Create owner account →"}</button></form>:<p className="inline-notice" role="alert">This owner setup link is missing its token. Ask the deployment operator for a new link.</p>}{notice&&<p className="inline-notice" role="alert">{notice}</p>}</section></main>;
}
export default function InitialOwnerSetupPage(){return <Suspense fallback={<main className="auth-wrap"><section className="auth-card">Loading owner setup…</section></main>}><OwnerSetupForm/></Suspense>;}
