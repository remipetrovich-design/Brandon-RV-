import {currentUser,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();if(!user)return Response.redirect(new URL("/portal/sign-in",request.url),303);
 if(user.account_type!=="customer")return jsonError("Customer account required.",403);
 const form=await request.formData();
 const quoteId=String(form.get("quoteId")??"");
 const response=String(form.get("response")??"");
 const responseNote=String(form.get("responseNote")??"").trim().slice(0,1000);
 if(!/^[0-9a-f-]{36}$/i.test(quoteId)||!["accepted","declined"].includes(response))return jsonError("Invalid quote response.");
 const returnTo=String(form.get("returnTo")??"");
 const prefix="/portal/jobcards/";
 const destination=returnTo.startsWith(prefix)&&/^[0-9a-f-]{36}$/i.test(returnTo.slice(prefix.length))?returnTo:"/portal/quotes";
 const db=database();
 const {data:quote}=await db.from("quotes").select("quote_kind").eq("id",quoteId).eq("user_id",user.id).maybeSingle();
 const rpcName=quote?.quote_kind==="variation"?"respond_to_job_variation":"respond_to_customer_quote";
 const {data,error}=await db.rpc(rpcName,{
  p_quote_id:quoteId,p_user_id:user.id,p_response:response,p_response_note:responseNote||null
 });
 if(error){
  if(error.code==="P0001")return Response.redirect(new URL(destination+"?notice=unavailable",request.url),303);
  return jsonError("Could not record your quote response. No changes were made.",500);
 }
 if(!data?.success)return jsonError("Could not confirm your quote response. No changes were made.",500);
 const notice=quote?.quote_kind==="variation"?(response==="declined"?"variation_declined":"variation_accepted"):(response==="declined"?"declined":"accepted");
 return Response.redirect(new URL(destination+"?notice="+notice,request.url),303);
}
