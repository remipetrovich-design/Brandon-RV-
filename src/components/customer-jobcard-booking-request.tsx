"use client";
import {FormEvent,useState} from "react";
export default function CustomerJobcardBookingRequest({quoteId,quoteNumber,vehicleId}:{quoteId:string;quoteNumber:string;vehicleId:string|null}){
 const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const form=e.currentTarget;const values=new FormData(form);const local=String(values.get("preferredStart")??"");const date=new Date(local);
  if(!Number.isFinite(date.getTime())){setNotice("Choose a valid preferred date and time.");return;}
  setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/portal/appointments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({quoteId,preferredStart:date.toISOString(),location:values.get("location"),notes:values.get("notes"),vehicleId})});
   const d=await r.json();if(!r.ok){setNotice(d.error??"Could not request booking.");return;}
   setNotice(d.message??"Booking request sent. It is not confirmed until Brandon RV agrees the details.");form.reset();
  }catch{setNotice("Could not request booking.");}
  finally{setBusy(false);}
 }
 const min=new Date(Date.now()+24*3600000);min.setSeconds(0,0);const minLocal=new Date(min.getTime()-min.getTimezoneOffset()*60000).toISOString().slice(0,16);
 return <form className="auth-form brv-jobcard-booking-form" onSubmit={submit}>
  <h4>Request a booking for {quoteNumber}</h4>
  <p className="panel-footnote">This is a preferred visit time only. Brandon RV must confirm the actual date, time and location.</p>
  <label>Preferred date and time<input name="preferredStart" type="datetime-local" min={minLocal} required/></label>
  <label>Service location<input name="location" minLength={3} maxLength={200} required placeholder="Suburb or service address"/></label>
  <label>Notes<textarea name="notes" rows={2} maxLength={2000}/></label>
  <button className="button button-primary" disabled={busy}>{busy?"Sending request…":"Request booking"}</button>
  {notice&&<p className="inline-notice" role="status">{notice}</p>}
 </form>;
}
