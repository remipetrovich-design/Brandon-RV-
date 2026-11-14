import {currentUser,currentMembership,database,userHasPermission,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 const membership=await currentMembership(user.id);if(!membership||!(await userHasPermission(user.id,"payments.manage")))return jsonError("You do not have permission to record payments.",403);
 try{
  const {id}=await params,body=await request.json();
  const amount=Number(body.amount),method=String(body.method??"other"),reference=String(body.reference??"").trim().slice(0,120);
  if(!Number.isFinite(amount)||amount<=0||amount>10000000)return jsonError("Enter a valid payment amount.");
  if(!["cash","bank_transfer","card","other"].includes(method))return jsonError("Select a valid payment method.");
  const db=database();
  const {data:invoice}=await db.from("invoices").select("job_id,quote_id").eq("id",id).eq("business_id",membership.business_id).maybeSingle();
  const {data,error}=await db.rpc("record_invoice_payment",{p_invoice_id:id,p_business_id:membership.business_id,p_actor_user_id:user.id,p_amount:amount,p_method:method,p_reference:reference||null});
  if(error){if(error.code==="P0001")return jsonError(error.message??"This invoice cannot accept payment.",409);if(error.code==="22023")return jsonError(error.message??"Enter a valid payment.",400);return jsonError("Could not record payment. No changes were made.",500);}
  if(invoice&&(data?.invoiceStatus==="part_paid"||data?.invoiceStatus==="paid")){
   let enquiryId:string|null=null;
   if(invoice.quote_id){const quote=await db.from("quotes").select("enquiry_id").eq("id",invoice.quote_id).eq("business_id",membership.business_id).maybeSingle();enquiryId=quote.data?.enquiry_id??null;}
   if(!enquiryId&&invoice.job_id){const job=await db.from("jobs").select("quote_id").eq("id",invoice.job_id).eq("business_id",membership.business_id).maybeSingle();if(job.data?.quote_id){const quote=await db.from("quotes").select("enquiry_id").eq("id",job.data.quote_id).eq("business_id",membership.business_id).maybeSingle();enquiryId=quote.data?.enquiry_id??null;}}
   if(enquiryId){
    const {data:enquiry}=await db.from("enquiries").select("stage").eq("id",enquiryId).eq("business_id",membership.business_id).maybeSingle();
    const nextStage=data.invoiceStatus==="paid"?"paid":"awaiting_payment";
    if(enquiry&&enquiry.stage!==nextStage){
     await db.from("enquiries").update({stage:nextStage,updated_at:new Date().toISOString()}).eq("id",enquiryId).eq("business_id",membership.business_id);
     await db.from("enquiry_stage_history").insert({business_id:membership.business_id,enquiry_id:enquiryId,from_stage:enquiry.stage,to_stage:nextStage,changed_by:user.id,note:data.invoiceStatus==="paid"?"Final invoice fully paid.":"Part payment recorded; balance remains outstanding."});
    }
   }
  }
  return Response.json(data);
 }catch{return jsonError("Could not record payment.",500);}
}
