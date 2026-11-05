import { currentUser,database,jsonError,sameOrigin } from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();
 if(!user) return Response.redirect(new URL("/portal/sign-in",request.url),303);
 if(user.account_type!=="customer") return jsonError("Customer account required.",403);
 const form=await request.formData();
 const quoteId=String(form.get("quoteId")??"");
 const response=String(form.get("response")??"");
 if(!/^[0-9a-f-]{36}$/i.test(quoteId)||!["accepted","declined"].includes(response)) return jsonError("Invalid quote response.");
 const db=database();
 const {data:quote}=await db.from("quotes").select("id,business_id,quote_number,status").eq("id",quoteId).eq("user_id",user.id).eq("status","sent").maybeSingle();
 if(!quote) return Response.redirect(new URL("/portal/quotes?notice=unavailable",request.url),303);
 const {error}=await db.from("quotes").update({status:response,updated_at:new Date().toISOString()}).eq("id",quote.id).eq("user_id",user.id).eq("status","sent");
 if(error) return jsonError("Could not record your quote response.",500);
 await db.from("audit_events").insert({business_id:quote.business_id,actor_user_id:user.id,action:"quote."+response,entity_type:"quote",entity_id:quote.id,details:{quote_number:quote.quote_number}});
 return Response.redirect(new URL("/portal/quotes?notice="+response,request.url),303);
}