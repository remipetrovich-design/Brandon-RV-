"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
type Workcard={id:string;job_number:string;title:string;status:string;customer_name:string|null;appointment_id:string|null};
export default function AdminCreateAppointment({workcards}:{workcards:Workcard[]}){
 const [jobId,setJobId]=useState(""),[start,setStart]=useState(""),[location,setLocation]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const router=useRouter();
 async function create(){
  setBusy(true);setNotice("");
  try{
   const response=await fetch("/api/admin/appointments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({job_id:jobId,starts_at:start?new Date(start).toISOString():null,ends_at:null,location})});
   const data=await response.json();
   if(!response.ok){setNotice(data.error??"Could not create appointment.");return;}
   setNotice("Appointment created and added to the master calendar.");
   setJobId("");setStart("");setLocation("");router.refresh();
  }catch{setNotice("Could not create appointment.");}finally{setBusy(false);}
 }
 const available=workcards.filter(job=>!job.appointment_id&&!["completed","cancelled"].includes(job.status));
 return <section className="portal-panel" style={{marginBottom:20}}>
  <div className="portal-panel-heading"><div><span className="panel-kicker">WORKER BOOKING</span><h2>Create appointment</h2></div></div>
  <p className="panel-footnote">Create a confirmed appointment for a Workcard. It is saved to this master calendar and linked back to the Workcard.</p>
  <div className="form-grid">
   <label>Workcard<select value={jobId} onChange={event=>setJobId(event.target.value)}><option value="">Select a Workcard</option>{available.map(job=><option key={job.id} value={job.id}>{job.job_number} · {job.title} · {job.customer_name??"Customer not linked"}</option>)}</select></label>
   <label>Service location<input value={location} onChange={event=>setLocation(event.target.value)} maxLength={200} placeholder="Customer address or agreed location"/></label>
   <label>Booking date and start time<input type="datetime-local" value={start} onChange={event=>setStart(event.target.value)}/></label>
   
  </div>
  <button className="button button-primary" type="button" disabled={busy||!jobId||!start||!location.trim()} onClick={()=>void create()}>{busy?"Creating…":"Create & confirm appointment"}</button>
  {notice&&<p role="status" className="panel-footnote">{notice}</p>}
 </section>;
}
