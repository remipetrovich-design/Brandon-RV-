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
  const {data,error}=await database().rpc("respond_to_completed_workcard",{p_job_id:id,p_business_id:user.business_id,p_actor_user_id:user.id,p_guest_enquiry_id:null,p_guest_token_hash:null,p_decision:decision,p_note:note||null});
  if(error){if(error.code==="P0001")return jsonError(error.message??"This Workcard is not ready for your response.",409);if(error.code==="22023")return jsonError(error.message??"Invalid Workcard response.");return jsonError("Could not save your Workcard response. No changes were made.",500);}
  return Response.json(data);
 }catch{return jsonError("Could not save your Workcard response.",500);}
}
