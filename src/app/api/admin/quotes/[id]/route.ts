import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
import {sendEmail} from "@/lib/email";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const access=await authorizePermission("quotes.manage");if(access.response)return access.response;
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return jsonError("Invalid quote ID.");
 const db=database(),businessId=access.membership!.business_id;
 const {data:quote,error}=await db.from("quotes").select("id,quote_number,revision_number,status,expiry_date,notes,terms,enquiry_id,customer_id,subtotal,tax_amount,total,quote_items(description,quantity,unit_price,tax_rate,line_total,sort_order,item_type,service_id)").eq("id",id).eq("business_id",businessId).maybeSingle();
 if(error||!quote)return jsonError("Quote not found.",404);
 const items=(quote.quote_items??[]) as any[];
 const taxRate=items.length?Number(items[0].tax_rate??0):0;
 return Response.json({quote:{...quote,tax_rate:taxRate,quote_items:items}});
}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("quotes.manage");if(access.response)return access.response;
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return jsonError("Invalid quote ID.");
 try{
  const body=await request.json(),db=database(),businessId=access.membership!.business_id;
  const {data:quote,error:loadError}=await db.from("quotes").select("id,status,quote_kind,subtotal,tax_amount,total,quote_items(description,quantity,unit_price,tax_rate,line_total,sort_order)").eq("id",id).eq("business_id",businessId).maybeSingle();
  if(loadError||!quote)return jsonError("Quote not found.",404);
  if(body.status==="sent"){
   const {data:issued,error:issueError}=await db.rpc("issue_quote_for_jobcard",{p_quote_id:id,p_business_id:businessId,p_actor_user_id:access.user!.id});
   if(issueError){if(issueError.code==="P0001")return jsonError("This quote or Jobcard is no longer available for issue.",409);return jsonError("Could not issue quote. No changes were made.",500);}
   if(!issued?.success)return jsonError("Could not confirm quote issue. No changes were made.",500);
   const {data:quoteRecord}=await db.from("quotes").select("quote_number,total,customer_id,user_id,enquiry_id").eq("id",id).eq("business_id",businessId).maybeSingle();
   let customer:any=null;
   if(quoteRecord?.user_id){const result=await db.from("users").select("full_name,email").eq("id",quoteRecord.user_id).maybeSingle();customer=result.data;}
   else if(quoteRecord?.customer_id){const result=await db.from("customers").select("full_name,email").eq("id",quoteRecord.customer_id).eq("business_id",businessId).maybeSingle();customer=result.data;}
   else if(quoteRecord?.enquiry_id){const result=await db.from("enquiries").select("contact_name,email").eq("id",quoteRecord.enquiry_id).eq("business_id",businessId).maybeSingle();customer=result.data;}
   let emailSent=false;
   if(quoteRecord&&customer?.email){
    const safeName=String(customer.full_name??customer.contact_name??"Customer").replace(/[&<>"]/g,"");
    const base=process.env.NEXT_PUBLIC_APP_URL??new URL(request.url).origin;
    const quoteUrl=quoteRecord.enquiry_id&&!quoteRecord.customer_id?base+"/request-status":base+"/portal/quotes";
    const guestNote=quoteRecord.enquiry_id&&!quoteRecord.customer_id?"Use the secure Request Quote link and access code from your original confirmation email. ":"";
    emailSent=await sendEmail({sender:"brandonrv",to:customer.email,subject:"Your Brandon RV quote "+quoteRecord.quote_number,html:`<p>Hi ${safeName},</p><p>Your Brandon RV quote ${quoteRecord.quote_number} is ready for review.</p><p>Quote total: <strong>${Number(quoteRecord.total).toFixed(2)} AUD</strong></p><p>${guestNote}<a href="${quoteUrl}">View your quote</a></p><p>Work is not booked until Brandon RV confirms scheduling.</p>`});
   }
   return Response.json({success:true,emailSent});
  }
  if(quote.status!=="draft")return jsonError("Only draft quotes can be edited. Create a revision to change an issued or accepted quote.",409);
  const oldItems=(quote.quote_items??[]) as any[];
  const raw=Array.isArray(body.items)?body.items:oldItems;
  if(raw.length<1||raw.length>30)return jsonError("A quote must contain between 1 and 30 lines.");
  const items:{description:string;quantity:number;unit_price:number;tax_rate:number;sort_order:number;item_type:string;service_id:string|null}[]=raw.map((x:any,i:number)=>({description:String(x.description??"").trim(),quantity:Number(x.quantity),unit_price:Number(x.unit_price??x.unitPrice),tax_rate:Number(x.tax_rate??oldItems[i]?.tax_rate??oldItems[0]?.tax_rate??0),sort_order:i,item_type:String(x.item_type??oldItems[i]?.item_type??"labour"),service_id:x.service_id??oldItems[i]?.service_id??null}));
  if(items.some(x=>x.description.length<3||x.description.length>500||!Number.isFinite(x.quantity)||x.quantity<=0||x.quantity>10000||!Number.isFinite(x.unit_price)||x.unit_price<0||x.unit_price>10000000||!Number.isFinite(x.tax_rate)||x.tax_rate<0||x.tax_rate>100||!["labour","parts"].includes(x.item_type)))return jsonError("Check each quote line's description, quantity, unit price and tax rate.");
  const serviceIds=items.map(x=>x.service_id).filter(Boolean) as string[];
  if(serviceIds.length){const {data:linkedServices,error:serviceError}=await db.from("services").select("id").eq("business_id",businessId).eq("is_active",true).in("id",serviceIds);if(serviceError||new Set((linkedServices??[]).map(x=>x.id)).size!==new Set(serviceIds).size)return jsonError("One or more selected service presets are unavailable for this business.");}
  if(items.some(x=>x.service_id&&x.item_type!=="labour"))return jsonError("A service preset must be quoted as labour/service, not as a parts line.");
  const {data:settings}=await db.from("business_settings").select("settings").eq("business_id",businessId).maybeSingle();
  const pricing=(settings?.settings as any)?.pricing??{},gstStatus=String(pricing.gst_status??"not_configured"),configuredRate=Number(pricing.gst_rate??10);
  if(items.some(x=>x.tax_rate>0)&&gstStatus!=="registered")return jsonError("GST cannot be added until the business is confirmed as GST registered.");
  if(gstStatus==="registered"&&items.some(x=>Math.abs(x.tax_rate-configuredRate)>0.001))return jsonError("Use the configured GST rate from Business Settings.");
  const subtotal=Number(items.reduce((s,x)=>s+x.quantity*x.unit_price,0).toFixed(2));
  const taxAmount=Number(items.reduce((s,x)=>s+x.quantity*x.unit_price*x.tax_rate/100,0).toFixed(2));
  const total=Number((subtotal+taxAmount).toFixed(2));
  const expiry=body.expiryDate===undefined?undefined:(body.expiryDate?String(body.expiryDate):null);
  if(expiry&&(!/^\d{4}-\d{2}-\d{2}$/.test(expiry)||expiry<=new Date().toISOString().slice(0,10)))return jsonError("Quote expiry must be a future date.");
  const patch:any={subtotal,tax_amount:taxAmount,total,notes:String(body.notes??"").trim().slice(0,3000)||null,terms:String(body.terms??"").trim().slice(0,3000)||null,updated_at:new Date().toISOString()};
  if(expiry!==undefined)patch.expiry_date=expiry;
  const {error:updateError}=await db.from("quotes").update(patch).eq("id",id).eq("business_id",businessId);
  if(updateError)return jsonError("Could not update quote.",500);
  const {error:deleteError}=await db.from("quote_items").delete().eq("quote_id",id);
  if(deleteError){await db.from("quotes").update({subtotal:quote.subtotal,tax_amount:quote.tax_amount,total:quote.total}).eq("id",id).eq("business_id",businessId);return jsonError("Could not replace quote lines. Previous totals were restored.",500);}
  const rows=items.map(x=>({...x,line_total:Number((x.quantity*x.unit_price).toFixed(2)),quote_id:id}));
  const {error:insertError}=await db.from("quote_items").insert(rows);
  if(insertError){
   await db.from("quote_items").insert(oldItems.map((x:any)=>({description:x.description,quantity:x.quantity,unit_price:x.unit_price,tax_rate:x.tax_rate,line_total:x.line_total,sort_order:x.sort_order,item_type:x.item_type??"parts",service_id:x.service_id??null,quote_id:id})));
   await db.from("quotes").update({subtotal:quote.subtotal,tax_amount:quote.tax_amount,total:quote.total}).eq("id",id).eq("business_id",businessId);
   return jsonError("Could not save quote lines. Previous lines and totals were restored.",500);
  }
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"quote.updated",entity_type:"quote",entity_id:id,details:{line_count:items.length,subtotal,tax_amount:taxAmount,total}});
  return Response.json({success:true,quote:{id,total,subtotal,tax_amount:taxAmount}});
 }catch{return jsonError("Could not update quote.",500);}
}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("quotes.manage");if(access.response)return access.response;
 const {id}=await params,db=database(),businessId=access.membership!.business_id;
 const {data:quote}=await db.from("quotes").select("id,status,quote_number").eq("id",id).eq("business_id",businessId).maybeSingle();
 if(!quote)return jsonError("Quote not found.",404);
 if(quote.status!=="draft")return jsonError("Only draft quotes can be deleted. Issued and accepted quote history is retained.",409);
 const {count,error:jobError}=await db.from("jobs").select("id",{count:"exact",head:true}).eq("business_id",businessId).eq("quote_id",id);
 if(jobError)return jsonError("Could not verify linked Workcards.",500);
 if((count??0)>0)return jsonError("This quote is linked to a Workcard and cannot be deleted.",409);
 const {error:itemError}=await db.from("quote_items").delete().eq("quote_id",id);if(itemError)return jsonError("Could not delete quote lines.",500);
 const {error}=await db.from("quotes").delete().eq("id",id).eq("business_id",businessId);
 if(error)return jsonError("Could not delete draft quote.",500);
 await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"quote.deleted",entity_type:"quote",entity_id:id,details:{quote_number:quote.quote_number}});
 return Response.json({success:true});
}
