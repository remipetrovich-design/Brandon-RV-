import {currentUser,currentMembership,database,userHasPermission,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);const membership=await currentMembership(user.id);if(!membership||!(await userHasPermission(user.id,"jobs.assign")))return jsonError("You do not have permission to assign jobs.",403);
 const {id}=await params;const db=database();const {data:job}=await db.from("jobs").select("id").eq("id",id).eq("business_id",membership.business_id).maybeSingle();if(!job)return jsonError("Job not found.",404);
 const [{data:staff},{data:assignments}]=await Promise.all([db.from("staff").select("id,user_id,job_title,employment_status,users(full_name,email)").eq("business_id",membership.business_id).eq("employment_status","active"),db.from("job_assignments").select("staff_id,status").eq("job_id",id)]);
 return Response.json({staff:staff??[],assignments:assignments??[]});
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const user=await currentUser();if(!user)return jsonError("Not signed in.",401);const membership=await currentMembership(user.id);if(!membership||!(await userHasPermission(user.id,"jobs.assign")))return jsonError("You do not have permission to assign jobs.",403);
 try{
  const {id}=await params;const body=await request.json();const ids:string[]=Array.isArray(body.staffIds)?body.staffIds.map((x:unknown)=>String(x)):[];if(ids.length>20||ids.some(x=>!/^[0-9a-f-]{36}$/i.test(x)))return jsonError("Invalid staff selection.");
  const db=database();const {data:job}=await db.from("jobs").select("id").eq("id",id).eq("business_id",membership.business_id).maybeSingle();if(!job)return jsonError("Job not found.",404);
  if(ids.length){const {data:staff}=await db.from("staff").select("id").eq("business_id",membership.business_id).eq("employment_status","active").in("id",ids);if((staff??[]).length!==ids.length)return jsonError("One or more staff members are not active in this business.");}
  await db.from("job_assignments").delete().eq("job_id",id);
  if(ids.length){const {error}=await db.from("job_assignments").insert(ids.map((staff_id:string)=>({business_id:membership.business_id,job_id:id,staff_id,assigned_by:user.id,status:"assigned"})));if(error)return jsonError("Could not save job assignments.",500);}
  await db.from("audit_events").insert({business_id:membership.business_id,actor_user_id:user.id,action:"job.staff_assigned",entity_type:"job",entity_id:id,details:{staff_ids:ids}});
  return Response.json({success:true});
 }catch{return jsonError("Could not assign staff.",500);}
}