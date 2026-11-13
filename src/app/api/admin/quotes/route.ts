import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const access=await authorizePermission("quotes.view");if(access.response)return access.response;
 const db=database(),businessId=access.membership!.business_id;
 const [{data:enquiries,error:enquiryError},{data:quotes,error:quoteError},{data:businessSettings}]=await Promise.all([
  db.from("enquiries").select("id,request_number,request_type,contact_name,email,requested_service,user_id,customer_id").eq("business_id",businessId).eq("request_type","quote_request").is("archived_at",null).in("status",["new","reviewing","quoted"]).order("created_at",{ascending:false}),
  db.from("quotes").select("id,quote_number,enquiry_id,revision_number,status,quote_kind,job_id,total,created_at,users(full_name),enquiries(request_number,contact_name,request_type)").eq("business_id",businessId).not("enquiry_id","is",null).order("created_at",{ascending:false}),
  db.from("business_settings").select("settings").eq("business_id",businessId).maybeSingle()
 ]);
 if(enquiryError||quoteError)return jsonError("Could not load quote records.",500);
 const settings=businessSettings?.settings&&typeof businessSettings.settings==="object"?businessSettings.settings as Record<string,any>:{};
 const pricing=settings.pricing&&typeof settings.pricing==="object"?settings.pricing:{};
 return Response.json({enquiries:enquiries??[],quotes:quotes??[],pricing:{gst_status:pricing.gst_status??"not_configured",gst_rate:Number(pricing.gst_rate??10),labour_rate:pricing.labour_rate??null,parts_markup_percent:pricing.parts_markup_percent??null}});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("quotes.manage");if(access.response)return access.response;
 try{
  const body=await request.json();
  const enquiryId=String(body.enquiryId??"");
  const rawItems=Array.isArray(body.items)?body.items:[];
  const items:{description:string;quantity:number;unitPrice:number}[]=rawItems.map((item:any)=>({description:String(item.description??"").trim(),quantity:Number(item.quantity??1),unitPrice:Number(item.unitPrice??0)}));
  const taxRate=Number(body.taxRate??0);
  const notes=String(body.notes??"").trim().slice(0,3000);
  const terms=String(body.terms??"").trim().slice(0,3000);
  const expiryDate=body.expiryDate?String(body.expiryDate):null;
  const supersedesQuoteId=body.supersedesQuoteId?String(body.supersedesQuoteId):null;
  if(!/^[0-9a-f-]{36}$/i.test(enquiryId)||items.length<1||items.length>30)return jsonError("Select a Quote Request Jobcard and add between 1 and 30 quote lines.");
  if(items.some((item:{description:string;quantity:number;unitPrice:number})=>item.description.length<3||item.description.length>500||!Number.isFinite(item.quantity)||item.quantity<=0||item.quantity>10000||!Number.isFinite(item.unitPrice)||item.unitPrice<0||item.unitPrice>10000000))return jsonError("Each quote line needs a description, a positive quantity and a valid unit price.");
  if(!Number.isFinite(taxRate)||taxRate<0||taxRate>100)return jsonError("Enter a valid tax rate.");
  if(expiryDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)||expiryDate<=new Date().toISOString().slice(0,10)))return jsonError("Quote expiry must be a valid future date.");
  const db=database(),businessId=access.membership!.business_id;
  const {data:businessSettings}=await db.from("business_settings").select("settings").eq("business_id",businessId).maybeSingle();
  const configured=businessSettings?.settings&&typeof businessSettings.settings==="object"?businessSettings.settings as Record<string,any>:{};
  const pricing=configured.pricing&&typeof configured.pricing==="object"?configured.pricing:{};
  const gstStatus=String(pricing.gst_status??"not_configured");
  const configuredGstRate=Number(pricing.gst_rate??10);
  if(gstStatus!=="registered"&&taxRate>0)return jsonError("GST cannot be added until the business GST position is confirmed and marked as registered in Business Settings.");
  if(gstStatus==="registered"&&Math.abs(taxRate-configuredGstRate)>0.001)return jsonError("Use the configured GST rate from Business Settings for this quote.");
  const {data:enquiry}=await db.from("enquiries").select("id,request_number,request_type,user_id,customer_id,contact_name,email,phone,status,stage,archived_at").eq("id",enquiryId).eq("business_id",businessId).eq("request_type","quote_request").is("archived_at",null).maybeSingle();
  if(!enquiry)return jsonError("Quote Request Jobcard not found.",404);
  if(!["new","reviewing","quoted"].includes(String(enquiry.status)))return jsonError("This Jobcard is no longer open for quoting.",409);
  // Quotes require a customer row. Public quote requests may arrive as guests
  // with no customer_id, so resolve or create the customer before inserting.
  let customerId=enquiry.customer_id??null;
  if(!customerId&&enquiry.user_id){
   const {data:linkedCustomer,error:linkedCustomerError}=await db.from("customers").select("id").eq("business_id",businessId).eq("user_id",enquiry.user_id).maybeSingle();
   if(linkedCustomerError){console.error("Quote customer lookup by user failed",linkedCustomerError);return jsonError("Could not prepare the customer record for this quote.",500);}
   customerId=linkedCustomer?.id??null;
  }
  if(!customerId&&enquiry.email){
   const {data:emailCustomer,error:emailCustomerError}=await db.from("customers").select("id").eq("business_id",businessId).ilike("email",enquiry.email).limit(1).maybeSingle();
   if(emailCustomerError){console.error("Quote customer lookup by email failed",emailCustomerError);return jsonError("Could not prepare the customer record for this quote.",500);}
   customerId=emailCustomer?.id??null;
  }
  if(!customerId){
   const fullName=String(enquiry.contact_name??"").trim();
   if(fullName.length<2)return jsonError("Add the customer's name to the Quote Request before creating a quote.",409);
   const {data:newCustomer,error:newCustomerError}=await db.from("customers").insert({
    business_id:businessId,user_id:enquiry.user_id??null,full_name:fullName,
    email:enquiry.email??null,phone:enquiry.phone??null,status:"active"
   }).select("id").single();
   if(newCustomerError||!newCustomer){
    console.error("Quote customer creation failed",newCustomerError);
    return jsonError("Could not create the customer record required for this quote.",500);
   }
   customerId=newCustomer.id;
  }
  if(!enquiry.customer_id){
   const {error:linkCustomerError}=await db.from("enquiries").update({customer_id:customerId,updated_at:new Date().toISOString()}).eq("id",enquiry.id).eq("business_id",businessId);
   if(linkCustomerError){console.error("Quote customer link failed",linkCustomerError);return jsonError("Could not link the customer record to this Quote Request.",500);}
  }
  let revisionNumber=1;
  if(supersedesQuoteId){
   const {data:prior}=await db.from("quotes").select("id,enquiry_id,revision_number,status").eq("id",supersedesQuoteId).eq("business_id",businessId).maybeSingle();
   if(!prior||prior.enquiry_id!==enquiryId)return jsonError("The quote revision must belong to the same Jobcard.",409);
   if(["accepted","converted"].includes(prior.status))return jsonError("An accepted quote cannot be revised. Use the variation approval workflow for additional work.",409);
   revisionNumber=Number(prior.revision_number??1)+1;
  }
  const lines:{description:string;quantity:number;unit_price:number;tax_rate:number;line_total:number;sort_order:number}[]=items.map((item,index:number)=>({description:item.description,quantity:item.quantity,unit_price:item.unitPrice,tax_rate:taxRate,line_total:Number((item.quantity*item.unitPrice).toFixed(2)),sort_order:index}));
  const subtotal=Number(lines.reduce((sum:number,item:{line_total:number})=>sum+item.line_total,0).toFixed(2));
  const taxAmount=Number((lines.reduce((sum:number,item:{line_total:number;tax_rate:number})=>sum+item.line_total*item.tax_rate/100,0)).toFixed(2));
  const total=Number((subtotal+taxAmount).toFixed(2));
  const quoteNumber="BRV-Q-"+Date.now().toString(36).toUpperCase()+"-"+crypto.randomUUID().slice(0,4).toUpperCase();
  const {data:quote,error}=await db.from("quotes").insert({business_id:businessId,customer_id:customerId,user_id:enquiry.user_id??null,enquiry_id:enquiry.id,quote_number:quoteNumber,revision_number:revisionNumber,supersedes_quote_id:supersedesQuoteId,prepared_by:access.user!.id,senior_approval_status:"pending",status:"draft",expiry_date:expiryDate,subtotal,tax_amount:taxAmount,total,notes:notes||null,terms:terms||null}).select("id,quote_number,total,revision_number,enquiry_id").single();
  if(error||!quote){console.error("Quote insert failed",{error,enquiryId,customerId});return jsonError("Could not create quote.",500);}
  const {error:itemError}=await db.from("quote_items").insert(lines.map((item:{description:string;quantity:number;unit_price:number;tax_rate:number;line_total:number;sort_order:number})=>({...item,quote_id:quote.id})));
  if(itemError){console.error("Quote line insert failed",itemError);await db.from("quotes").delete().eq("id",quote.id).eq("business_id",businessId);return jsonError("Could not save quote lines. The draft was rolled back.",500);}
  if(supersedesQuoteId){const {error:supersedeError}=await db.from("quotes").update({status:"superseded",updated_at:new Date().toISOString()}).eq("id",supersedesQuoteId).eq("business_id",businessId);if(supersedeError){await db.from("quotes").delete().eq("id",quote.id).eq("business_id",businessId);return jsonError("Could not supersede the previous quote revision. The new draft was rolled back.",500);}}
  const now=new Date().toISOString();
  await db.from("enquiries").update({status:"reviewing",stage:"quote_in_progress",updated_at:now}).eq("id",enquiry.id).eq("business_id",businessId);
  if(enquiry.stage!=="quote_in_progress")await db.from("enquiry_stage_history").insert({business_id:businessId,enquiry_id:enquiry.id,from_stage:enquiry.stage,to_stage:"quote_in_progress",changed_by:access.user!.id,note:"Draft quote "+quote.quote_number+" prepared for senior review."});
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:supersedesQuoteId?"quote.revised":"quote.created",entity_type:"quote",entity_id:quote.id,details:{quote_number:quoteNumber,customer_id:customerId,enquiry_id:enquiry.id,revision_number:revisionNumber,line_count:lines.length,subtotal,tax_amount:taxAmount,total}});
  return Response.json({quote},{status:201});
 }catch(error){console.error("Quote creation failed",error);return jsonError("Could not create quote.",500);}
}
