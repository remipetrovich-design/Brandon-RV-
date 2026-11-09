import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const access=await authorizePermission("quotes.manage");if(access.response)return access.response;const db=database();const businessId=access.membership!.business_id;
 const [{data:customers,error:customerError},{data:enquiries,error:enquiryError},{data:quotes,error:quoteError},{data:businessSettings}]=await Promise.all([
  db.from("customers").select("id,full_name,email").eq("business_id",businessId).eq("status","active").order("full_name"),
  db.from("enquiries").select("id,request_number,request_type,contact_name,email,requested_service,user_id").eq("business_id",businessId).in("request_type",["public_enquiry","general_enquiry","customer_enquiry","quote_request"]).in("status",["new","reviewing","quoted"]).order("created_at",{ascending:false}),
  db.from("quotes").select("id,quote_number,enquiry_id,revision_number").eq("business_id",businessId).not("enquiry_id","is",null).order("created_at",{ascending:false}),
  db.from("business_settings").select("settings").eq("business_id",businessId).maybeSingle()
 ]);
 if(customerError||enquiryError||quoteError)return jsonError("Could not load quote records.",500);const settings=businessSettings?.settings&&typeof businessSettings.settings==="object"?businessSettings.settings as Record<string,any>:{};const pricing=settings.pricing&&typeof settings.pricing==="object"?settings.pricing:{};return Response.json({customers:customers??[],enquiries:enquiries??[],quotes:quotes??[],pricing:{gst_status:pricing.gst_status??"not_configured",gst_rate:Number(pricing.gst_rate??10),labour_rate:pricing.labour_rate??null,parts_markup_percent:pricing.parts_markup_percent??null}});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const access=await authorizePermission("quotes.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const enquiryId=body.enquiryId?String(body.enquiryId):null;const customerId=body.customerId?String(body.customerId):"";const description=String(body.description??"").trim();const quantity=Number(body.quantity??1);const unitPrice=Number(body.unitPrice??0);const taxRate=Number(body.taxRate??0);const notes=String(body.notes??"").trim().slice(0,3000);const terms=String(body.terms??"").trim().slice(0,3000);const expiryDate=body.expiryDate?String(body.expiryDate):null;const supersedesQuoteId=body.supersedesQuoteId?String(body.supersedesQuoteId):null;
  if((!enquiryId&&!/^[0-9a-f-]{36}$/i.test(customerId))||description.length<3||description.length>500)return jsonError("Select a customer or ticket and enter the quoted work.");
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
  let customer:any=null;let enquiry:any=null;
  if(enquiryId){const result=await db.from("enquiries").select("id,request_number,request_type,user_id,customer_id,email,status").eq("id",enquiryId).eq("business_id",access.membership!.business_id).in("request_type",["public_enquiry","general_enquiry","customer_enquiry","quote_request"]).maybeSingle();enquiry=result.data;if(!enquiry)return jsonError("Ticket not found.",404);if(!["new","reviewing","quoted"].includes(String(enquiry.status)))return jsonError("This request is no longer open for quoting. Reopen it through the ticket workflow before creating another quote.",409);customer={id:enquiry.user_id??null,user_id:enquiry.user_id??null};}
  else{const result=await db.from("customers").select("id,user_id").eq("id",customerId).eq("business_id",access.membership!.business_id).eq("status","active").maybeSingle();customer=result.data;if(!customer)return jsonError("Customer not found.",404);}
  let revisionNumber=1;
  if(supersedesQuoteId){const {data:prior}=await db.from("quotes").select("id,enquiry_id,revision_number,status").eq("id",supersedesQuoteId).eq("business_id",access.membership!.business_id).maybeSingle();if(!prior||!enquiryId||prior.enquiry_id!==enquiryId)return jsonError("The quote revision must belong to the same ticket.",409);if(["accepted","converted"].includes(prior.status))return jsonError("An accepted or converted quote cannot be revised. Create a separately approved variation.",409);revisionNumber=Number(prior.revision_number??1)+1;}
  const subtotal=Number((quantity*unitPrice).toFixed(2));const taxAmount=Number((subtotal*taxRate/100).toFixed(2));const total=Number((subtotal+taxAmount).toFixed(2));const quoteNumber="BRV-Q-"+Date.now().toString(36).toUpperCase();
  const {data:quote,error}=await db.from("quotes").insert({business_id:access.membership!.business_id,customer_id:customer.id,user_id:customer.user_id,enquiry_id:enquiry?.id??null,quote_number:quoteNumber,revision_number:revisionNumber,supersedes_quote_id:supersedesQuoteId,status:"draft",expiry_date:expiryDate,subtotal,tax_amount:taxAmount,total,notes:notes||null,terms:terms||null}).select("id,quote_number,total,revision_number,enquiry_id").single();
  if(error||!quote)return jsonError("Could not create quote.",500);
  const {error:itemError}=await db.from("quote_items").insert({quote_id:quote.id,description,quantity,unit_price:unitPrice,tax_rate:taxRate,line_total:subtotal,sort_order:0});
  if(itemError){await db.from("quotes").delete().eq("id",quote.id);return jsonError("Could not save quote items.",500);}
  if(supersedesQuoteId)await db.from("quotes").update({status:"superseded",updated_at:new Date().toISOString()}).eq("id",supersedesQuoteId);
  if(enquiry)await db.from("enquiries").update({status:"quoted",updated_at:new Date().toISOString()}).eq("id",enquiry.id);
  await db.from("audit_events").insert({business_id:access.membership!.business_id,actor_user_id:access.user!.id,action:supersedesQuoteId?"quote.revised":"quote.created",entity_type:"quote",entity_id:quote.id,details:{quote_number:quoteNumber,customer_id:customer.id,enquiry_id:enquiry?.id??null,revision_number:revisionNumber,total}});
  return Response.json({quote},{status:201});
 }catch{return jsonError("Could not create quote.",500);}
}