import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 const {id}=await params;
 const {data:job,error}=await database().from("jobs").select("id,job_number,title,status,priority,scheduled_start,scheduled_end,scope_of_work,customer_visible_notes,worker_signed_off_at,senior_approval_status,customer_approval_status").eq("id",id).eq("business_id",access.membership!.business_id).maybeSingle();
 if(error||!job)return jsonError("Workcard not found.",404);
 return Response.json({job});
}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return jsonError("Invalid Workcard ID.");
 try{
  const body=await request.json(),db=database(),businessId=access.membership!.business_id;
  const {data:current,error:loadError}=await db.from("jobs").select("id,status,senior_approval_status,worker_signed_off_at,customer_approval_status").eq("id",id).eq("business_id",businessId).maybeSingle();
  if(loadError||!current)return jsonError("Workcard not found.",404);
  const patch:Record<string,unknown>={updated_at:new Date().toISOString()};
  if(body.title!==undefined){const v=String(body.title).trim();if(v.length<3||v.length>180)return jsonError("Workcard title must be between 3 and 180 characters.");patch.title=v;}
  if(body.scope_of_work!==undefined){const v=String(body.scope_of_work).trim();if(v.length<3||v.length>5000)return jsonError("Work scope must be between 3 and 5000 characters.");if(current.worker_signed_off_at)return jsonError("A signed-off Workcard cannot have its approved scope overwritten. Record a variation instead.",409);patch.scope_of_work=v;}
  if(body.customer_visible_notes!==undefined)patch.customer_visible_notes=String(body.customer_visible_notes).trim().slice(0,3000)||null;
  if(body.internal_notes!==undefined)patch.internal_notes=String(body.internal_notes).trim().slice(0,5000)||null;
  if(body.priority!==undefined){if(!["low","normal","high","urgent"].includes(String(body.priority)))return jsonError("Invalid Workcard priority.");patch.priority=body.priority;}
  if(body.estimated_hours!==undefined){if(body.estimated_hours===null||body.estimated_hours===""){patch.estimated_hours=null;}else{const hours=Number(body.estimated_hours);if(!Number.isFinite(hours)||hours<0||hours>1000)return jsonError("Enter valid estimated labour hours.");patch.estimated_hours=hours;}}
  if(body.status!==undefined){const next=String(body.status);if(!["pending","scheduled","in_progress","waiting_parts","completed","cancelled"].includes(next))return jsonError("Invalid Workcard status.");if(next==="completed"&&current.senior_approval_status!=="approved"&&current.senior_approval_status!=="legacy_approved")return jsonError("Senior approval is required before completing a Workcard.",409);if(next==="completed"&&current.customer_approval_status!=="approved")return jsonError("Customer approval is required before completing a Workcard.",409);patch.status=next;}
  for(const field of ["scheduled_start","scheduled_end"] as const){if(body[field]!==undefined){const value=body[field]?new Date(String(body[field])):null;if(value&&!Number.isFinite(value.getTime()))return jsonError("Enter a valid Workcard schedule.");patch[field]=value?.toISOString()??null;}}
  if(patch.scheduled_start&&patch.scheduled_end&&new Date(String(patch.scheduled_end))<=new Date(String(patch.scheduled_start)))return jsonError("Workcard end must be after its start.");
  if(Object.keys(patch).length===1)return jsonError("No Workcard changes supplied.");
  const {data:job,error}=await db.from("jobs").update(patch).eq("id",id).eq("business_id",businessId).select("id,job_number,title,status,priority,scheduled_start,scheduled_end,scope_of_work,customer_visible_notes,internal_notes").single();
  if(error||!job)return jsonError("Could not update Workcard.",500);
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"workcard.updated",entity_type:"job",entity_id:id,details:{fields:Object.keys(patch)}});
  return Response.json({job});
 }catch{return jsonError("Could not update Workcard.",500);}
}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 const {id}=await params,db=database(),businessId=access.membership!.business_id;
 const {data:job}=await db.from("jobs").select("id,status,worker_signed_off_at,customer_approval_status").eq("id",id).eq("business_id",businessId).maybeSingle();
 if(!job)return jsonError("Workcard not found.",404);
 if(job.status!=="pending"||job.worker_signed_off_at||job.customer_approval_status==="approved")return jsonError("Only an untouched pending Workcard can be deleted. Cancel or complete active Workcards instead.",409);
 const [{count:invoiceCount,error:invoiceError},{count:taskCount,error:taskError}]=await Promise.all([
  db.from("invoices").select("id",{count:"exact",head:true}).eq("business_id",businessId).eq("job_id",id),
  db.from("job_tasks").select("id",{count:"exact",head:true}).eq("business_id",businessId).eq("job_id",id)
 ]);
 if(invoiceError||taskError)return jsonError("Could not verify linked Workcard records.",500);
 if((invoiceCount??0)>0||(taskCount??0)>0)return jsonError("This Workcard has linked financial or task records. Cancel it instead of deleting it.",409);
 const {error}=await db.from("jobs").delete().eq("id",id).eq("business_id",businessId);
 if(error)return jsonError("Could not delete Workcard.",500);
 await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"workcard.deleted",entity_type:"job",entity_id:id,details:{job_number:job.id}});
 return Response.json({success:true});
}
