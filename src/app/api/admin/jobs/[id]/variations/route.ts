import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 const {id}=await params,db=database(),businessId=access.membership!.business_id;
 const {data:job,error}=await db.from("jobs").select("id,job_number,status,quote_id").eq("id",id).eq("business_id",businessId).maybeSingle();
 if(error||!job)return jsonError("Workcard not found.",404);
 const {data:quotes,error:quoteError}=await db.from("quotes").select("id,quote_number,status,total,revision_number,variation_reason,senior_approval_status,issue_date,response_at,response_note,quote_items(id,item_type,description,quantity,unit_price,tax_rate,line_total)").eq("business_id",businessId).eq("job_id",id).eq("quote_kind","variation").order("created_at",{ascending:false});
 if(quoteError)return jsonError("Could not load Workcard variations.",500);
 return Response.json({job,variations:quotes??[]});
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 try{
  const {id}=await params,body=await request.json(),reason=String(body.reason??"").trim().slice(0,2000);
  const raw=Array.isArray(body.items)?body.items:[];
  const items=raw.map((x:any)=>({item_type:String(x.itemType??"parts"),description:String(x.description??"").trim(),quantity:Number(x.quantity??1),unit_price:Number(x.unitPrice??0)}));
  const taxRate=Number(body.taxRate??0);
  if(reason.length<5)return jsonError("Explain why the additional work or price change is required.");
  if(items.length<1||items.length>30||items.some((x:any)=>!["labour","parts"].includes(x.item_type)||x.description.length<3||x.description.length>500||!Number.isFinite(x.quantity)||x.quantity<=0||x.quantity>10000||!Number.isFinite(x.unit_price)||x.unit_price<0||x.unit_price>10000000))return jsonError("Add between 1 and 30 valid labour or parts lines.");
  if(!Number.isFinite(taxRate)||taxRate<0||taxRate>100)return jsonError("Enter a valid tax rate.");
  const db=database(),businessId=access.membership!.business_id;
  const {data:job}=await db.from("jobs").select("id,business_id,user_id,customer_id,quote_id,status").eq("id",id).eq("business_id",businessId).maybeSingle();
  if(!job||!job.quote_id||!["pending","scheduled","in_progress","waiting_parts"].includes(job.status))return jsonError("This Workcard is not open for variations.",409);
  const {data:baseQuote}=await db.from("quotes").select("id,enquiry_id,status,customer_id,user_id").eq("id",job.quote_id).eq("business_id",businessId).eq("quote_kind","standard").eq("status","accepted").maybeSingle();
  if(!baseQuote||!baseQuote.enquiry_id)return jsonError("The original customer-accepted quote could not be found.",409);
  const {data:openVariation}=await db.from("quotes").select("id").eq("business_id",businessId).eq("job_id",id).eq("quote_kind","variation").in("status",["draft","sent"]).maybeSingle();
  if(openVariation)return jsonError("A variation is already awaiting senior review or customer approval. Resolve it before creating another.",409);
  const {data:settings}=await db.from("business_settings").select("settings").eq("business_id",businessId).maybeSingle();
  const cfg=settings?.settings&&typeof settings.settings==="object"?settings.settings as Record<string,any>:{};
  const pricing=cfg.pricing&&typeof cfg.pricing==="object"?cfg.pricing:{};
  const gstStatus=String(pricing.gst_status??"not_configured"),gstRate=Number(pricing.gst_rate??10);
  if(gstStatus!=="registered"&&taxRate>0)return jsonError("GST cannot be added until the business GST position is confirmed.");
  if(gstStatus==="registered"&&Math.abs(taxRate-gstRate)>0.001)return jsonError("Use the configured GST rate from Business Settings.");
  const lines=items.map((x:any,i:number)=>({...x,tax_rate:taxRate,line_total:Number((x.quantity*x.unit_price).toFixed(2)),sort_order:i}));
  const subtotal=Number(lines.reduce((s:number,x:any)=>s+x.line_total,0).toFixed(2));
  const taxAmount=Number(lines.reduce((s:number,x:any)=>s+x.line_total*x.tax_rate/100,0).toFixed(2));
  const total=Number((subtotal+taxAmount).toFixed(2));
  const quoteNumber="BRV-V-"+Date.now().toString(36).toUpperCase()+"-"+crypto.randomUUID().slice(0,4).toUpperCase();
  const {data:quote,error}=await db.from("quotes").insert({
   business_id:businessId,customer_id:baseQuote.customer_id,user_id:baseQuote.user_id,enquiry_id:baseQuote.enquiry_id,
   job_id:id,quote_kind:"variation",variation_reason:reason,quote_number:quoteNumber,revision_number:1,
   prepared_by:access.user!.id,senior_approval_status:"pending",status:"draft",subtotal,tax_amount:taxAmount,total,
   notes:String(body.notes??"").trim().slice(0,3000)||null,terms:String(body.terms??"").trim().slice(0,3000)||null
  }).select("id,quote_number,total,status,senior_approval_status,variation_reason").single();
  if(error||!quote)return jsonError("Could not create Workcard variation.",500);
  const {error:itemError}=await db.from("quote_items").insert(lines.map((x:any)=>({...x,quote_id:quote.id})));
  if(itemError){await db.from("quotes").delete().eq("id",quote.id).eq("business_id",businessId);return jsonError("Could not save variation lines. The draft was rolled back.",500);}
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"workcard.variation_created",entity_type:"quote",entity_id:quote.id,details:{job_id:id,quote_number:quoteNumber,reason,total,line_count:lines.length}});
  return Response.json({quote},{status:201});
 }catch{return jsonError("Could not create Workcard variation.",500);}
}
