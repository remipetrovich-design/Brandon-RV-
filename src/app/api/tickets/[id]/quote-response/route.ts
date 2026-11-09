import {database,digest,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
async function guestTicket(id:string,token:string){
 const db=database();const {data:enquiry}=await db.from("enquiries").select("id,business_id,contact_name,email,guest_access_token_hash,guest_access_expires_at,request_type").eq("id",id).maybeSingle();
 if(!enquiry||enquiry.request_type!=="quote_request"||!token||enquiry.guest_access_token_hash!==digest(token)||!enquiry.guest_access_expires_at||Date.parse(enquiry.guest_access_expires_at)<=Date.now())return {db,enquiry:null};
 return {db,enquiry};
}
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const token=new URL(request.url).searchParams.get("guestToken")??"";const {db,enquiry}=await guestTicket(id,token);if(!enquiry)return jsonError("Request not found or guest access expired.",404);
 const {data:quotes,error}=await db.from("quotes").select("id,quote_number,status,revision_number,issue_date,expiry_date,subtotal,tax_amount,total,notes,terms,quote_items(id,description,quantity,unit_price,line_total)").eq("enquiry_id",id).order("revision_number",{ascending:false});
 if(error)return jsonError("Could not load your quotes.",500);return Response.json({quotes:quotes??[]});
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const {id}=await params;try{const body=await request.json();const token=String(body.guestToken??"");const response=String(body.response??"");const quoteId=String(body.quoteId??"");
  if(!["accepted","declined"].includes(response)||!/^[0-9a-f-]{36}$/i.test(quoteId))return jsonError("Invalid quote response.");
  const {db,enquiry}=await guestTicket(id,token);if(!enquiry)return jsonError("Request not found or guest access expired.",404);
  const {data:quote}=await db.from("quotes").select("id,quote_number,status").eq("id",quoteId).eq("enquiry_id",id).eq("status","sent").maybeSingle();if(!quote)return jsonError("This quote is no longer awaiting a response.",409);
  const responseAt=new Date().toISOString();const {error}=await db.from("quotes").update({status:response,response_at:responseAt,updated_at:responseAt}).eq("id",quoteId).eq("status","sent");if(error)return jsonError("Could not save your response.",500);
  await db.from("customer_messages").insert({business_id:enquiry.business_id,customer_id:null,user_id:null,enquiry_id:id,quote_id:quoteId,sender_type:"customer",sender_user_id:null,guest_name:enquiry.contact_name,guest_email:enquiry.email,message:"Quote "+quote.quote_number+" was "+response+".",is_internal:false});
  await db.from("audit_events").insert({business_id:enquiry.business_id,actor_user_id:null,action:"guest_quote."+response,entity_type:"quote",entity_id:quoteId,details:{request_id:id,response_at:responseAt}});
  return Response.json({success:true,response});
 }catch{return jsonError("Could not save your quote response.",500);}
}