"use client";
import {FormEvent,useCallback,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
type Booking={
 id:string;quote_id:string;location:string;starts_at:string;ends_at:string;guest_name:string|null;
 quotes:{quote_number:string;status:string;quote_items:{description:string;sort_order:number}[]}|null;
 enquiries:{contact_name:string;request_number:string;request_type:string}|null;
};
export default function AdminCreateJob({initialQuoteId=""}:{initialQuoteId?:string}){
 const [bookings,setBookings]=useState<Booking[]>([]),[appointmentId,setAppointmentId]=useState(""),[title,setTitle]=useState(""),[scope,setScope]=useState(""),[notice,setNotice]=useState(""),[loadError,setLoadError]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const router=useRouter();
 const loadBookings=useCallback(async()=>{
  setLoading(true);setLoadError("");
  try{
   const url="/api/admin/jobs"+(initialQuoteId?"?quoteId="+encodeURIComponent(initialQuoteId):"");
   const r=await fetch(url,{cache:"no-store"}),d=await r.json();
   if(!r.ok){setLoadError(d.error??"Could not load confirmed bookings.");return;}
   setBookings(d.bookings??[]);
  }catch{setLoadError("Could not load confirmed bookings. Check the connection and try again.");}
  finally{setLoading(false);}
 },[initialQuoteId]);
 useEffect(()=>{void loadBookings();},[loadBookings]);
 function chooseBooking(id:string){
  setAppointmentId(id);
  const booking=bookings.find(item=>item.id===id);
  if(!booking)return;
  setTitle("Work for "+(booking.quotes?.quote_number??"accepted quote"));
  setScope((booking.quotes?.quote_items??[]).map(item=>item.description).join("\n"));
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/admin/jobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({appointmentId,title,scope})}),d=await r.json();
   if(!r.ok){setNotice(d.error??"Could not create Workcard.");return;}
   setNotice("Workcard "+d.job.job_number+" created. It is awaiting senior setup review before assignment.");
   setAppointmentId("");setTitle("");setScope("");await loadBookings();router.refresh();
  }catch{setNotice("Could not create Workcard.");}
  finally{setBusy(false);}
 }
 const date=(value:string)=>new Date(value).toLocaleString("en-AU",{dateStyle:"medium",timeStyle:"short"});
 return <section className="portal-panel"><span className="panel-kicker">NEW WORKCARD</span><h2>Create a Workcard from a confirmed booking</h2>
  {loading?<p className="panel-footnote" role="status">Loading confirmed bookings…</p>:loadError?<div className="inline-notice" role="alert"><p>{loadError}</p><button type="button" className="button button-secondary" onClick={()=>void loadBookings()}>Retry loading bookings</button></div>:bookings.length?<form className="auth-form" onSubmit={submit}>
   <label>Confirmed booking<select value={appointmentId} onChange={e=>chooseBooking(e.target.value)} required><option value="">Select a confirmed booking</option>{bookings.map(item=><option key={item.id} value={item.id}>{item.quotes?.quote_number??"Accepted quote"} · {item.enquiries?.request_number??"Jobcard"} · {item.guest_name??item.enquiries?.contact_name??"Customer"} · {date(item.starts_at)}</option>)}</select></label>
   {appointmentId&&<p className="panel-footnote">Service location: {bookings.find(item=>item.id===appointmentId)?.location} · {date(bookings.find(item=>item.id===appointmentId)!.starts_at)} – {date(bookings.find(item=>item.id===appointmentId)!.ends_at)}</p>}
   <label>Workcard title<input value={title} onChange={e=>setTitle(e.target.value)} required minLength={3} maxLength={180}/></label>
   <label>Approved work scope<textarea value={scope} onChange={e=>setScope(e.target.value)} rows={4} required minLength={3} maxLength={5000} placeholder="The accepted quote scope is prefilled. Record the approved deliverables and instructions for the worker."/></label>
   <button className="button button-primary" disabled={busy||!appointmentId||!title.trim()||scope.trim().length<3}>{busy?"Creating Workcard…":"Create Workcard →"}</button>
  </form>:<p className="panel-footnote">{initialQuoteId?"The customer has accepted this quote. A Workcard becomes available once the booking is confirmed.":"No confirmed bookings are currently available for Workcard creation. A Workcard is created after quote acceptance and booking confirmation."}</p>}
  {notice&&<p className="inline-notice" role="status">{notice}</p>}
 </section>;
}
