import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 const {id}=await params;
 const {data:job,error}=await database().from("jobs").select("id,job_number,status,work_summary,worker_signed_off_by,worker_signed_off_at,senior_approval_status,senior_approved_by,senior_approved_at,senior_approval_note,customer_approval_status").eq("id",id).eq("business_id",access.membership!.business_id).maybeSingle();
 if(error||!job)return jsonError("Workcard not found.",404);
 const {data:photos}=await database().from("job_attachments").select("id,file_name,mime_type,storage_path,customer_visible,created_at").eq("business_id",access.membership!.business_id).eq("job_id",id).order("created_at",{ascending:false});
 const attachments=await Promise.all((photos??[]).map(async file=>{const {data:signed}=await database().storage.from("brandon-rv-private").createSignedUrl(file.storage_path,300);return {...file,url:signed?.signedUrl??null};}));
 return Response.json({job,attachments,workerSignedOffByCurrentUser:job.worker_signed_off_by===access.user!.id});
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 try{
  const {id}=await params,body=await request.json();
  const decision=String(body.decision??""),note=String(body.note??"").trim().slice(0,2000);
  if(!["approved","changes_requested"].includes(decision))return jsonError("Choose approve or request changes.");
  if(decision==="changes_requested"&&note.length<5)return jsonError("Describe the corrections required.");
  const {data,error}=await database().rpc("review_workcard",{p_job_id:id,p_business_id:access.membership!.business_id,p_actor_user_id:access.user!.id,p_decision:decision,p_note:note||null});
  if(error){if(error.code==="P0001")return jsonError("This Workcard is no longer awaiting senior review.",409);return jsonError("Could not record senior review. No changes were made.",500);}
  return Response.json(data);
 }catch{return jsonError("Could not review Workcard.",500);}
}
