import {currentUser,currentMembership,database,userHasPermission,jsonError,sameOrigin} from "@/lib/auth";
import {canStartWorkOrder,canFinishWorkOrder,calculateWorkOrderTotals} from "@/lib/work-order-lifecycle.mjs";
export const runtime="nodejs";

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 const membership=await currentMembership(user.id);if(!membership)return jsonError("Staff access required.",403);
 const {id}=await params;
 try{
  const body=await request.json();const action=String(body.action??"");
  if(!["start","finish"].includes(action))return jsonError("Choose start or finish.");
  const db=database();const {data:staff}=await db.from("staff").select("id").eq("user_id",user.id).eq("business_id",membership.business_id).maybeSingle();
  if(!staff)return jsonError("Employee profile not found.",404);
  const canManage=await userHasPermission(user.id,"jobs.manage");
  const {data:job}=await db.from("jobs").select("id,status,customer_id,user_id,quote_id,job_number,title,customer_approval_status").eq("id",id).eq("business_id",membership.business_id).maybeSingle();
  if(!job)return jsonError("Work Order not found.",404);
  const {data:assignment}=await db.from("job_assignments").select("id,status").eq("job_id",id).eq("staff_id",staff.id).maybeSingle();
  if(!canManage&&assignment?.status!=="accepted")return jsonError("Accept this Work Order assignment before starting or finishing it.",403);
  const now=new Date().toISOString();
  if(action==="start"){
   if(job.status==="in_progress")return Response.json({success:true,status:"in_progress",alreadyStarted:true});
   if(!canStartWorkOrder(job.status,assignment?.status,canManage))return jsonError("This Work Order cannot be started from its current status or assignment.",409);
   const {error}=await db.from("jobs").update({status:"in_progress",actual_start:now,updated_at:now}).eq("id",id).eq("business_id",membership.business_id);
   if(error)return jsonError("Could not start Work Order.",500);
   await db.from("audit_events").insert({business_id:membership.business_id,actor_user_id:user.id,action:"work_order.started",entity_type:"job",entity_id:id,details:{staff_id:staff.id}});
   return Response.json({success:true,status:"in_progress"});
  }
  if(job.status==="completed"&&job.customer_approval_status==="pending"){
   const {data:existingInvoice}=await db.from("invoices").select("id,invoice_number,total,status").eq("job_id",id).maybeSingle();
   return Response.json({success:true,status:"completed",invoice:existingInvoice,alreadyFinished:true});
  }
  if(!canFinishWorkOrder(job.status,assignment?.status,canManage))return jsonError("Only an in-progress Work Order with an accepted assignment can be finished.",409);
  const summary=String(body.workSummary??"").trim().slice(0,8000);
  if(summary.length<10)return jsonError("Add a useful summary of the work completed before finishing the Work Order.");
  const {data:entries,error:entryError}=await db.from("job_work_entries").select("id,entry_type,description,quantity,unit_price,tax_rate,line_total").eq("job_id",id).eq("business_id",membership.business_id).order("occurred_at");
  if(entryError)return jsonError("Could not load Work Order entries.",500);
  const billable=(entries??[]).filter(x=>x.entry_type!=="note");
  let items=billable.map((x:any,i:number)=>({description:x.description,quantity:Number(x.quantity),unit_price:Number(x.unit_price),tax_rate:Number(x.tax_rate),line_total:Number(x.line_total),sort_order:i}));
  if(!items.length&&job.quote_id){
   const {data:quoteItems}=await db.from("quote_items").select("description,quantity,unit_price,tax_rate,line_total").eq("quote_id",job.quote_id).order("sort_order");
   items=(quoteItems??[]).map((x:any,i:number)=>({...x,sort_order:i}));
  }
  const totals=calculateWorkOrderTotals(billable.length?(entries??[]):items);
  const {subtotal,taxAmount,total}=totals;
  if(!items.length)return jsonError("Add at least one billable work item or link an approved quote before finishing this Work Order.",409);
  const {data:invoice,error:invoiceError}=await db.from("invoices").insert({
   business_id:membership.business_id,customer_id:job.customer_id,user_id:job.user_id,job_id:id,quote_id:job.quote_id,
   invoice_number:"BRV-I-"+Date.now().toString(36).toUpperCase(),status:"draft",subtotal,tax_amount:taxAmount,total,amount_paid:0,
   notes:"Final invoice for Work Order "+job.job_number
  }).select("id,invoice_number,total,status").single();
  if(invoiceError||!invoice)return jsonError("Work Order could not be finished because the draft invoice could not be generated.",500);
  const invoiceItems=items.map((x:any)=>({...x,invoice_id:invoice.id}));
  const {error:itemError}=await db.from("invoice_items").insert(invoiceItems);
  if(itemError){await db.from("invoices").delete().eq("id",invoice.id);return jsonError("Could not create invoice items. Work Order remains in progress.",500);}
  const {error:updateError}=await db.from("jobs").update({status:"completed",completed_at:now,actual_end:now,work_summary:summary,customer_approval_status:"pending",final_report_created_at:now,updated_at:now}).eq("id",id).eq("business_id",membership.business_id);
  if(updateError){await db.from("invoices").delete().eq("id",invoice.id);return jsonError("Invoice was rolled back because the Work Order could not be completed.",500);}
  await db.from("job_assignments").update({status:"completed"}).eq("job_id",id).eq("status","accepted");
  await db.from("audit_events").insert({business_id:membership.business_id,actor_user_id:user.id,action:"work_order.finished_report_created",entity_type:"job",entity_id:id,details:{invoice_id:invoice.id,invoice_number:invoice.invoice_number,total,entry_count:entries?.length??0}});
  return Response.json({success:true,status:"completed",invoice});
 }catch{return jsonError("Could not update Work Order.",500);}
}
