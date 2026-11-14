import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
import {validateBookingWindow} from "@/lib/booking-rules";
import {bookingWindowsConflict} from "@/lib/booking-window-policy.mjs";
import {isManagerOrAbove} from "@/lib/user-role-policy.mjs";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("appointments.manage");if(access.response)return access.response;
 try{
  const body=await request.json(),jobId=String(body.job_id??"");
  const startsAt=new Date(String(body.starts_at??""));
  const endsAt=body.ends_at?new Date(String(body.ends_at)):null;
  const location=String(body.location??"").trim().slice(0,200);
  const bypassRestrictions=isManagerOrAbove(access.user?.user_role);
  if(!/^[0-9a-f-]{36}$/i.test(jobId))return jsonError("Select a Workcard for this appointment.");
  if(!Number.isFinite(startsAt.getTime())||(endsAt&&(!Number.isFinite(endsAt.getTime())||endsAt<=startsAt)))return jsonError("Enter a valid appointment start time.");
  if(location.length<3)return jsonError("Enter the agreed service location.");
  const db=database(),businessId=access.membership!.business_id,now=new Date();
  const {data:job,error:jobError}=await db.from("jobs").select("id,job_number,status,appointment_id,quote_id,customer_id,user_id,guest_name,guest_email").eq("id",jobId).eq("business_id",businessId).maybeSingle();
  if(jobError||!job)return jsonError("Workcard not found.",404);
  if(["completed","cancelled"].includes(job.status))return jsonError("A closed Workcard cannot be booked.",409);
  if(job.appointment_id){
   const {data:linkedAppointment}=await db.from("appointments").select("id,status").eq("id",job.appointment_id).eq("business_id",businessId).maybeSingle();
   if(linkedAppointment&&!["cancelled","completed"].includes(linkedAppointment.status))return jsonError("This Workcard already has an active appointment. Update it from the master calendar.",409);
  }
  if(job.quote_id){
   const {data:existingRequest}=await db.from("appointments").select("id,status").eq("business_id",businessId).eq("quote_id",job.quote_id).in("status",["requested","confirmed","rescheduled"]).limit(1).maybeSingle();
   if(existingRequest)return jsonError("An appointment request already exists. Accept or update it in the master calendar.",409);
  }
  let enquiryId:string|null=null,vehicleId:string|null=null;
  if(job.quote_id){
   const {data:quote}=await db.from("quotes").select("id,status,enquiry_id").eq("id",job.quote_id).eq("business_id",businessId).maybeSingle();
   if(!quote||quote.status!=="accepted")return jsonError("The linked quote must be accepted before booking.",409);
   enquiryId=quote.enquiry_id??null;
   if(enquiryId){const {data:enquiry}=await db.from("enquiries").select("vehicle_id").eq("id",enquiryId).eq("business_id",businessId).maybeSingle();vehicleId=enquiry?.vehicle_id??null;}
  }
  const {data:settingsRow}=await db.from("business_settings").select("settings").eq("business_id",businessId).maybeSingle();
  const settings=(settingsRow?.settings&&typeof settingsRow.settings==="object"?settingsRow.settings:{}) as unknown as import("@/lib/booking-rules").BookingPolicy;
  const policyError=validateBookingWindow(startsAt,endsAt,settings,now,bypassRestrictions);if(policyError)return jsonError(policyError,409);
  if(!bypassRestrictions){
   const {data:busyAppointments,error:conflictError}=await db.from("appointments").select("id,starts_at,ends_at").eq("business_id",businessId).in("status",["confirmed","rescheduled"]).not("starts_at","is",null);
   if(conflictError)return jsonError("Could not verify calendar availability.",500);
   const conflict=(busyAppointments??[]).some(existing=>bookingWindowsConflict(startsAt,endsAt,existing.starts_at,existing.ends_at,settings));
   if(conflict)return jsonError("That time conflicts with another booking or its travel buffer.",409);
  }
  const nowIso=now.toISOString();
  const {data:appointment,error}=await db.from("appointments").insert({business_id:businessId,customer_id:job.customer_id??null,user_id:job.user_id??null,quote_id:job.quote_id??null,enquiry_id:enquiryId,vehicle_id:vehicleId,guest_name:job.guest_name??null,guest_email:job.guest_email??null,starts_at:startsAt.toISOString(),ends_at:endsAt?.toISOString()??null,preferred_start:startsAt.toISOString(),preferred_end:null,location,status:"confirmed",confirmed_by:access.user!.id,confirmed_at:nowIso}).select("id,status,starts_at,ends_at,location,quote_id").single();
  if(error||!appointment)return jsonError("Could not create the appointment.",500);
  const {error:linkError}=await db.from("jobs").update({appointment_id:appointment.id,scheduled_start:appointment.starts_at,scheduled_end:appointment.ends_at??null,status:"scheduled",updated_at:nowIso}).eq("id",job.id).eq("business_id",businessId);
  if(linkError){await db.from("appointments").delete().eq("id",appointment.id).eq("business_id",businessId);return jsonError("Appointment could not be linked to the Workcard.",500);}
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"calendar.appointment_created",entity_type:"appointment",entity_id:appointment.id,details:{job_id:job.id,job_number:job.job_number,starts_at:appointment.starts_at,ends_at:appointment.ends_at,location}});
  return Response.json({appointment,jobId:job.id},{status:201});
 }catch(error){console.error("Calendar appointment creation failed",error);return jsonError("Could not create appointment.",500);}
}
