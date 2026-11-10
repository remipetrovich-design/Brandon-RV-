import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const access=await authorizePermission("quotes.manage");if(access.response)return access.response;
 const db=database(),businessId=access.membership!.business_id;
 const [{data:enquiries,error:enquiryError},{data:quotes,error:quoteError},{data:businessSettings}]=await Promise.all([
  db.from("enquiries").select("id,request_number,request_type,contact_name,email,requested_service,user_id,customer_id").eq("business_id",businessId).eq("request_type","quote_request").is("archived_at",null).in("status",["new","reviewing","quoted"]).order("created_at",{ascending:false}),
  db.from("quotes").select("id,quote_number,enquiry_id,revision_number").eq("business_id",businessId).not("enquiry_id","is",null).order("created_at",{ascending:false}),
  db.from("business_settings").select("settings").eq("business_id",businessId).maybeSingle()
 ]);
 if(enquiryError||quoteError)return jsonError("Could not load quote records.",500);
 const settings=businessSettings?.settings&&typeof businessSettings.settings==="object"?businessSettings.settings as Record<string,any>:{};
 const pricing=settings.pricing&&typeof settings.pricing==="object"?settings.pricing:{};
 return Response.json({enquiries:enquiries??[],quotes:quotes??[],pricing:{gst_status:pricing.gst_status??"not_configured",gst_rate:Number(pricing.gst_rate??10),labour_rate:pricing.labour_rate??null,parts_markup_percent:pricing.parts_markup_percent??null}});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const access=await authorizePermission("quotes.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const enquiryId=body.enquiryId?String(body.enquiryId):null;const description=String(body.description??"").trim();const quantity=Number(body.quantity??1);const unitPrice=Number(body.unitPrice??0);const taxRate=Number(body.taxRate??0);const notes=String(body.notes??"").trim().slice(0,3000);const terms=String(body.terms??"").trim().slice(0,3000);const expiryDate=body.expiryDate?String(body.expiryDate):null;const supersedesQuoteId=body.supersedesQuoteId?String(body.supersedesQuoteId):null;
  if(!/^[0-9a-f-]{36}$/i.test(String(enquiryId??""))||description.length<3||description.length>500)return jsonError("Select a Quote Request Jobcard and enter the quoted work.");
  if(!Number.isFinite(quantity)||quantity<=0||quantity>10000||!Number.isFinite(unitPrice)||unitPrice<0||unitPrice>10000000||!Number.isFinite(taxRate)||taxRate<0||taxRate>100)return jsonError("Enter valid quantity, pricing and tax values.");
  if(expiryDate&&!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate))return jsonError("Enter a valid quote expiry date.");
  const db=database();
  const {data:businessSettings}=await db.from("business_settings").select("settings").eq("business_id",access.membership!.business_id).maybeSingle();
  const configured=businessSettings?.settings&&typeof businessSettings.settings==="object"?businessSettings.settings as Record<string,any>:{};
  const pricing=configured.pricing&&typeof configured.pricing==="object"?configured.pricing:{};
  const gstStatus=String(pricing.gst_status??"not_configured");
  const configuredGstRate=Number(pricing.gst_rate??10);
  if(gstStatus!=="registered"&&taxRate>0)return jsonError("GST cannot be added until the business GST position is confirmed and marked as registered in Business Settings.");
  if(gstStatus==="registered"&&Math.abs(taxRate-configuredGstRate)>0.001)return jsonError("Use the configured GST rate from Business Settings for this quote.");
  const {data:enquiry}=await db.from("enquiries").select("id,request_number,request_type,user_id,customer_id,email,status,stage,archived_at").eq("id",enquiryId).eq("business_id",access.membership!.business_id).eq("request_type","quote_request").is("archived_at",null).maybeSingle();
  if(!enquiry)return jsonError("Quote Request Jobcard not found.",404);
  if(!["new","reviewing","quoted"].includes(String(enquiry.status)))return jsonError("This Jobcard is no longer open for quoting.",409);
  const customer={id:enquiry.customer_id??null,user_id:enquiry.user_id??null};
  let revisionNumber=1;
  if(supersedesQuoteId){const {data:prior}=await db.from("quotes").select("id,enquiry_id,revision_number,status").eq("id",supersedesQuoteId).eq("business_id",access.membership!.business_id).maybeSingle();if(!prior||!enquiryId||prior.enquiry_id!==enquiryId)return jsonError("The quote revision must belong to the same ticket.",409);if(["accepted","converted"].includes(prior.status))return jsonError("An accepted or converted quote cannot be revised. Create a separately approved variation.",409);revisionNumber=Number(prior.revision_number??1)+1;}
  const subtotal=Number((quantity*unitPrice).toFixed(2));const taxAmount=Number((subtotal*taxRate/100).toFixed(2));const total=Number((subtotal+taxAmount).toFixed(2));const quoteNumber="BRV-Q-"+Date.now().toString(36).toUpperCase();
  const {data:quote,error}=await db.from("quotes").insert({business_id:access.membership!.business_id,customer_id:customer.id,user_id:customer.user_id,enquiry_id:enquiry?.id??null,quote_number:quoteNumber,revision_number:revisionNumber,supersedes_quote_id:supersedesQuoteId,status:"draft",expiry_date:expiryDate,subtotal,tax_amount:taxAmount,total,notes:notes||null,terms:terms||null}).select("id,quote_number,total,revision_number,enquiry_id").single();
  if(error||!quote)return jsonError("Could not create quote.",500);
  const {error:itemError}=await db.from("quote_items").insert({quote_id:quote.id,description,quantity,unit_price:unitPrice,tax_rate:taxRate,line_total:subtotal,sort_order:0});
  if(itemError){await db.from("quotes").delete().eq("id",quote.id);return jsonError("Could not save quote items.",500);}
  if(supersedesQuoteId)await db.from("quotes").update({status:"superseded",updated_at:new Date().toISOString()}).eq("id",supersedesQuoteId);
  const now=new Date().toISOString();
  await db.from("enquiries").update({status:"reviewing",stage:"quote_in_progress",updated_at:now}).eq("id",enquiry.id);
  if(enquiry.stage!=="quote_in_progress")await db.from("enquiry_stage_history").insert({business_id:access.membership!.business_id,enquiry_id:enquiry.id,from_stage:enquiry.stage,to_stage:"quote_in_progress",changed_by:access.user!.id,note:"Draft quote "+quote.quote_number+" prepared for senior review."});
  await db.from("audit_events").insert({business_id:access.membership!.business_id,actor_user_id:access.user!.id,action:supersedesQuoteId?"quote.revised":"quote.created",entity_type:"quote",entity_id:quote.id,details:{quote_number:quoteNumber,customer_id:customer.id,enquiry_id:enquiry?.id??null,revision_number:revisionNumber,total}});
  return Response.json({quote},{status:201});
 }catch{return jsonError("Could not create quote.",500);}
}