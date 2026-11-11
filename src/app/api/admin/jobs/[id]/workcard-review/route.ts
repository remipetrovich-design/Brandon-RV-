import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 const {id}=await params;
 const {data:job,error}=await database().from("jobs").select("id,job_number,title,quote_id,workcard_review_status,workcard_reviewed_by,workcard_reviewed_at,workcard_review_note").eq("id",id).eq("business_id",access.membership!.business_id).maybeSingle();
 if(error||!job)return jsonError("Workcard not found.",404);
 return Response.json({job,reviewedByCurrentUser:job.workcard_reviewed_by===access.user!.id});
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 try{
  const {id}=await params,body=await request.json();
  const decision=String(body.decision??""),note=String(body.note??"").trim().slice(0,2000);
  if(!["approved","changes_requested"].includes(decision))return jsonError("Choose approve or request changes.");
  if(decision==="changes_requested"&&note.length<5)return jsonError("Describe the changes required.");
  const {data,error}=await database().rpc("review_workcard_setup",{p_job_id:id,p_business_id:access.membership!.business_id,p_actor_user_id:access.user!.id,p_decision:decision,p_note:note||null});
  if(error){if(error.code==="P0001")return jsonError(error.message??"This Workcard is no longer awaiting setup review.",409);return jsonError("Could not record Workcard review. No changes were made.",500);}
  return Response.json(data);
 }catch{return jsonError("Could not review Workcard setup.",500);}
}
