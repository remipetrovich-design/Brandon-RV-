import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const access=await authorizePermission("invoices.manage");if(access.response)return access.response;const db=database(),businessId=access.membership!.business_id;
 const {data:jobs,error}=await db.from("jobs").select("id,job_number,title,customer_id,quote_id").eq("business_id",businessId).eq("status","completed").order("completed_at",{ascending:false});
 if(error)return jsonError("Could not load completed jobs.",500);
 const ids=(jobs??[]).map(x=>x.id);
 const {data:existing,error:existingError}=ids.length?await db.from("invoices").select("job_id").eq("business_id",businessId).in("job_id",ids):{data:[],error:null};
 if(existingError)return jsonError("Could not check existing invoices.",500);
 const invoiced=new Set((existing??[]).map(x=>x.job_id));
 return Response.json({jobs:(jobs??[]).filter(x=>!invoiced.has(x.id))});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("invoices.manage");if(access.response)return access.response;
 try{
  const body=await request.json(),jobId=String(body.jobId??""),dueDate=body.dueDate?String(body.dueDate):null,notes=String(body.notes??"").trim().slice(0,3000);
  if(!/^[0-9a-f-]{36}$/i.test(jobId))return jsonError("Select a completed Workcard.");
  if(dueDate&&!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))return jsonError("Enter a valid due date.");
  const db=database(),businessId=access.membership!.business_id;
  const {data:job,error:jobError}=await db.from("jobs").select("id,job_number,title,customer_id,user_id,quote_id,status,senior_approval_status,customer_approval_status").eq("id",jobId).eq("business_id",businessId).eq("status","completed").maybeSingle();
  if(jobError||!job)return jsonError("Only a completed Workcard can be invoiced.",409);
  if(job.senior_approval_status!=="approved"&&job.senior_approval_status!=="legacy_approved")return jsonError("Senior approval is required before invoicing.",409);
  if(job.customer_approval_status!=="approved")return jsonError("Customer approval is required before invoicing.",409);
  const {data:existing,error:existingError}=await db.from("invoices").select("id").eq("business_id",businessId).eq("job_id",job.id).limit(1).maybeSingle();
  if(existingError)return jsonError("Could not check for an existing invoice.",500);
  if(existing)return jsonError("This Workcard already has an invoice. Use the existing invoice to manage its balance.",409);
  const {data:entries,error:entryError}=await db.from("job_work_entries").select("id,entry_type,description,quantity_used,unit_price,tax_rate,line_total,invoiceable").eq("business_id",businessId).eq("job_id",job.id).eq("invoiceable",true).in("entry_type",["labour","parts"]).gt("quantity_used",0).order("created_at");
  if(entryError)return jsonError("Could not load actual Workcard labour and parts.",500);
  if(!entries?.length)return jsonError("No actual labour or parts are marked ready for invoicing. Record the completed work on the Workcard first.",409);
  const {data:businessSettings}=await db.from("business_settings").select("settings").eq("business_id",businessId).maybeSingle();
  const settings=businessSettings?.settings&&typeof businessSettings.settings==="object"?businessSettings.settings as Record<string,any>:{};
  const pricing=settings.pricing&&typeof settings.pricing==="object"?settings.pricing:{};
  const gstStatus=String(pricing.gst_status??"not_configured"),gstRate=Number(pricing.gst_rate??10);
  if(gstStatus!=="registered"&&entries.some(x=>Number(x.tax_rate)>0))return jsonError("Invoice GST must be zero until the business is confirmed as GST registered.");
  if(gstStatus==="registered"&&entries.some(x=>Math.abs(Number(x.tax_rate)-gstRate)>0.001))return jsonError("Update Workcard entry tax rates to the configured GST rate before invoicing.");
  const items=entries.map((x,i)=>{const quantity=Number(x.quantity_used),unitPrice=Number(x.unit_price),taxRate=Number(x.tax_rate),lineTotal=Number((quantity*unitPrice).toFixed(2));return {description:x.description,quantity,unit_price:unitPrice,tax_rate:taxRate,line_total:lineTotal,sort_order:i};});
  const subtotal=Number(items.reduce((s,x)=>s+x.line_total,0).toFixed(2));
  const taxAmount=Number(items.reduce((s,x)=>s+x.line_total*x.tax_rate/100,0).toFixed(2));
  const total=Number((subtotal+taxAmount).toFixed(2));
  if(total<=0)return jsonError("The actual Workcard charges must be greater than zero before invoicing.",409);
  const invoiceNumber="BRV-I-"+Date.now().toString(36).toUpperCase()+"-"+crypto.randomUUID().slice(0,4).toUpperCase();
  const {data:invoice,error}=await db.from("invoices").insert({business_id:businessId,customer_id:job.customer_id,user_id:job.user_id,job_id:job.id,quote_id:job.quote_id,invoice_number:invoiceNumber,status:"draft",due_date:dueDate,subtotal,tax_amount:taxAmount,total,amount_paid:0,notes:notes||("Final invoice for Workcard "+job.job_number+" · calculated from actual completed work.")}).select("id,invoice_number,total").single();
  if(error||!invoice){console.error("Final invoice creation failed",error);return jsonError("Could not create final invoice.",500);}
  const {error:itemError}=await db.from("invoice_items").insert(items.map(x=>({...x,invoice_id:invoice.id})));
  if(itemError){console.error("Final invoice item insert failed",itemError);await db.from("invoices").delete().eq("id",invoice.id).eq("business_id",businessId);return jsonError("Could not save actual Workcard charges to the invoice. The draft was rolled back.",500);}
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"invoice.created_from_actual_work",entity_type:"invoice",entity_id:invoice.id,details:{invoice_number:invoiceNumber,job_id:job.id,source_entry_ids:entries.map(x=>x.id),subtotal,tax_amount:taxAmount,total,estimate_quote_id:job.quote_id}});
  return Response.json({invoice},{status:201});
 }catch(error){console.error("Final invoice creation failed",error);return jsonError("Could not create final invoice.",500);}
}
