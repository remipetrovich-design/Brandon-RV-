import Link from "next/link";
import {redirect} from "next/navigation";
import {currentUser,database} from "@/lib/auth";
export const dynamic="force-dynamic";
const pretty=(value:string)=>String(value??"").replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());
export default async function BookingsPage(){
 const user=await currentUser();if(!user)redirect("/portal/sign-in");
 const db=database();
 const [appointments,jobs]=await Promise.all([
  db.from("appointments").select("id,status,preferred_start,starts_at,ends_at,location,customer_notes,enquiry_id,quote_id,quotes(quote_number)").eq("user_id",user.id).order("created_at",{ascending:false}),
  db.from("jobs").select("id,job_number,title,status,scheduled_start,appointment_id,appointments(enquiry_id)").eq("user_id",user.id).order("created_at",{ascending:false})
 ]);
 const bookings=appointments.data??[],workcards=jobs.data??[];
 return <><div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line"/> BOOKINGS & WORKCARDS</p><h1>Your bookings <em>& visits.</em></h1><p>Booking requests and confirmed visits are linked to their customer Jobcard. Open the Jobcard for quotes, messages, work progress, approvals and invoices.</p></div>
 <div className="brv-jobcard-list-heading"><strong>{bookings.length} booking records</strong><Link className="button button-primary" href="/portal/jobcards">View Jobcards</Link></div>
 <section className="portal-panel"><div className="portal-panel-heading"><div><span className="panel-kicker">APPOINTMENTS</span><h2>Visits and booking requests</h2></div></div>{bookings.length?<div className="activity-list">{bookings.map(a=><article className="activity-item" key={a.id}><div className="activity-date">{a.starts_at?new Date(a.starts_at).toLocaleDateString("en-AU"):a.preferred_start?new Date(a.preferred_start).toLocaleDateString("en-AU"):"To be arranged"}</div><div className="activity-copy"><strong>{(a.quotes as any)?.quote_number??"Service appointment"}</strong><span>{pretty(a.status)}{a.location?" · "+a.location:""}</span><small>{a.customer_notes??"No additional notes"}</small></div>{a.enquiry_id&&<Link href={"/portal/jobcards/"+a.enquiry_id}>Open Jobcard →</Link>}</article>)}</div>:<p className="panel-footnote">No appointment requests are linked to your account yet. Accept a quote from its Jobcard to request a visit.</p>}</section>
 <section className="portal-panel"><div className="portal-panel-heading"><div><span className="panel-kicker">WORKCARDS</span><h2>Work being carried out</h2></div></div>{workcards.length?<div className="activity-list">{workcards.map(j=>{const appointment=Array.isArray(j.appointments)?j.appointments[0]:j.appointments;return <article className="activity-item" key={j.id}><div className="activity-date">{j.job_number}</div><div className="activity-copy"><strong>{j.title}</strong><span>{pretty(j.status)} · {j.scheduled_start?new Date(j.scheduled_start).toLocaleDateString("en-AU"):"Not scheduled"}</span></div>{appointment?.enquiry_id&&<Link href={"/portal/jobcards/"+appointment.enquiry_id}>Open Jobcard →</Link>}</article>;})}</div>:<p className="panel-footnote">No Workcards have been created yet. A Workcard is prepared after quote acceptance and setup review. Appointment confirmation is handled separately.</p>}</section>
 </>;
}
