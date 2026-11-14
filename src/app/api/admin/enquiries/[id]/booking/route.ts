import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
import {bookingTravelBuffer,validateBookingWindow} from "@/lib/booking-rules";
export const runtime="nodejs";
const idPattern=/^[0-9a-f-]{36}$/i;

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const access=await authorizePermission("enquiries.view");if(access.response)return access.response;
 const {id}=await params;
 if(!idPattern.test(id))return jsonError("Invalid Jobcard ID.");
 const db=database(),businessId=access.membership!.business_id;
 const {data:enquiry,error:enquiryError}=await db.from("enquiries").select("id,request_number,stage").eq("id",id).eq("business_id",businessId).maybeSingle();
 if(enquiryError||!enquiry)return jsonError("Jobcard not found.",404);
 const {data:quotes,error:quoteError}=await db.from("quotes").select("id").eq("business_id",businessId).eq("enquiry_id",id);
 if(quoteError)return jsonError("Could not load Jobcard quote links.",500);
 const quoteIds=(quotes??[]).map(quote=>quote.id);
 const [byEnquiry,byQuote]=await Promise.all([
  db.from("appointments").select("id,status,quote_id,enquiry_id,preferred_start,preferred_end,starts_at,ends_at,location,customer_notes,internal_notes,created_at,updated_at").eq("business_id",businessId).eq("enquiry_id",id).order("created_at",{ascending:false}),
  quoteIds.length?db.from("appointments").select("id,status,quote_id,enquiry_id,preferred_start,preferred_end,starts_at,ends_at,location,customer_notes,internal_notes,created_at,updated_at").eq("business_id",businessId).in("quote_id",quoteIds).order("created_at",{ascending:false}):Promise.resolve({data:[],error:null})
 ]);
 if(byEnquiry.error||byQuote.error)return jsonError("Could not load Jobcard booking requests.",500);
 const appointments=[...new Map([...(byEnquiry.data??[]),...(byQuote.data??[])].map(appointment=>[appointment.id,appointment])).values()].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
 const appointmentIds=appointments.map(x=>x.id);
 const [byQuoteJobs,byAppointmentJobs]=await Promise.all([
  quoteIds.length?db.from("jobs").select("id,job_number,title,status,quote_id,appointment_id").eq("business_id",businessId).in("quote_id",quoteIds):Promise.resolve({data:[],error:null}),
  appointmentIds.length?db.from("jobs").select("id,job_number,title,status,quote_id,appointment_id").eq("business_id",businessId).in("appointment_id",appointmentIds):Promise.resolve({data:[],error:null})
 ]);
 if(byQuoteJobs.error||byAppointmentJobs.error)return jsonError("Could not load linked Workcards.",500);
 const jobs=[...(byQuoteJobs.data??[]),...(byAppointmentJobs.data??[])];
 const jobByQuote=new Map(jobs.filter(job=>job.quote_id).map(job=>[job.quote_id,job]));
 const jobByAppointment=new Map(jobs.filter(job=>job.appointment_id).map(job=>[job.appointment_id,job]));
 return Response.json({enquiry,bookings:appointments.map(appointment=>({...appointment,active:["requested","confirmed","rescheduled"].includes(appointment.status),workcard:jobByAppointment.get(appointment.id)??jobByQuote.get(appointment.quote_id)??null}))});
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("enquiries.manage");if(access.response)return access.response;
 try{
  const {id}=await params,body=await request.json(),appointmentId=String(body.appointmentId??""),action=String(body.action??"");
  if(!idPattern.test(id)||!idPattern.test(appointmentId))return jsonError("Invalid Jobcard or booking ID.");
  if(!["confirm","reschedule","cancel"].includes(action))return jsonError("Choose confirm, reschedule or cancel.");
  const db=database(),businessId=access.membership!.business_id;
  const {data:enquiry,error:enquiryError}=await db.from("enquiries").select("id,stage").eq("id",id).eq("business_id",businessId).maybeSingle();
  if(enquiryError||!enquiry)return jsonError("Jobcard not found.",404);
  const {data:quotes,error:quoteError}=await db.from("quotes").select("id").eq("business_id",businessId).eq("enquiry_id",id);
  if(quoteError)return jsonError("Could not verify the Jobcard quote.",500);
  const quoteIds=(quotes??[]).map(q=>q.id);
  const {data:appointment,error:appointmentError}=await db.from("appointments").select("id,status,quote_id,enquiry_id,starts_at,ends_at,location,confirmed_by,confirmed_at,updated_at").eq("id",appointmentId).eq("business_id",businessId).maybeSingle();
  if(appointmentError||!appointment)return jsonError("Booking not found.",404);
  if(appointment.enquiry_id!==id&&(!appointment.quote_id||!quoteIds.includes(appointment.quote_id)))return jsonError("This booking does not belong to the selected Jobcard.",403);
  if(!["requested","confirmed","rescheduled"].includes(appointment.status))return jsonError("This booking is no longer active.",409);
  const now=new Date().toISOString();
  let patch:any={updated_at:now};
  if(action==="cancel"){patch.status="cancelled";}
  else{
   const startsAt=new Date(String(body.starts_at??"")),endsAt=new Date(String(body.ends_at??"")),location=String(body.location??"").trim().slice(0,200);
   if(!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())||endsAt<=startsAt)return jsonError("Enter a valid booking start and finish time.");
   if(location.length<3)return jsonError("Enter the agreed service location.");
   const {data:settingsRow}=await db.from("business_settings").select("settings").eq("business_id",businessId).maybeSingle();
   const settings=(settingsRow?.settings&&typeof settingsRow.settings==="object"?settingsRow.settings:{}) as unknown as import("@/lib/booking-rules").BookingPolicy;
   const policyError=validateBookingWindow(startsAt,endsAt,settings);if(policyError)return jsonError(policyError,409);
   const buffer=bookingTravelBuffer(settings),bufferedStart=new Date(startsAt.getTime()-buffer*60000).toISOString(),bufferedEnd=new Date(endsAt.getTime()+buffer*60000).toISOString();
   const {data:conflicts,error:conflictError}=await db.from("appointments").select("id").eq("business_id",businessId).neq("id",appointment.id).in("status",["confirmed","rescheduled"]).not("starts_at","is",null).lt("starts_at",bufferedEnd).gt("ends_at",bufferedStart).limit(1);
   if(conflictError)return jsonError("Could not verify calendar availability.",500);
   if(conflicts?.length)return jsonError("That time conflicts with another booking or its travel buffer.",409);
   patch={...patch,starts_at:startsAt.toISOString(),ends_at:endsAt.toISOString(),location,status:action==="confirm"?"confirmed":"rescheduled",confirmed_by:access.user!.id,confirmed_at:now};
  }
  const {data:updated,error:updateError}=await db.from("appointments").update(patch).eq("id",appointment.id).eq("business_id",businessId).select("id,status,quote_id,enquiry_id,preferred_start,preferred_end,starts_at,ends_at,location,customer_notes,internal_notes,created_at,updated_at").single();
  if(updateError||!updated)return jsonError("Could not update this booking.",500);
  const {data:jobs,error:jobsError}=await db.from("jobs").select("id,status").eq("business_id",businessId).or("appointment_id.eq."+appointment.id+(appointment.quote_id?",quote_id.eq."+appointment.quote_id:""));
  if(jobsError)return jsonError("Booking updated, but linked Workcards could not be loaded. Refresh and check the Workcard link.",500);
  for(const job of jobs??[]){
   const jobPatch:any={appointment_id:action==="cancel"?null:appointment.id,updated_at:now};
   if(action==="cancel"){
    if(job.status==="scheduled"){jobPatch.status="pending";jobPatch.scheduled_start=null;jobPatch.scheduled_end=null;}
   }else{jobPatch.scheduled_start=updated.starts_at;jobPatch.scheduled_end=updated.ends_at;if(job.status==="pending")jobPatch.status="scheduled";}
   const {error}=await db.from("jobs").update(jobPatch).eq("id",job.id).eq("business_id",businessId);
   if(error)return jsonError("Booking updated, but the Workcard link could not be synchronised. Refresh and retry.",500);
  }
  const nextStage=action==="cancel"?"ready_to_schedule":"booked";
  if(["approved","workcard_created","ready_to_schedule","booking_requested","booked"].includes(enquiry.stage)&&enquiry.stage!==nextStage){
   await db.from("enquiries").update({stage:nextStage,status:"converted",updated_at:now}).eq("id",id).eq("business_id",businessId);
   await db.from("enquiry_stage_history").insert({business_id:businessId,enquiry_id:id,from_stage:enquiry.stage,to_stage:nextStage,changed_by:access.user!.id,note:action==="cancel"?"Booking cancelled; return to scheduling.":"Booking "+(action==="confirm"?"confirmed":"rescheduled")+" from the Jobcard."});
  }
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"jobcard.booking_"+action,entity_type:"appointment",entity_id:appointment.id,details:{enquiry_id:id,quote_id:appointment.quote_id,workcard_ids:(jobs??[]).map(x=>x.id),starts_at:updated.starts_at,ends_at:updated.ends_at,location:updated.location}});
  return Response.json({appointment:updated,workcardsUpdated:(jobs??[]).length});
 }catch(error){console.error("Jobcard booking update failed",error);return jsonError("Could not update this booking.",500);}
}
