import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const access=await authorizePermission("invoices.manage");if(access.response)return access.response;const db=database();
 const {data:jobs,error}=await db.from("jobs").select("id,job_number,title,customer_id,quote_id,customers(full_name)").eq("business_id",access.membership!.business_id).eq("status","completed").not("quote_id","is",null).order("completed_at",{ascending:false});
 if(error)return jsonError("Could not load completed jobs.",500);const ids=(jobs??[]).map(x=>x.id);
 const {data:existing}=ids.length?await db.from("invoices").select("job_id").in("job_id",ids):{data:[]};const invoiced=new Set((existing??[]).map(x=>x.job_id));
 return Response.json({jobs:(jobs??[]).filter(x=>!invoiced.has(x.id))});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const access=await authorizePermission("invoices.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const jobId=String(body.jobId??"");const dueDate=body.dueDate?String(body.dueDate):null;const notes=String(body.notes??"").trim().slice(0,3000);
  if(!/^[0-9a-f-]{36}$/i.test(jobId))return jsonError("Select a completed job.");if(dueDate&&!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))return jsonError("Enter a valid due date.");
  const db=database();const {data:job}=await db.from("jobs").select("id,job_number,title,customer_id,user_id,quote_id,status").eq("id",jobId).eq("business_id",access.membership!.business_id).eq("status","completed").maybeSingle();if(!job||!job.quote_id)return jsonError("Only completed jobs with an approved quote can be invoiced.",409);
  const {data:quote}=await db.from("quotes").select("id,subtotal,tax_amount,total,quote_items(description,quantity,unit_price,tax_rate,line_total)").eq("id",job.quote_id).eq("business_id",access.membership!.business_id).maybeSingle();if(!quote)return jsonError("Source quote not found.",404);
  const invoiceNumber="BRV-I-"+Date.now().toString(36).toUpperCase();
  const {data:invoice,error}=await db.from("invoices").insert({business_id:access.membership!.business_id,customer_id:job.customer_id,user_id:job.user_id,job_id:job.id,quote_id:quote.id,invoice_number:invoiceNumber,status:"draft",due_date:dueDate,subtotal:quote.subtotal,tax_amount:quote.tax_amount,total:quote.total,amount_paid:0,notes:notes||("Invoice for job "+job.job_number)}).select("id,invoice_number,total").single();
  if(error||!invoice)return jsonError("Could not create invoice.",500);
  const items=(quote.quote_items??[]).map((x:any,i:number)=>({invoice_id:invoice.id,description:x.description,quantity:x.quantity,unit_price:x.unit_price,tax_rate:x.tax_rate,line_total:x.line_total,sort_order:i}));
  if(items.length){const {error:itemError}=await db.from("invoice_items").insert(items);if(itemError){await db.from("invoices").delete().eq("id",invoice.id);return jsonError("Could not copy quote items to invoice.",500);}}
  await db.from("audit_events").insert({business_id:access.membership!.business_id,actor_user_id:access.user!.id,action:"invoice.created",entity_type:"invoice",entity_id:invoice.id,details:{invoice_number:invoiceNumber,job_id:job.id,total:invoice.total}});
  return Response.json({invoice},{status:201});
 }catch{return jsonError("Could not create invoice.",500);}
}