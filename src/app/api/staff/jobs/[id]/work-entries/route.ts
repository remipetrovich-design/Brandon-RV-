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
 const {data:entries,error}=await access.db.from("job_work_entries").select("id,entry_type,description,quantity,occurred_at,customer_visible,staff_id").eq("job_id",id).eq("business_id",membership.business_id).order("occurred_at",{ascending:false});
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
  const quantity=Number(body.quantity??1);
  const customerVisible=body.customerVisible!==false;
  if(!["labour","parts","note","test"].includes(entryType)||description.length<2)return jsonError("Enter a valid work entry.");
  if(!Number.isFinite(quantity)||quantity<=0||quantity>10000)return jsonError("Enter a valid quantity.");
  const {data:entry,error}=await access.db.from("job_work_entries").insert({
   business_id:membership.business_id,job_id:id,staff_id:access.staff?.id??null,created_by:user.id,
   entry_type:entryType,description,quantity,unit_price:0,tax_rate:0,line_total:0,cost_unit_price:0,invoiceable:false,
   customer_visible:customerVisible
  }).select("id,entry_type,description,quantity,cost_unit_price,occurred_at,customer_visible").single();
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
  if(!["pending","scheduled","waiting_parts","in_progress"].includes(access.job.status))return jsonError("This Workcard is no longer open for updates.",409);
  const isInProgress=access.job.status==="in_progress";
  const body=await request.json(),entryId=String(body.entryId??"");
  if(!isInProgress&&["quantityUsed","costUnitPrice","customerVisible"].some(field=>body[field]!==undefined))return jsonError("Actual work, costs and customer-visible completion details can only be recorded after work starts.",409);
  if(!/^[0-9a-f-]{36}$/i.test(entryId))return jsonError("Select a valid prepared Workcard item.");
  const {data:current,error:currentError}=await access.db.from("job_work_entries")
   .select("id,source_quote_item_id,entry_type,quantity_required,quantity_used,quantity_ordered,quantity_received,quantity_returned,part_order_status,supplier_order_reference,ordered_at,expected_at,received_at,cost_unit_price,part_number,supplier_name,customer_visible")
   .eq("id",entryId).eq("job_id",id).eq("business_id",membership.business_id).maybeSingle();
  if(currentError||!current)return jsonError("Prepared Workcard item not found.",404);
  const quantityRequired=Number(current.quantity_required);
  const quantityUsed=body.quantityUsed===undefined?Number(current.quantity_used):Number(body.quantityUsed);
  const costUnitPrice=body.costUnitPrice===undefined?Number(current.cost_unit_price):Number(body.costUnitPrice);
  if(![quantityRequired,quantityUsed,costUnitPrice].every(Number.isFinite)||quantityRequired<0||quantityUsed<0||quantityRequired>10000||quantityUsed>10000||costUnitPrice<0||costUnitPrice>10000000)return jsonError("Enter valid actual quantities and costs.");
  if(quantityUsed>quantityRequired)return jsonError("Actual use exceeds the approved quantity. Record the additional requirement as a customer-approved variation before using it.",409);
  const patch:Record<string,unknown>={
   quantity:quantityUsed>0?quantityUsed:Math.max(quantityRequired,0.01),
   quantity_required:quantityRequired,quantity_used:quantityUsed,
   cost_unit_price:costUnitPrice,
   customer_visible:(body.customerVisible===undefined?current.customer_visible:Boolean(body.customerVisible))&&(quantityUsed>0||!["labour","parts"].includes(current.entry_type)),
  };
  if(body.partNumber!==undefined)patch.part_number=String(body.partNumber).trim().slice(0,100)||null;
  if(body.supplierName!==undefined)patch.supplier_name=String(body.supplierName).trim().slice(0,160)||null;
  if(current.entry_type==="parts"){
   const quantityOrdered=body.quantityOrdered===undefined?Number(current.quantity_ordered):Number(body.quantityOrdered);
   const quantityReceived=body.quantityReceived===undefined?Number(current.quantity_received):Number(body.quantityReceived);
   const quantityReturned=body.quantityReturned===undefined?Number(current.quantity_returned):Number(body.quantityReturned);
   const orderStatus=String(body.partOrderStatus??current.part_order_status??"not_ordered");
   const allowedStatuses=["not_ordered","ordered","part_received","received","not_required","cancelled"];
   if(!Number.isFinite(quantityOrdered)||!Number.isFinite(quantityReceived)||!Number.isFinite(quantityReturned)||quantityOrdered<0||quantityReceived<0||quantityReturned<0||quantityReceived>quantityOrdered||quantityReturned>quantityReceived||quantityOrdered>10000||!allowedStatuses.includes(orderStatus))return jsonError("Enter valid ordered and received quantities and a valid order status.");
   if(["ordered","part_received","received"].includes(orderStatus)&&quantityOrdered<=0)return jsonError("Enter the quantity ordered before changing the order status.");
   if(["part_received","received"].includes(orderStatus)&&quantityReceived<=0)return jsonError("Enter the quantity received before recording a delivery.");
   if(orderStatus==="received"&&quantityReceived<quantityOrdered)return jsonError("The order cannot be marked received until all ordered parts have arrived.");
   if(quantityOrdered>0&&quantityUsed>quantityReceived-quantityReturned)return jsonError("Actual use exceeds the received parts available. Check the delivery or record the missing stock before continuing.",409);
   patch.quantity_ordered=quantityOrdered;patch.quantity_received=quantityReceived;patch.quantity_returned=quantityReturned;patch.part_order_status=orderStatus;
   if(body.supplierOrderReference!==undefined)patch.supplier_order_reference=String(body.supplierOrderReference).trim().slice(0,120)||null;
   for(const [input,column] of [["orderedAt","ordered_at"],["expectedAt","expected_at"],["receivedAt","received_at"]] as const){
    if(body[input]!==undefined){const value=body[input]?new Date(String(body[input])):null;if(value&&!Number.isFinite(value.getTime()))return jsonError("Enter a valid parts order date.");patch[column]=value?.toISOString()??null;}
   }
   if(orderStatus==="ordered"&&!String(body.supplierName??current.supplier_name??"").trim())return jsonError("Record the supplier before marking parts as ordered.");
  }
  const {data:entry,error}=await access.db.from("job_work_entries").update(patch)
   .eq("id",entryId).eq("job_id",id).eq("business_id",membership.business_id)
   .select("id,source_quote_item_id,entry_type,description,quantity,quantity_required,quantity_used,quantity_ordered,quantity_received,quantity_returned,part_order_status,supplier_order_reference,ordered_at,expected_at,received_at,cost_unit_price,part_number,supplier_name,customer_visible,occurred_at").single();
  if(error||!entry){console.error("Worker Workcard item update failed",error);return jsonError("Could not update the prepared Workcard item.",500);}
  await access.db.from("audit_events").insert({business_id:membership.business_id,actor_user_id:user.id,action:"work_order.entry_updated",entity_type:"job_work_entry",entity_id:entry.id,details:{job_id:id,entry_type:entry.entry_type,quantity_required:quantityRequired,quantity_used:quantityUsed,quantity_ordered:entry.quantity_ordered??null,quantity_received:entry.quantity_received??null}});
  return Response.json({entry});
 }catch(error){console.error("Worker Workcard item update failed",error);return jsonError("Could not update prepared Workcard item.",500);}
}
