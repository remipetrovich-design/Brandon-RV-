import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const access=await authorizePermission("quotes.manage");if(access.response)return access.response;const db=database();
 const {data:customers,error}=await db.from("customers").select("id,full_name,email").eq("business_id",access.membership!.business_id).eq("status","active").order("full_name");
 if(error)return jsonError("Could not load customers.",500);return Response.json({customers:customers??[]});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const access=await authorizePermission("quotes.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const customerId=String(body.customerId??"");const description=String(body.description??"").trim();const quantity=Number(body.quantity??1);const unitPrice=Number(body.unitPrice??0);const taxRate=Number(body.taxRate??0);const notes=String(body.notes??"").trim().slice(0,3000);const terms=String(body.terms??"").trim().slice(0,3000);const expiryDate=body.expiryDate?String(body.expiryDate):null;
  if(!/^[0-9a-f-]{36}$/i.test(customerId)||description.length<3||description.length>500)return jsonError("Select a customer and enter the quoted work.");
  if(!Number.isFinite(quantity)||quantity<=0||quantity>10000||!Number.isFinite(unitPrice)||unitPrice<0||unitPrice>10000000||!Number.isFinite(taxRate)||taxRate<0||taxRate>100)return jsonError("Enter valid quantity, pricing and tax values.");
  if(expiryDate&&!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate))return jsonError("Enter a valid quote expiry date.");
  const db=database();const {data:customer}=await db.from("customers").select("id,user_id").eq("id",customerId).eq("business_id",access.membership!.business_id).eq("status","active").maybeSingle();if(!customer)return jsonError("Customer not found.",404);
  const subtotal=Number((quantity*unitPrice).toFixed(2));const taxAmount=Number((subtotal*taxRate/100).toFixed(2));const total=Number((subtotal+taxAmount).toFixed(2));const quoteNumber="BRV-Q-"+Date.now().toString(36).toUpperCase();
  const {data:quote,error}=await db.from("quotes").insert({business_id:access.membership!.business_id,customer_id:customer.id,user_id:customer.user_id,quote_number:quoteNumber,status:"draft",expiry_date:expiryDate,subtotal,tax_amount:taxAmount,total,notes:notes||null,terms:terms||null}).select("id,quote_number,total").single();
  if(error||!quote)return jsonError("Could not create quote.",500);
  const {error:itemError}=await db.from("quote_items").insert({quote_id:quote.id,description,quantity,unit_price:unitPrice,tax_rate:taxRate,line_total:subtotal,sort_order:0});
  if(itemError){await db.from("quotes").delete().eq("id",quote.id);return jsonError("Could not save quote items.",500);}
  await db.from("audit_events").insert({business_id:access.membership!.business_id,actor_user_id:access.user!.id,action:"quote.created",entity_type:"quote",entity_id:quote.id,details:{quote_number:quoteNumber,customer_id:customer.id,total}});
  return Response.json({quote},{status:201});
 }catch{return jsonError("Could not create quote.",500);}
}