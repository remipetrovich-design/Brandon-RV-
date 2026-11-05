import {currentUser,currentMembership,database,userHasPermission,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const user=await currentUser();if(!user)return jsonError("Not signed in.",401);const membership=await currentMembership(user.id);if(!membership)return jsonError("Staff access required.",403);
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return jsonError("Invalid task.");
 try{
  const body=await request.json();const status=String(body.status??"");if(!["in_progress","blocked","completed"].includes(status))return jsonError("Invalid task status.");
  const db=database();const {data:staff}=await db.from("staff").select("id").eq("user_id",user.id).eq("business_id",membership.business_id).maybeSingle();if(!staff)return jsonError("Employee profile not found.",404);
  const canManage=await userHasPermission(user.id,"jobs.manage");
  let query=db.from("job_tasks").select("id,job_id,assigned_staff_id").eq("id",id).eq("business_id",membership.business_id);
  if(!canManage)query=query.eq("assigned_staff_id",staff.id);
  const {data:task}=await query.maybeSingle();if(!task)return jsonError("Task not found or not assigned to you.",404);
  const now=new Date().toISOString();const {error}=await db.from("job_tasks").update({status,completed_at:status==="completed"?now:null,updated_at:now}).eq("id",id);
  if(error)return jsonError("Could not update task.",500);
  await db.from("audit_events").insert({business_id:membership.business_id,actor_user_id:user.id,action:"job_task."+status,entity_type:"job_task",entity_id:id,details:{job_id:task.job_id}});
  return Response.json({success:true});
 }catch{return jsonError("Could not update task.",500);}
}