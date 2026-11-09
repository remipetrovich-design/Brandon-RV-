import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;const db=database();
 const [{data:appointments,error},{data:staff}]=await Promise.all([
  db.from("appointments").select("id,quote_id,customer_id,user_id,guest_name,guest_email,location,starts_at,ends_at,quotes(quote_number,status)").eq("business_id",access.membership!.business_id).eq("status","confirmed").order("starts_at",{ascending:true}),
  db.from("staff").select("id,job_title,users(full_name)").eq("business_id",access.membership!.business_id).eq("employment_status","active")
 ]);
 if(error)return jsonError("Could not load confirmed bookings.",500);const ids=(appointments??[]).map(x=>x.id);
 const {data:existing}=ids.length?await db.from("jobs").select("appointment_id").in("appointment_id",ids):{data:[]};const used=new Set((existing??[]).map(x=>x.appointment_id));
 return Response.json({appointments:(appointments??[]).filter(x=>!used.has(x.id)),staff:staff??[]});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const appointmentId=String(body.appointmentId??"");if(!/^[0-9a-f-]{36}$/i.test(appointmentId))return jsonError("Select a confirmed booking.");
  const db=database();const {data:appointment}=await db.from("appointments").select("id,business_id,customer_id,user_id,guest_name,guest_email,quote_id,location,starts_at,ends_at,status").eq("id",appointmentId).eq("business_id",access.membership!.business_id).eq("status","confirmed").maybeSingle();
  if(!appointment||!appointment.quote_id||!appointment.starts_at||!appointment.ends_at||!appointment.location)return jsonError("Only a complete confirmed booking can create a Work Order.",409);
  const {data:quote}=await db.from("quotes").select("id,quote_number,status").eq("id",appointment.quote_id).eq("business_id",access.membership!.business_id).eq("status","accepted").maybeSingle();if(!quote)return jsonError("The booking must reference an accepted quote.",409);
  const {data:existing}=await db.from("jobs").select("id").eq("appointment_id",appointmentId).maybeSingle();if(existing)return Response.json({job:existing,alreadyCreated:true});
  const {data:items}=await db.from("quote_items").select("description").eq("quote_id",quote.id).order("sort_order");const title=items?.[0]?.description??("Work for quote "+quote.quote_number);
  const {data:job,error}=await db.from("jobs").insert({business_id:appointment.business_id,customer_id:appointment.customer_id,user_id:appointment.user_id,guest_name:appointment.guest_name,guest_email:appointment.guest_email,appointment_id:appointment.id,quote_id:quote.id,job_number:"BRV-"+Date.now().toString(36).toUpperCase(),title,scope_of_work:(items??[]).map((x:any)=>x.description).join("\n"),status:"pending",scheduled_start:appointment.starts_at,scheduled_end:appointment.ends_at}).select("id,job_number,title,status").single();
  if(error||!job)return jsonError("Could not create Work Order.",500);
  await db.from("audit_events").insert({business_id:appointment.business_id,actor_user_id:access.user!.id,action:"work_order.created_from_booking",entity_type:"job",entity_id:job.id,details:{appointment_id:appointment.id,quote_id:quote.id}});
  return Response.json({job},{status:201});
 }catch{return jsonError("Could not create Work Order.",500);}
}