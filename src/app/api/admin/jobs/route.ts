import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;const db=database();
 const [{data:quotes},{data:staff}]=await Promise.all([
  db.from("quotes").select("id,quote_number,total,customer_id,customers(full_name)").eq("business_id",access.membership!.business_id).eq("status","accepted").order("created_at",{ascending:false}),
  db.from("staff").select("id,job_title,users(full_name)").eq("business_id",access.membership!.business_id).eq("employment_status","active")
 ]);
 return Response.json({quotes:quotes??[],staff:staff??[]});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const quoteId=String(body.quoteId??"");const title=String(body.title??"").trim();const scope=String(body.scope??"").trim().slice(0,5000);const priority=String(body.priority??"normal");const start=body.scheduledStart?new Date(String(body.scheduledStart)):null;const end=body.scheduledEnd?new Date(String(body.scheduledEnd)):null;const staffIds:string[]=Array.isArray(body.staffIds)?body.staffIds.map((x:unknown)=>String(x)):[];
  if(!/^[0-9a-f-]{36}$/i.test(quoteId)||title.length<3||title.length>180)return jsonError("Select an accepted quote and enter a job title.");
  if(!["low","normal","high","urgent"].includes(priority))return jsonError("Select a valid priority.");
  if(start&&!Number.isFinite(start.getTime())||end&&!Number.isFinite(end.getTime())||start&&end&&end<=start)return jsonError("Check the scheduled start and end times.");
  if(staffIds.length>20||staffIds.some(x=>!/^[0-9a-f-]{36}$/i.test(x)))return jsonError("Invalid staff selection.");
  const db=database();const {data:quote}=await db.from("quotes").select("id,customer_id,user_id,quote_number").eq("id",quoteId).eq("business_id",access.membership!.business_id).eq("status","accepted").maybeSingle();if(!quote)return jsonError("Accepted quote not found.",404);
  if(staffIds.length){const {data:staff}=await db.from("staff").select("id").eq("business_id",access.membership!.business_id).eq("employment_status","active").in("id",staffIds);if((staff??[]).length!==staffIds.length)return jsonError("One or more selected staff members are not active.");}
  const jobNumber="BRV-"+Date.now().toString(36).toUpperCase();
  const {data:job,error}=await db.from("jobs").insert({business_id:access.membership!.business_id,customer_id:quote.customer_id,user_id:quote.user_id,quote_id:quote.id,job_number:jobNumber,title,scope_of_work:scope||null,status:"scheduled",priority,scheduled_start:start?.toISOString()??null,scheduled_end:end?.toISOString()??null}).select("id,job_number,title").single();
  if(error||!job)return jsonError("Could not create job.",500);
  if(staffIds.length){const {error:assignmentError}=await db.from("job_assignments").insert(staffIds.map((staff_id:string)=>({business_id:access.membership!.business_id,job_id:job.id,staff_id,assigned_by:access.user!.id,status:"assigned"})));if(assignmentError){await db.from("jobs").delete().eq("id",job.id);return jsonError("Could not assign selected staff.",500);}}
  await db.from("quotes").update({status:"converted",updated_at:new Date().toISOString()}).eq("id",quote.id);
  await db.from("audit_events").insert({business_id:access.membership!.business_id,actor_user_id:access.user!.id,action:"job.created",entity_type:"job",entity_id:job.id,details:{job_number:jobNumber,quote_id:quote.id,staff_ids:staffIds}});
  return Response.json({job},{status:201});
 }catch{return jsonError("Could not create job.",500);}
}