import {currentUser,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();if(!user)return Response.redirect(new URL("/portal/sign-in",request.url),303);
 if(user.account_type!=="customer")return jsonError("Customer account required.",403);
 const form=await request.formData();const quoteId=String(form.get("quoteId")??"");const response=String(form.get("response")??"");const responseNote=String(form.get("responseNote")??"").trim().slice(0,1000);
 if(!/^[0-9a-f-]{36}$/i.test(quoteId)||!["accepted","declined"].includes(response))return jsonError("Invalid quote response.");
 const db=database();const {data:quote}=await db.from("quotes").select("id,business_id,enquiry_id,quote_number,status").eq("id",quoteId).eq("user_id",user.id).eq("status","sent").maybeSingle();
 if(!quote)return Response.redirect(new URL("/portal/quotes?notice=unavailable",request.url),303);
 const responseAt=new Date().toISOString();
 const {error}=await db.from("quotes").update({status:response,response_at:responseAt,response_note:responseNote||null,updated_at:responseAt}).eq("id",quote.id).eq("user_id",user.id).eq("status","sent");
 if(error)return jsonError("Could not record your quote response.",500);
 const declined=response==="declined";
 const message=declined?"Quote "+quote.quote_number+" was declined by the customer. The request has been closed and archived."+(responseNote?" Reason: "+responseNote:""):"Quote "+quote.quote_number+" was accepted by the customer.";
 await db.from("customer_messages").insert({business_id:quote.business_id,customer_id:user.id,user_id:user.id,enquiry_id:quote.enquiry_id,quote_id:quote.id,sender_type:"customer",sender_user_id:user.id,message,is_internal:false});
 if(declined&&quote.enquiry_id){
  const {data:enquiry}=await db.from("enquiries").select("id,stage").eq("id",quote.enquiry_id).eq("business_id",quote.business_id).maybeSingle();
  if(enquiry&& !["converted","closed"].includes(String(enquiry.stage))){
   const {error:closeError}=await db.from("enquiries").update({stage:"closed",status:"closed",updated_at:responseAt}).eq("id",enquiry.id).eq("business_id",quote.business_id);
   if(closeError)return jsonError("Your quote was declined, but the request could not be closed automatically. Please contact Brandon RV.",500);
   await db.from("enquiry_stage_history").insert({business_id:quote.business_id,enquiry_id:enquiry.id,from_stage:enquiry.stage,to_stage:"closed",changed_by:user.id,note:"Customer declined quote "+quote.quote_number+". Request automatically closed and archived."});
  }
 }
 await db.from("audit_events").insert({business_id:quote.business_id,actor_user_id:user.id,action:declined?"quote.declined_and_request_archived":"quote.accepted",entity_type:"quote",entity_id:quote.id,details:{quote_number:quote.quote_number,response_at:responseAt,response_note:responseNote||null,enquiry_id:quote.enquiry_id,request_closed:declined}});
 return Response.redirect(new URL("/portal/quotes?notice="+(declined?"declined":response),request.url),303);
}
