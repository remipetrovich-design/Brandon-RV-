import {currentUser,currentMembership,database,userHasPermission,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";

async function accessJob(jobId:string,userId:string,businessId:string){
 const db=database();
 const {data:staff}=await db.from("staff").select("id").eq("user_id",userId).eq("business_id",businessId).maybeSingle();
 if(!staff)return {db,staff:null,job:null,allowed:false};
 const [{data:job},{data:assignment}]=await Promise.all([
  db.from("jobs").select("id,status,customer_approval_status").eq("id",jobId).eq("business_id",businessId).maybeSingle(),
  db.from("job_assignments").select("id,status").eq("job_id",jobId).eq("staff_id",staff.id).maybeSingle()
 ]);
 const canManage=await userHasPermission(userId,"jobs.manage");
 return {db,staff,job,allowed:canManage||assignment?.status==="accepted",assignment};
}

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 const membership=await currentMembership(user.id);if(!membership)return jsonError("Staff access required.",403);
 const {id}=await params;const access=await accessJob(id,user.id,membership.business_id);
 if(!access.job||!access.allowed)return jsonError("Work Order not found or not assigned to you.",404);
 const {data:entries,error}=await access.db.from("job_work_entries").select("id,entry_type,description,quantity,unit_price,tax_rate,line_total,occurred_at,customer_visible,staff_id").eq("job_id",id).eq("business_id",membership.business_id).order("occurred_at",{ascending:false});
 if(error)return jsonError("Could not load Work Order entries.",500);
 return Response.json({entries:entries??[]});
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 const membership=await currentMembership(user.id);if(!membership)return jsonError("Staff access required.",403);
 const {id}=await params;
 try{
  const access=await accessJob(id,user.id,membership.business_id);
  if(!access.job||!access.allowed)return jsonError("Work Order not found or not assigned to you.",404);
  if(access.job.status!=="in_progress")return jsonError("Work entries can only be added while the Work Order is in progress.",409);
  const body=await request.json();const entryType=String(body.entryType??"note");
  const description=String(body.description??"").trim().slice(0,2000);
  const quantity=Number(body.quantity??1),unitPrice=Number(body.unitPrice??0);
  const customerVisible=body.customerVisible!==false;
  if(!["labour","parts","note"].includes(entryType)||description.length<2)return jsonError("Enter a valid work entry.");
  if(!Number.isFinite(quantity)||quantity<=0||quantity>10000||!Number.isFinite(unitPrice)||unitPrice<0||unitPrice>10000000)return jsonError("Enter valid quantity and price values.");
  const {data:businessSettings}=await access.db.from("business_settings").select("settings").eq("business_id",membership.business_id).maybeSingle();
  const configured=businessSettings?.settings&&typeof businessSettings.settings==="object"?businessSettings.settings as Record<string,any>:{};
  const pricing=configured.pricing&&typeof configured.pricing==="object"?configured.pricing:{};
  const gstStatus=String(pricing.gst_status??"not_configured"),configuredGstRate=Number(pricing.gst_rate??10);
  const taxRate=entryType==="note"?0:gstStatus==="registered"?configuredGstRate:0;
  const lineTotal=entryType==="note"?0:Number((quantity*unitPrice).toFixed(2));
  const {data:entry,error}=await access.db.from("job_work_entries").insert({
   business_id:membership.business_id,job_id:id,staff_id:access.staff?.id??null,created_by:user.id,
   entry_type:entryType,description,quantity,unit_price:unitPrice,tax_rate:taxRate,line_total:lineTotal,
   customer_visible:customerVisible
  }).select("id,entry_type,description,quantity,unit_price,tax_rate,line_total,occurred_at,customer_visible").single();
  if(error||!entry)return jsonError("Could not save Work Order entry.",500);
  await access.db.from("audit_events").insert({business_id:membership.business_id,actor_user_id:user.id,action:"work_order.entry_added",entity_type:"job",entity_id:id,details:{entry_id:entry.id,entry_type:entryType,customer_visible:customerVisible}});
  return Response.json({entry},{status:201});
 }catch{return jsonError("Could not save Work Order entry.",500);}
}
