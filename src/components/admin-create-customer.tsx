"use client";
import {useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
export default function AdminCreateCustomer(){
 const router=useRouter();const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setNotice("");
  const form=new FormData(event.currentTarget);
  try{
   const response=await fetch("/api/admin/customers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({firstName:form.get("firstName"),lastName:form.get("lastName"),email:form.get("email"),phone:form.get("phone"),address:form.get("address"),suburb:form.get("suburb"),state:form.get("state"),postcode:form.get("postcode")})});
   const data=await response.json();if(!response.ok){setNotice(data.error??"Could not create customer.");return;}
   router.push("/admin/customers/"+data.id);router.refresh();
  }catch{setNotice("Could not create customer.");}finally{setBusy(false);}
 }
 return <section className="portal-panel admin-create-customer">
  <div className="portal-panel-heading"><div><span className="panel-kicker">CUSTOMER MANAGEMENT</span><h2>Create customer</h2></div><button type="button" className="button button-primary" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>{open?"Close form":"＋ New customer"}</button></div>
  {open&&<form className="auth-form" onSubmit={submit}>
   <div className="form-grid"><label>First name<input name="firstName" autoComplete="given-name" required maxLength={120}/></label><label>Last name<input name="lastName" autoComplete="family-name" required maxLength={120}/></label><label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254}/></label><label>Phone<input name="phone" type="tel" autoComplete="tel" maxLength={40}/></label><label>Street address<input name="address" autoComplete="street-address" maxLength={500}/></label><label>Suburb<input name="suburb" autoComplete="address-level2" maxLength={120}/></label><label>State<input name="state" autoComplete="address-level1" maxLength={80}/></label><label>Postcode<input name="postcode" autoComplete="postal-code" maxLength={12}/></label></div>
   <p className="panel-footnote">The customer profile will be created immediately. Use the profile's password reset action to send them a secure link to set their portal password.</p>
   <button className="button button-primary" disabled={busy}>{busy?"Creating…":"Create customer account →"}</button>{notice&&<p role="alert" className="inline-notice">{notice}</p>}
  </form>}
 </section>;
}
