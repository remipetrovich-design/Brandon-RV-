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
 const {data:baseJob,error:jobError}=await db.from("jobs")
  .select("id,job_number,title,status,priority,scope_of_work,customer_visible_notes,internal_notes,guest_name,guest_email,estimated_hours,actual_hours,work_summary,scheduled_start,scheduled_end,worker_signed_off_at,senior_approval_status,customer_approval_status,appointment_id,quote_id,customers:users!jobs_customer_id_users_fkey(full_name,email,phone)")
  .eq("id",id).eq("business_id",businessId).maybeSingle();
 if(jobError){console.error("Workcard base query failed",jobError);return jsonError("Could not load Workcard customer and job details.",500);}
 if(!baseJob)return jsonError("Workcard not found.",404);
 const [quoteResult,appointmentResult,activeAppointmentResult,entriesResult,servicesResult]=await Promise.all([
  baseJob.quote_id?db.from("quotes").select("quote_number,status,total,enquiries:enquiries!quotes_enquiry_id_fkey(id,request_number,request_type,requested_service,description,location,contact_name,email,phone,vehicle_description,vehicles:vehicles!enquiries_vehicle_id_fkey(make,model,year,registration,vin))").eq("id",baseJob.quote_id).eq("business_id",businessId).maybeSingle():Promise.resolve({data:null,error:null}),
  baseJob.appointment_id?db.from("appointments").select("id,status,starts_at,ends_at,preferred_start,preferred_end,location,customer_notes,internal_notes,vehicles:vehicles!appointments_vehicle_id_fkey(make,model,year,registration,vin)").eq("id",baseJob.appointment_id).eq("business_id",businessId).maybeSingle():Promise.resolve({data:null,error:null}),
  baseJob.quote_id?db.from("appointments").select("id,status,starts_at,ends_at,preferred_start,preferred_end,location,customer_notes,internal_notes,vehicles:vehicles!appointments_vehicle_id_fkey(make,model,year,registration,vin)").eq("quote_id",baseJob.quote_id).eq("business_id",businessId).in("status",["requested","confirmed","rescheduled"]).order("created_at",{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null,error:null}),
  db.from("job_work_entries").select("id,source_quote_item_id,entry_type,description,quantity_required,quantity_used,quantity_ordered,quantity_received,quantity_returned,part_order_status,supplier_order_reference,ordered_at,expected_at,received_at,unit_price,cost_unit_price,tax_rate,line_total,part_number,supplier_name,customer_visible,invoiceable,service_id,services:services!job_work_entries_service_id_fkey(name)").eq("business_id",businessId).eq("job_id",id).order("created_at"),
  db.from("services").select("id,name,category,price_from").eq("business_id",businessId).eq("is_active",true).order("sort_order").order("name")
 ]);
 if(quoteResult.error){console.error("Workcard quote query failed",quoteResult.error);return jsonError("Could not load the Workcard quote and enquiry details.",500);}
 if(appointmentResult.error||activeAppointmentResult.error){console.error("Workcard appointment query failed",appointmentResult.error??activeAppointmentResult.error);return jsonError("Could not load the Workcard booking and vehicle details.",500);}
 if(entriesResult.error){console.error("Workcard entries query failed",entriesResult.error);return jsonError("Could not load Workcard work entries.",500);}
 if(servicesResult.error){console.error("Workcard service presets query failed",servicesResult.error);return jsonError("Could not load Workcard service presets.",500);}
 const job={...baseJob,quotes:quoteResult.data,appointments:activeAppointmentResult.data??appointmentResult.data};
 return Response.json({job,entries:entriesResult.data??[],services:servicesResult.data??[]});
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
 const {data:deletedEntry,error}=await db.from("job_work_entries").delete().eq("id",entryId).eq("job_id",id).eq("business_id",businessId).select("id,entry_type,description").maybeSingle();
 if(error){console.error("Workcard entry delete failed",error);return jsonError("Could not delete Workcard entry.",500);}
 if(!deletedEntry)return jsonError("Workcard entry not found.",404);
 await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"workcard.entry_deleted",entity_type:"job_work_entry",entity_id:entryId,details:{job_id:id,entry_type:deletedEntry.entry_type,description:deletedEntry.description}});
 return Response.json({success:true});
}
