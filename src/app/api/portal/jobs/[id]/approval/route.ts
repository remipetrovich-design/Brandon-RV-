import {currentUser,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();if(!user||user.account_type!=="customer")return jsonError("Customer account required.",403);
 const {id}=await params;
 try{
  const body=await request.json(),decision=String(body.decision??""),note=String(body.note??"").trim().slice(0,2000);
  if(!["approved","changes_requested"].includes(decision))return jsonError("Choose approve or request changes.");
  if(decision==="changes_requested"&&note.length<5)return jsonError("Describe what needs attention before submitting.");
  const db=database();const {data:job}=await db.from("jobs").select("id,business_id,quote_id,appointment_id").eq("id",id).eq("user_id",user.id).maybeSingle();if(!job)return jsonError("Completed Workcard not found.",404);
  const {data,error}=await db.rpc("respond_to_completed_workcard",{p_job_id:id,p_business_id:job.business_id,p_actor_user_id:user.id,p_guest_enquiry_id:null,p_guest_token_hash:null,p_decision:decision,p_note:note||null});
  if(error){if(error.code==="P0001")return jsonError(error.message??"This Workcard is not ready for your response.",409);if(error.code==="22023")return jsonError(error.message??"Invalid Workcard response.");return jsonError("Could not save your Workcard response. No changes were made.",500);}
  if(decision==="approved"){
   let enquiryId:string|null=null;
   if(job.quote_id){const quote=await db.from("quotes").select("enquiry_id").eq("id",job.quote_id).eq("business_id",job.business_id).maybeSingle();enquiryId=quote.data?.enquiry_id??null;}
   if(!enquiryId&&job.appointment_id){const appointment=await db.from("appointments").select("enquiry_id").eq("id",job.appointment_id).eq("business_id",job.business_id).maybeSingle();enquiryId=appointment.data?.enquiry_id??null;}
   if(enquiryId){
    const {data:enquiry}=await db.from("enquiries").select("stage").eq("id",enquiryId).eq("business_id",job.business_id).maybeSingle();
    const nextStage=data?.invoiceStatus==="issued"?"invoiced":"ready_to_invoice";
    if(enquiry&&enquiry.stage!==nextStage){
     await db.from("enquiries").update({stage:nextStage,status:"converted",updated_at:new Date().toISOString()}).eq("id",enquiryId).eq("business_id",job.business_id);
     await db.from("enquiry_stage_history").insert({business_id:job.business_id,enquiry_id:enquiryId,from_stage:enquiry.stage,to_stage:nextStage,changed_by:user.id,note:"Customer approved the completed Workcard."});
    }
   }
  }
  return Response.json(data);
 }catch{return jsonError("Could not save your Workcard response.",500);}
}
