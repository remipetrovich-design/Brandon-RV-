import {currentUser,currentMembership,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";

async function accessJob(jobId:string,userId:string,businessId:string){
 const db=database();
 const {data:staff}=await db.from("staff").select("id").eq("user_id",userId).eq("business_id",businessId).maybeSingle();
 if(!staff)return {db,staff:null,job:null,allowed:false};
 const [{data:job},{data:assignment}]=await Promise.all([
  db.from("jobs").select("id,status,customer_approval_status").eq("id",jobId).eq("business_id",businessId).maybeSingle(),
  db.from("job_assignments").select("id,status").eq("job_id",jobId).eq("staff_id",staff.id).maybeSingle()
 ]);
 return {db,staff,job,allowed:assignment?.status==="accepted",assignment};
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
  if(!["labour","parts","note","test"].includes(entryType)||description.length<2)return jsonError("Enter a valid work entry.");
  if(!Number.isFinite(quantity)||quantity<=0||quantity>10000||!Number.isFinite(unitPrice)||unitPrice<0||unitPrice>10000000)return jsonError("Enter valid quantity and price values.");
  const {data:businessSettings}=await access.db.from("business_settings").select("settings").eq("business_id",membership.business_id).maybeSingle();
  const configured=businessSettings?.settings&&typeof businessSettings.settings==="object"?businessSettings.settings as Record<string,any>:{};
  const pricing=configured.pricing&&typeof configured.pricing==="object"?configured.pricing:{};
  const gstStatus=String(pricing.gst_status??"not_configured"),configuredGstRate=Number(pricing.gst_rate??10);
  const nonBillable=["note","test"].includes(entryType);
  const taxRate=nonBillable?0:gstStatus==="registered"?configuredGstRate:0;
  const lineTotal=nonBillable?0:Number((quantity*unitPrice).toFixed(2));
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

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 const membership=await currentMembership(user.id);if(!membership)return jsonError("Staff access required.",403);
 const {id}=await params;
 try{
  const access=await accessJob(id,user.id,membership.business_id);
  if(!access.job||!access.allowed)return jsonError("Work Order not found or not assigned to you.",404);
  if(access.job.status!=="in_progress")return jsonError("Workcard details can only be updated while the Workcard is in progress.",409);
  const body=await request.json(),entryId=String(body.entryId??"");
  if(!/^[0-9a-f-]{36}$/i.test(entryId))return jsonError("Select a valid prepared Workcard item.");
  const {data:current,error:currentError}=await access.db.from("job_work_entries")
   .select("id,entry_type,quantity_required,quantity_used,unit_price,cost_unit_price,part_number,supplier_name,invoiceable,customer_visible")
   .eq("id",entryId).eq("job_id",id).eq("business_id",membership.business_id).maybeSingle();
  if(currentError||!current)return jsonError("Prepared Workcard item not found.",404);
  const quantityRequired=body.quantityRequired===undefined?Number(current.quantity_required):Number(body.quantityRequired);
  const quantityUsed=body.quantityUsed===undefined?Number(current.quantity_used):Number(body.quantityUsed);
  const unitPrice=body.unitPrice===undefined?Number(current.unit_price):Number(body.unitPrice);
  const costUnitPrice=body.costUnitPrice===undefined?Number(current.cost_unit_price):Number(body.costUnitPrice);
  if(![quantityRequired,quantityUsed,unitPrice,costUnitPrice].every(Number.isFinite)||quantityRequired<0||quantityUsed<0||quantityRequired>10000||quantityUsed>10000||unitPrice<0||costUnitPrice<0||unitPrice>10000000||costUnitPrice>10000000)return jsonError("Enter valid required and actual quantities, costs and customer charges.");
  const patch:Record<string,unknown>={
   quantity:quantityUsed>0?quantityUsed:Math.max(quantityRequired,0.01),
   quantity_required:quantityRequired,quantity_used:quantityUsed,
   unit_price:unitPrice,cost_unit_price:costUnitPrice,
   line_total:Number((quantityUsed*unitPrice).toFixed(2)),
   invoiceable:body.invoiceable===undefined?current.invoiceable:Boolean(body.invoiceable)&&quantityUsed>0&&["labour","parts"].includes(current.entry_type),
   customer_visible:body.customerVisible===undefined?current.customer_visible:Boolean(body.customerVisible),
   updated_at:new Date().toISOString()
  };
  if(body.partNumber!==undefined)patch.part_number=String(body.partNumber).trim().slice(0,100)||null;
  if(body.supplierName!==undefined)patch.supplier_name=String(body.supplierName).trim().slice(0,160)||null;
  if(current.entry_type==="parts"){
   const quantityOrdered=body.quantityOrdered===undefined?0:Number(body.quantityOrdered);
   const quantityReceived=body.quantityReceived===undefined?0:Number(body.quantityReceived);
   const orderStatus=String(body.partOrderStatus??"not_ordered");
   const allowedStatuses=["not_ordered","ordered","part_received","received","not_required","cancelled"];
   if(!Number.isFinite(quantityOrdered)||!Number.isFinite(quantityReceived)||quantityOrdered<0||quantityReceived<0||quantityReceived>quantityOrdered||quantityOrdered>10000||!allowedStatuses.includes(orderStatus))return jsonError("Enter valid ordered and received quantities and a valid order status.");
   if(["ordered","part_received","received"].includes(orderStatus)&&quantityOrdered<=0)return jsonError("Enter the quantity ordered before changing the order status.");
   if(["part_received","received"].includes(orderStatus)&&quantityReceived<=0)return jsonError("Enter the quantity received before recording a delivery.");
   if(orderStatus==="received"&&quantityReceived<quantityOrdered)return jsonError("The order cannot be marked received until all ordered parts have arrived.");
   patch.quantity_ordered=quantityOrdered;patch.quantity_received=quantityReceived;patch.part_order_status=orderStatus;
   if(body.supplierOrderReference!==undefined)patch.supplier_order_reference=String(body.supplierOrderReference).trim().slice(0,120)||null;
   for(const [input,column] of [["orderedAt","ordered_at"],["expectedAt","expected_at"],["receivedAt","received_at"]] as const){
    if(body[input]!==undefined){const value=body[input]?new Date(String(body[input])):null;if(value&&!Number.isFinite(value.getTime()))return jsonError("Enter a valid parts order date.");patch[column]=value?.toISOString()??null;}
   }
   if(orderStatus==="ordered"&&!String(body.supplierName??current.supplier_name??"").trim())return jsonError("Record the supplier before marking parts as ordered.");
  }
  const {data:entry,error}=await access.db.from("job_work_entries").update(patch)
   .eq("id",entryId).eq("job_id",id).eq("business_id",membership.business_id)
   .select("id,source_quote_item_id,entry_type,description,quantity,quantity_required,quantity_used,quantity_ordered,quantity_received,part_order_status,supplier_order_reference,ordered_at,expected_at,received_at,unit_price,cost_unit_price,tax_rate,line_total,part_number,supplier_name,invoiceable,customer_visible,occurred_at").single();
  if(error||!entry){console.error("Worker Workcard item update failed",error);return jsonError("Could not update the prepared Workcard item.",500);}
  await access.db.from("audit_events").insert({business_id:membership.business_id,actor_user_id:user.id,action:"work_order.entry_updated",entity_type:"job_work_entry",entity_id:entry.id,details:{job_id:id,entry_type:entry.entry_type,quantity_required:quantityRequired,quantity_used:quantityUsed,quantity_ordered:patch.quantity_ordered??null,quantity_received:patch.quantity_received??null,invoiceable:entry.invoiceable}});
  return Response.json({entry});
 }catch(error){console.error("Worker Workcard item update failed",error);return jsonError("Could not update prepared Workcard item.",500);}
}
