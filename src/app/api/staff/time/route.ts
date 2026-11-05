import {currentUser,currentMembership,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
async function staffContext(){const user=await currentUser();if(!user)return {error:jsonError("Not signed in.",401)};const membership=await currentMembership(user.id);if(!membership)return {error:jsonError("Staff access required.",403)};const db=database();const {data:staff}=await db.from("staff").select("id").eq("user_id",user.id).eq("business_id",membership.business_id).maybeSingle();if(!staff)return {error:jsonError("Employee profile not found.",404)};return {user,membership,staff,db};}
export async function GET(){
 const ctx=await staffContext();if(ctx.error)return ctx.error;const {staff,db}=ctx;
 const [{data:active},{data:recent}]=await Promise.all([
  db.from("time_entries").select("id,entry_type,started_at,job_id").eq("staff_id",staff.id).is("ended_at",null).maybeSingle(),
  db.from("time_entries").select("id,entry_type,started_at,ended_at,duration_minutes,notes").eq("staff_id",staff.id).order("started_at",{ascending:false}).limit(10)
 ]);
 return Response.json({active:active??null,recent:recent??[]});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const ctx=await staffContext();if(ctx.error)return ctx.error;const {user,membership,staff,db}=ctx;
 try{
  const body=await request.json();const action=String(body.action??"");const now=new Date();
  if(action==="start"){
   const {data:active}=await db.from("time_entries").select("id").eq("staff_id",staff.id).is("ended_at",null).maybeSingle();if(active)return jsonError("You already have an active time entry.",409);
   const jobId=body.jobId?String(body.jobId):null;
   if(jobId){const {data:assignment}=await db.from("job_assignments").select("id").eq("job_id",jobId).eq("staff_id",staff.id).in("status",["assigned","accepted"]).maybeSingle();if(!assignment)return jsonError("You are not assigned to this job.",403);}
   const entryType=body.entryType==="travel"?"travel":"work";
   const {data:entry,error}=await db.from("time_entries").insert({business_id:membership.business_id,staff_id:staff.id,job_id:jobId,entry_type:entryType,started_at:now.toISOString()}).select("id,entry_type,started_at,job_id").single();
   if(error||!entry)return jsonError("Could not start time entry.",500);return Response.json({active:entry},{status:201});
  }
  if(action==="stop"){
   const {data:active}=await db.from("time_entries").select("id,started_at").eq("staff_id",staff.id).is("ended_at",null).maybeSingle();if(!active)return jsonError("There is no active time entry.",409);
   const duration=Math.max(0,Math.round((now.getTime()-new Date(active.started_at).getTime())/60000));
   const {error}=await db.from("time_entries").update({ended_at:now.toISOString(),duration_minutes:duration}).eq("id",active.id).eq("staff_id",staff.id);
   if(error)return jsonError("Could not stop time entry.",500);return Response.json({success:true,durationMinutes:duration});
  }
  return jsonError("Choose start or stop.");
 }catch{return jsonError("Could not update time entry.",500);}
}