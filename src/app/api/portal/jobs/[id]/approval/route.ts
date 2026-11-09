import {currentUser,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();if(!user||user.account_type!=="customer")return jsonError("Customer account required.",403);
 const {id}=await params;
 try{
  const body=await request.json();const decision=String(body.decision??"");const note=String(body.note??"").trim().slice(0,2000);
  if(!["approved","changes_requested"].includes(decision))return jsonError("Choose approve or request changes.");
  if(decision==="changes_requested"&&note.length<5)return jsonError("Describe what needs attention before submitting.");
  const db=database();const {data:job}=await db.from("jobs").select("id,business_id,job_number,status,customer_approval_status").eq("id",id).eq("user_id",user.id).maybeSingle();
  if(!job)return jsonError("Completed Work Order not found.",404);
  if(job.status!=="completed"||job.customer_approval_status!=="pending")return jsonError("This Work Order is not awaiting customer approval.",409);
  const now=new Date().toISOString();
  const {data:invoice}=await db.from("invoices").select("id,invoice_number,status").eq("job_id",id).eq("business_id",job.business_id).maybeSingle();
  if(!invoice||invoice.status!=="draft")return jsonError("The final invoice is not ready for approval.",409);
  const {error:jobError}=await db.from("jobs").update({
   customer_approval_status:decision,customer_approved_at:decision==="approved"?now:null,
   customer_approval_note:note||null,updated_at:now
  }).eq("id",id).eq("user_id",user.id).eq("customer_approval_status","pending");
  if(jobError)return jsonError("Could not save your Work Order response.",500);
  if(decision==="approved"){
   const {error:invoiceError}=await db.from("invoices").update({status:"issued",issue_date:now.slice(0,10),updated_at:now}).eq("id",invoice.id).eq("status","draft");
   if(invoiceError){await db.from("jobs").update({customer_approval_status:"pending",customer_approved_at:null,updated_at:new Date().toISOString()}).eq("id",id);return jsonError("Your approval was saved but the invoice could not be issued. Please contact Brandon RV.",500);}
  }
  await db.from("audit_events").insert({business_id:job.business_id,actor_user_id:user.id,action:"work_order.customer_"+decision,entity_type:"job",entity_id:id,details:{invoice_id:invoice.id,note}});
  return Response.json({success:true,decision,invoiceStatus:decision==="approved"?"issued":"draft"});
 }catch{return jsonError("Could not save your Work Order response.",500);}
}
