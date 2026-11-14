import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
import {bookingTravelBuffer,validateBookingWindow} from "@/lib/booking-rules";
import {isManagerOrAbove} from "@/lib/user-role-policy.mjs";
export const runtime="nodejs";
const idPattern=/^[0-9a-f-]{36}$/i;

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 try{
  const {id}=await params,body=await request.json();
  if(!idPattern.test(id))return jsonError("Invalid Workcard ID.");
  const startsAt=new Date(String(body.starts_at??""));
  const endsAt=body.ends_at?new Date(String(body.ends_at)):null;
  const location=String(body.location??"").trim().slice(0,200);
  const bypassRestrictions=isManagerOrAbove(access.user?.user_role);
  if(!Number.isFinite(startsAt.getTime())||(endsAt&&(!Number.isFinite(endsAt.getTime())||endsAt<=startsAt)))return jsonError("Enter a valid booking start time.");
  if(!bypassRestrictions&&startsAt.getTime()<=Date.now())return jsonError("The booking must start in the future.");
  if(location.length<3)return jsonError("Enter the agreed customer service location.");
  const db=database(),businessId=access.membership!.business_id;
  const {data:job,error:jobError}=await db.from("jobs").select("id,job_number,status,appointment_id,quote_id,customer_id,user_id,guest_name,guest_email").eq("id",id).eq("business_id",businessId).maybeSingle();
  if(jobError||!job)return jsonError("Workcard not found.",404);
  if(["completed","cancelled"].includes(job.status))return jsonError("A booking cannot be confirmed for a closed Workcard.",409);
  let quote:any=null,enquiryId:string|null=null,vehicleId:string|null=null;
  if(job.quote_id){
   const result=await db.from("quotes").select("id,status,enquiry_id").eq("id",job.quote_id).eq("business_id",businessId).maybeSingle();quote=result.data;
   if(!quote||quote.status!=="accepted")return jsonError("The linked quote must be accepted before a booking can be confirmed.",409);
   enquiryId=quote.enquiry_id??null;
   if(enquiryId){const e=await db.from("enquiries").select("vehicle_id").eq("id",enquiryId).eq("business_id",businessId).maybeSingle();vehicleId=e.data?.vehicle_id??null;}
  }
  let existing:any=null;
  let existingError:any=null;
  if(job.appointment_id){
   const result=await db.from("appointments").select("id,status,quote_id,starts_at,ends_at,location,confirmed_by,confirmed_at,updated_at").eq("id",job.appointment_id).eq("business_id",businessId).maybeSingle();
   existing=result.data;existingError=result.error;
  }
  if(existingError)return jsonError("Could not load the customer's booking request.",500);
  if(existing&&!["requested","confirmed","rescheduled"].includes(existing.status))existing=null;
  if(!existing&&job.quote_id){
   const result=await db.from("appointments").select("id,status,quote_id,starts_at,ends_at,location,confirmed_by,confirmed_at,updated_at").eq("quote_id",job.quote_id).eq("business_id",businessId).in("status",["requested","confirmed","rescheduled"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
   existing=result.data;existingError=result.error;
  }
  if(existingError)return jsonError("Could not load the customer's booking request.",500);
  if(existing&&existing.status==="confirmed"&&existing.id!==job.appointment_id)return jsonError("Another confirmed booking already exists for this quote.",409);
  const {data:settingsRow}=await db.from("business_settings").select("settings").eq("business_id",businessId).maybeSingle();
  const settings=(settingsRow?.settings&&typeof settingsRow.settings==="object"?settingsRow.settings:{}) as unknown as import("@/lib/booking-rules").BookingPolicy;
  const policyError=validateBookingWindow(startsAt,endsAt,settings,new Date(),bypassRestrictions);if(policyError)return jsonError(policyError,409);
  if(endsAt&&!bypassRestrictions){
   const buffer=bookingTravelBuffer(settings),bufferedStart=new Date(startsAt.getTime()-buffer*60000).toISOString(),bufferedEnd=new Date(endsAt.getTime()+buffer*60000).toISOString();
   const {data:conflicts,error:conflictError}=await db.from("appointments").select("id").eq("business_id",businessId).neq("id",existing?.id??"00000000-0000-0000-0000-000000000000").in("status",["confirmed","rescheduled"]).not("starts_at","is",null).lt("starts_at",bufferedEnd).gt("ends_at",bufferedStart).limit(1);
   if(conflictError)return jsonError("Could not verify booking availability.",500);
   if(conflicts?.length)return jsonError("That time conflicts with another confirmed booking. Choose another time.",409);
  }
  const now=new Date().toISOString();
  let appointment:any;
  if(existing){
   if(!["requested","rescheduled","confirmed"].includes(existing.status))return jsonError("This booking request is no longer active.",409);
   const updated=await db.from("appointments").update({starts_at:startsAt.toISOString(),ends_at:endsAt?.toISOString()??null,location,status:"confirmed",confirmed_by:access.user!.id,confirmed_at:now,updated_at:now}).eq("id",existing.id).eq("business_id",businessId).in("status",["requested","rescheduled","confirmed"]).select("id,status,starts_at,ends_at,location").single();
   if(updated.error||!updated.data)return jsonError("Could not confirm the customer's booking request.",500);
   appointment=updated.data;
  }else{
   const inserted=await db.from("appointments").insert({business_id:businessId,customer_id:job.customer_id,user_id:job.user_id??null,enquiry_id:enquiryId,quote_id:job.quote_id,vehicle_id:vehicleId,starts_at:startsAt.toISOString(),ends_at:endsAt?.toISOString()??null,preferred_start:startsAt.toISOString(),preferred_end:null,location,status:"confirmed",confirmed_by:access.user!.id,confirmed_at:now}).select("id,status,starts_at,ends_at,location").single();
   if(inserted.error||!inserted.data){console.error("Workcard booking insert failed",inserted.error);return jsonError("Could not create booking.",500);}
   appointment=inserted.data;
  }
  const linked=await db.from("jobs").update({appointment_id:appointment.id,scheduled_start:appointment.starts_at,scheduled_end:appointment.ends_at??null,status:"scheduled",updated_at:now}).eq("id",id).eq("business_id",businessId);
  if(linked.error){
   console.error("Workcard booking link failed",linked.error);
   if(existing)await db.from("appointments").update({status:existing.status,starts_at:existing.starts_at,ends_at:existing.ends_at,location:existing.location,confirmed_by:existing.confirmed_by??null,confirmed_at:existing.confirmed_at??null,updated_at:existing.updated_at??new Date().toISOString()}).eq("id",appointment.id).eq("business_id",businessId);
   else await db.from("appointments").delete().eq("id",appointment.id).eq("business_id",businessId);
   return jsonError("Booking was not saved because it could not be linked to the Workcard.",500);
  }
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:existing?"workcard.booking_confirmed":"workcard.booking_created",entity_type:"job",entity_id:id,details:{job_number:job.job_number,appointment_id:appointment.id,booking_request_accepted:existing?.status==="requested",starts_at:appointment.starts_at,ends_at:appointment.ends_at,location}});
  return Response.json({appointment,acceptedRequest:existing?.status==="requested"},{status:existing?200:201});
 }catch(error){console.error("Workcard booking confirmation failed",error);return jsonError("Could not confirm or create booking.",500);}
}
