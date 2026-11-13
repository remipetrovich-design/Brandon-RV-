import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
const idPattern=/^[0-9a-f-]{36}$/i;
const types=["labour","parts","note","test"];
const clean=(v:unknown,max:number)=>String(v??"").trim().slice(0,max);
function parse(body:any){
 const entryType=String(body.entry_type??"parts");
 const description=clean(body.description,500);
 const quantityRequired=Number(body.quantity_required??0);
 const quantityUsed=Number(body.quantity_used??0);
 const unitPrice=Number(body.unit_price??0);
 const costUnitPrice=Number(body.cost_unit_price??0);
 const taxRate=Number(body.tax_rate??0);
 if(!types.includes(entryType)||description.length<3)return {error:"Choose a valid entry type and enter a description."};
 if(![quantityRequired,quantityUsed,unitPrice,costUnitPrice,taxRate].every(Number.isFinite)||quantityRequired<0||quantityUsed<0||quantityRequired>10000||quantityUsed>10000||unitPrice<0||costUnitPrice<0||unitPrice>10000000||costUnitPrice>10000000||taxRate<0||taxRate>100)return {error:"Enter valid quantities, costs, charge prices and tax."};
 if(body.invoiceable===true&&(!["labour","parts"].includes(entryType)||quantityUsed<=0))return {error:"Only labour or parts with an actual quantity used can be invoiced."};
 return {value:{entry_type:entryType,description,quantity:quantityUsed||1,quantity_required:quantityRequired,quantity_used:quantityUsed,unit_price:unitPrice,cost_unit_price:costUnitPrice,tax_rate:taxRate,line_total:Number((quantityUsed*unitPrice).toFixed(2)),part_number:clean(body.part_number,100)||null,supplier_name:clean(body.supplier_name,160)||null,customer_visible:body.customer_visible!==false,invoiceable:body.invoiceable===true,service_id:body.service_id&&idPattern.test(String(body.service_id))?String(body.service_id):null}};
}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 const {id}=await params;if(!idPattern.test(id))return jsonError("Invalid Workcard ID.");
 const db=database(),businessId=access.membership!.business_id;
 const {data:job,error}=await db.from("jobs").select("id,job_number,title,status,priority,scope_of_work,customer_visible_notes,scheduled_start,scheduled_end,worker_signed_off_at,senior_approval_status,customer_approval_status").eq("id",id).eq("business_id",businessId).maybeSingle();
 if(error){console.error("Workcard lookup failed",error);return jsonError("Could not load Workcard details.",500);}
 if(!job)return jsonError("Workcard not found.",404);
 const [{data:entries,error:entryError},{data:services,error:serviceError}]=await Promise.all([
  db.from("job_work_entries").select("id,entry_type,description,quantity,quantity_required,quantity_used,unit_price,cost_unit_price,tax_rate,line_total,part_number,supplier_name,customer_visible,invoiceable,service_id,staff_id,occurred_at,services(name)").eq("business_id",businessId).eq("job_id",id).order("created_at"),
  db.from("services").select("id,name,category,description,price_from,approval_status").eq("business_id",businessId).eq("is_active",true).order("sort_order").order("name")
 ]);
 if(entryError||serviceError){console.error("Workcard details query failed",{entryError,serviceError});return jsonError("Could not load Workcard entries or service presets.",500);}
 return Response.json({job,entries:entries??[],services:services??[]});
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 try{
  const {id}=await params,body=await request.json(),parsed=parse(body);
  if(!idPattern.test(id))return jsonError("Invalid Workcard ID.");
  if(parsed.error)return jsonError(parsed.error);
  const db=database(),businessId=access.membership!.business_id;
  const {data:job,error:jobError}=await db.from("jobs").select("id,status,worker_signed_off_at").eq("id",id).eq("business_id",businessId).maybeSingle();
  if(jobError||!job)return jsonError("Workcard not found.",404);
  if(job.worker_signed_off_at||["completed","cancelled"].includes(job.status))return jsonError("This Workcard is signed off or closed. Record additional work through an approved variation.",409);
  const value=parsed.value!;
  if(value.service_id){const {data:service}=await db.from("services").select("id,name,is_active").eq("id",value.service_id).eq("business_id",businessId).maybeSingle();if(!service||!service.is_active)return jsonError("Select an active service from this business.");}
  const {data:entry,error}=await db.from("job_work_entries").insert({...value,business_id:businessId,job_id:id,created_by:access.user!.id}).select("id,entry_type,description,quantity,quantity_required,quantity_used,unit_price,cost_unit_price,tax_rate,line_total,part_number,supplier_name,customer_visible,invoiceable,service_id").single();
  if(error||!entry){console.error("Workcard entry insert failed",error);return jsonError("Could not add Workcard entry.",500);}
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"workcard.entry_created",entity_type:"job_work_entry",entity_id:entry.id,details:{job_id:id,entry_type:entry.entry_type,description:entry.description,invoiceable:entry.invoiceable}});
  return Response.json({entry},{status:201});
 }catch(error){console.error("Workcard entry creation failed",error);return jsonError("Could not add Workcard entry.",500);}
}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 try{
  const {id}=await params,body=await request.json(),entryId=String(body.id??""),parsed=parse(body);
  if(!idPattern.test(id)||!idPattern.test(entryId))return jsonError("Invalid Workcard entry.");
  if(parsed.error)return jsonError(parsed.error);
  const db=database(),businessId=access.membership!.business_id;
  const {data:job}=await db.from("jobs").select("id,status,worker_signed_off_at").eq("id",id).eq("business_id",businessId).maybeSingle();
  if(!job)return jsonError("Workcard not found.",404);
  if(job.worker_signed_off_at||["completed","cancelled"].includes(job.status))return jsonError("This Workcard is signed off or closed. Record additional work through an approved variation.",409);
  const value=parsed.value!;
  if(value.service_id){const {data:service}=await db.from("services").select("id").eq("id",value.service_id).eq("business_id",businessId).eq("is_active",true).maybeSingle();if(!service)return jsonError("Select an active service from this business.");}
  const {data:entry,error}=await db.from("job_work_entries").update(value).eq("id",entryId).eq("job_id",id).eq("business_id",businessId).select("id,entry_type,description,quantity,quantity_required,quantity_used,unit_price,cost_unit_price,tax_rate,line_total,part_number,supplier_name,customer_visible,invoiceable,service_id").maybeSingle();
  if(error||!entry){console.error("Workcard entry update failed",error);return jsonError("Could not update Workcard entry.",500);}
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"workcard.entry_updated",entity_type:"job_work_entry",entity_id:entryId,details:{job_id:id,invoiceable:entry.invoiceable}});
  return Response.json({entry});
 }catch(error){console.error("Workcard entry update failed",error);return jsonError("Could not update Workcard entry.",500);}
}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 const {id}=await params,entryId=new URL(request.url).searchParams.get("entryId")??"";
 if(!idPattern.test(id)||!idPattern.test(entryId))return jsonError("Invalid Workcard entry.");
 const db=database(),businessId=access.membership!.business_id;
 const {data:job}=await db.from("jobs").select("id,status,worker_signed_off_at").eq("id",id).eq("business_id",businessId).maybeSingle();
 if(!job)return jsonError("Workcard not found.",404);
 if(job.worker_signed_off_at||["completed","cancelled"].includes(job.status))return jsonError("This Workcard is signed off or closed.",409);
 const {error}=await db.from("job_work_entries").delete().eq("id",entryId).eq("job_id",id).eq("business_id",businessId);
 if(error){console.error("Workcard entry delete failed",error);return jsonError("Could not delete Workcard entry.",500);}
 return Response.json({success:true});
}
