import {currentUser,currentMembership,database,userHasPermission,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);const membership=await currentMembership(user.id);if(!membership||!(await userHasPermission(user.id,"jobs.assign")))return jsonError("You do not have permission to assign jobs.",403);
 const {id}=await params;const db=database();const {data:job}=await db.from("jobs").select("id,workcard_review_status").eq("id",id).eq("business_id",membership.business_id).maybeSingle();if(!job)return jsonError("Workcard not found.",404);if(!["approved","legacy_approved"].includes(String(job.workcard_review_status??"legacy_approved")))return jsonError("The Workcard must pass senior setup review before it can be assigned.",409);
 const [{data:staff},{data:assignments}]=await Promise.all([db.from("staff").select("id,user_id,job_title,employment_status,full_name,email").eq("business_id",membership.business_id).eq("employment_status","active"),db.from("job_assignments").select("staff_id,status").eq("job_id",id)]);
 return Response.json({staff:staff??[],assignments:assignments??[]});
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const user=await currentUser();if(!user)return jsonError("Not signed in.",401);const membership=await currentMembership(user.id);if(!membership||!(await userHasPermission(user.id,"jobs.assign")))return jsonError("You do not have permission to assign jobs.",403);
 try{
  const {id}=await params;const body=await request.json();const ids:string[]=Array.isArray(body.staffIds)?body.staffIds.map((x:unknown)=>String(x)):[];if(ids.length>20||ids.some(x=>!/^[0-9a-f-]{36}$/i.test(x)))return jsonError("Invalid staff selection.");
  const db=database();const {data:job}=await db.from("jobs").select("id").eq("id",id).eq("business_id",membership.business_id).maybeSingle();if(!job)return jsonError("Job not found.",404);
  if(ids.length){const {data:staff}=await db.from("staff").select("id").eq("business_id",membership.business_id).eq("employment_status","active").in("id",ids);if((staff??[]).length!==ids.length)return jsonError("One or more staff members are not active in this business.");}
  const {data:currentAssignments,error:currentError}=await db.from("job_assignments").select("id,staff_id,status").eq("job_id",id).eq("business_id",membership.business_id);
  if(currentError)return jsonError("Could not load current assignments.",500);
  const currentByStaff=new Map((currentAssignments??[]).map(x=>[x.staff_id,x]));
  const wanted=new Set(ids);
  const remove=(currentAssignments??[]).filter(x=>!wanted.has(x.staff_id)&&x.status!=="removed");
  const add=ids.filter((staff_id:string)=>!currentByStaff.has(staff_id));
  const restore=ids.filter((staff_id:string)=>["removed","declined"].includes(String(currentByStaff.get(staff_id)?.status)));
  if(remove.length){const {error}=await db.from("job_assignments").update({status:"removed"}).in("id",remove.map(x=>x.id));if(error)return jsonError("Could not release previous assignments.",500);}
  if(add.length){const {error}=await db.from("job_assignments").insert(add.map((staff_id:string)=>({business_id:membership.business_id,job_id:id,staff_id,assigned_by:user.id,status:"assigned"})));if(error)return jsonError("Could not save new assignments.",500);}
  if(restore.length){const {error}=await db.from("job_assignments").update({status:"assigned",assigned_by:user.id,assigned_at:new Date().toISOString()}).eq("job_id",id).in("staff_id",restore);if(error)return jsonError("Could not restore previous assignments.",500);}
  await db.from("audit_events").insert({business_id:membership.business_id,actor_user_id:user.id,action:"job.staff_assigned",entity_type:"job",entity_id:id,details:{staff_ids:ids}});
  return Response.json({success:true});
 }catch{return jsonError("Could not assign staff.",500);}
}
