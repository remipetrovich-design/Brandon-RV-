import {currentUser,currentMembership,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const user=await currentUser();if(!user)return jsonError("Not signed in.",401);const membership=await currentMembership(user.id);if(!membership||!(await userHasPermission(user.id,"jobs.manage")))return jsonError("You do not have permission to create job tasks.",403);
 try{
  const {id}=await params;const body=await request.json();const title=String(body.title??"").trim();const description=String(body.description??"").trim().slice(0,3000);const assignedStaffId=body.assignedStaffId?String(body.assignedStaffId):null;const dueAt=body.dueAt?new Date(String(body.dueAt)):null;
  if(title.length<3||title.length>160)return jsonError("Enter a task title.");if(dueAt&&!Number.isFinite(dueAt.getTime()))return jsonError("Enter a valid due date.");
  const db=database();const {data:job}=await db.from("jobs").select("id").eq("id",id).eq("business_id",membership.business_id).maybeSingle();if(!job)return jsonError("Job not found.",404);
  if(assignedStaffId){const {data:staff}=await db.from("staff").select("id").eq("id",assignedStaffId).eq("business_id",membership.business_id).eq("employment_status","active").maybeSingle();if(!staff)return jsonError("Select an active staff member.");}
  const {data:task,error}=await db.from("job_tasks").insert({business_id:membership.business_id,job_id:id,title,description:description||null,assigned_staff_id:assignedStaffId,due_at:dueAt?.toISOString()??null}).select("id,title,status").single();
  if(error||!task)return jsonError("Could not create task.",500);
  await db.from("audit_events").insert({business_id:membership.business_id,actor_user_id:user.id,action:"job.task_created",entity_type:"job_task",entity_id:task.id,details:{job_id:id,title}});
  return Response.json({task},{status:201});
 }catch{return jsonError("Could not create job task.",500);}
}