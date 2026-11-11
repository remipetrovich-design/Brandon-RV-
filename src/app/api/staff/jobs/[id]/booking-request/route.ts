import {currentUser,currentMembership,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 const membership=await currentMembership(user.id);if(!membership)return jsonError("Staff access required.",403);
 try{
  const {id}=await params,body=await request.json();
  const start=new Date(String(body.preferredStart??"")),location=String(body.location??"").trim(),notes=String(body.notes??"").trim().slice(0,2000);
  if(!Number.isFinite(start.getTime())||start.getTime()<=Date.now())return jsonError("Choose a future preferred booking time.");
  if(location.length<3||location.length>200)return jsonError("Enter the customer-site location.");
  const db=database(),businessId=membership.business_id;
  const {data:staff}=await db.from("staff").select("id").eq("user_id",user.id).eq("business_id",businessId).maybeSingle();
  if(!staff)return jsonError("Employee profile not found.",404);
  const {data:job}=await db.from("jobs").select("id,quote_id,customer_id,user_id,guest_name,guest_email,appointment_id,workcard_review_status").eq("id",id).eq("business_id",businessId).maybeSingle();
  if(!job)return jsonError("Workcard not found.",404);
  if(!["approved","legacy_approved"].includes(String(job.workcard_review_status??"legacy_approved")))return jsonError("This Workcard has not passed senior setup review.",409);
  const {data:assignment}=await db.from("job_assignments").select("status").eq("job_id",id).eq("staff_id",staff.id).maybeSingle();
  if(assignment?.status!=="accepted")return jsonError("Accept the Workcard assignment before arranging a booking.",403);
  if(!job.quote_id)return jsonError("The Workcard has no accepted quote.",409);
  const {data:quote}=await db.from("quotes").select("id,status,enquiry_id").eq("id",job.quote_id).eq("business_id",businessId).maybeSingle();
  if(!quote||quote.status!=="accepted")return jsonError("Only an accepted quote can be booked.",409);
  const {data:existing}=await db.from("appointments").select("id,status").eq("business_id",businessId).eq("quote_id",quote.id).in("status",["requested","confirmed","rescheduled"]).limit(1).maybeSingle();
  if(existing)return jsonError("A booking request already exists for this quote. Open the existing appointment to update it.",409);
  const durationRaw=Number(body.durationMinutes??60),duration=Number.isFinite(durationRaw)?Math.min(480,Math.max(15,durationRaw)):60;
  const end=new Date(start.getTime()+duration*60000).toISOString();
  const {data:enquiry}=await db.from("enquiries").select("id,vehicle_id,contact_name,email").eq("id",quote.enquiry_id).eq("business_id",businessId).maybeSingle();
  if(!enquiry)return jsonError("The customer Jobcard could not be found.",404);
  const {data:appointment,error}=await db.from("appointments").insert({
   business_id:businessId,customer_id:job.customer_id,user_id:job.user_id,enquiry_id:enquiry.id,quote_id:quote.id,
   vehicle_id:enquiry.vehicle_id,guest_name:job.guest_name??enquiry.contact_name,guest_email:job.guest_email??enquiry.email,
   preferred_start:start.toISOString(),preferred_end:end,location,customer_notes:notes||null,status:"requested"
  }).select("id,status,preferred_start,preferred_end,location").single();
  if(error||!appointment)return jsonError("Could not submit the booking request.",500);
  await db.from("jobs").update({appointment_id:appointment.id,updated_at:new Date().toISOString()}).eq("id",id).eq("business_id",businessId);
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:user.id,action:"workcard.booking_requested",entity_type:"job",entity_id:id,details:{appointment_id:appointment.id,quote_id:quote.id}});
  return Response.json({success:true,appointment,message:"Booking request sent to management. The visit is not confirmed until the date, time and location are approved."},{status:201});
 }catch{return jsonError("Could not submit the booking request.",500);}
}
