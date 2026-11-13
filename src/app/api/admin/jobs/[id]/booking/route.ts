import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
const idPattern=/^[0-9a-f-]{36}$/i;

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 try{
  const {id}=await params,body=await request.json();
  if(!idPattern.test(id))return jsonError("Invalid Workcard ID.");
  const startsAt=new Date(String(body.starts_at??"")),endsAt=new Date(String(body.ends_at??""));
  const location=String(body.location??"").trim().slice(0,200);
  if(!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())||endsAt<=startsAt)return jsonError("Enter a valid booking start and finish time.");
  if(startsAt.getTime()<=Date.now())return jsonError("The booking must start in the future.");
  if(location.length<3)return jsonError("Enter the agreed customer service location.");
  const db=database(),businessId=access.membership!.business_id;
  const {data:job,error:jobError}=await db.from("jobs").select("id,job_number,status,appointment_id,quote_id,customer_id,user_id,guest_name,guest_email").eq("id",id).eq("business_id",businessId).maybeSingle();
  if(jobError||!job)return jsonError("Workcard not found.",404);
  if(["completed","cancelled"].includes(job.status))return jsonError("A booking cannot be created for a closed Workcard.",409);
  if(job.appointment_id)return jsonError("This Workcard already has a linked booking. Open the Booking tab to view it.",409);
  let enquiryId:string|null=null,vehicleId:string|null=null;
  if(job.quote_id){
   const {data:quote}=await db.from("quotes").select("id,status,enquiry_id").eq("id",job.quote_id).eq("business_id",businessId).maybeSingle();
   if(!quote||quote.status!=="accepted")return jsonError("The linked quote must remain accepted before a booking can be created.",409);
   enquiryId=quote.enquiry_id??null;
   if(enquiryId){const {data:enquiry}=await db.from("enquiries").select("vehicle_id").eq("id",enquiryId).eq("business_id",businessId).maybeSingle();vehicleId=enquiry?.vehicle_id??null;}
  }
  const {data:conflicts,error:conflictError}=await db.from("appointments").select("id").eq("business_id",businessId).in("status",["confirmed","rescheduled"]).not("starts_at","is",null).lt("starts_at",endsAt.toISOString()).gt("ends_at",startsAt.toISOString()).limit(1);
  if(conflictError)return jsonError("Could not verify booking availability.",500);
  if(conflicts?.length)return jsonError("That time conflicts with another confirmed booking. Choose another time.",409);
  const now=new Date().toISOString();
  const {data:appointment,error}=await db.from("appointments").insert({
   business_id:businessId,customer_id:job.user_id??null,user_id:job.user_id??null,
   guest_name:job.guest_name??null,guest_email:job.guest_email??null,
   enquiry_id:enquiryId,quote_id:job.quote_id,vehicle_id:vehicleId,
   starts_at:startsAt.toISOString(),ends_at:endsAt.toISOString(),
   preferred_start:startsAt.toISOString(),preferred_end:endsAt.toISOString(),
   location,status:"confirmed",confirmed_by:access.user!.id,confirmed_at:now
  }).select("id,status,starts_at,ends_at,location").single();
  if(error||!appointment){console.error("Workcard booking insert failed",error);return jsonError("Could not create booking.",500);}
  const {error:linkError}=await db.from("jobs").update({appointment_id:appointment.id,scheduled_start:appointment.starts_at,scheduled_end:appointment.ends_at,status:"scheduled",updated_at:now}).eq("id",id).eq("business_id",businessId).is("appointment_id",null);
  if(linkError){
   console.error("Workcard booking link failed",linkError);
   await db.from("appointments").delete().eq("id",appointment.id).eq("business_id",businessId);
   return jsonError("The booking was not saved because it could not be linked to the Workcard.",500);
  }
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"workcard.booking_created",entity_type:"job",entity_id:id,details:{job_number:job.job_number,appointment_id:appointment.id,starts_at:appointment.starts_at,ends_at:appointment.ends_at,location}});
  return Response.json({appointment},{status:201});
 }catch(error){console.error("Workcard booking creation failed",error);return jsonError("Could not create booking.",500);}
}
