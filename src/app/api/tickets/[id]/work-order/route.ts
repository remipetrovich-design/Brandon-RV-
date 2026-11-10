import {database,digest,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";

async function guestAccess(id:string,token:string){
 const db=database();
 const {data:enquiry}=await db.from("enquiries").select("id,business_id,contact_name,email,guest_access_token_hash,guest_access_expires_at,request_type").eq("id",id).maybeSingle();
 if(!enquiry||enquiry.request_type!=="quote_request"||!token||enquiry.guest_access_token_hash!==digest(token)||!enquiry.guest_access_expires_at||Date.parse(enquiry.guest_access_expires_at)<=Date.now())return {db,enquiry:null};
 return {db,enquiry};
}

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const token=new URL(request.url).searchParams.get("guestToken")??"";
 const {db,enquiry}=await guestAccess(id,token);if(!enquiry)return jsonError("Request not found or guest access expired.",404);
 const {data:appointments}=await db.from("appointments").select("id,starts_at,ends_at,location,vehicle_id").eq("business_id",enquiry.business_id).eq("enquiry_id",id).eq("status","confirmed").order("starts_at",{ascending:false}).limit(1);
 const appointment=appointments?.[0];if(!appointment)return Response.json({workOrder:null});
 const {data:job}=await db.from("jobs").select("id,job_number,title,status,work_summary,customer_approval_status,senior_approval_status,quote_id").eq("business_id",enquiry.business_id).eq("appointment_id",appointment.id).maybeSingle();
 if(!job)return Response.json({workOrder:null});
 const [{data:entries,error:entryError},{data:invoice},{data:quote},{data:vehicle}]=await Promise.all([
  db.from("job_work_entries").select("id,entry_type,description,quantity,line_total,customer_visible").eq("business_id",enquiry.business_id).eq("job_id",job.id).eq("customer_visible",true).order("occurred_at"),
  db.from("invoices").select("invoice_number,total,status,payments(id,amount,method,reference,paid_at,status)").eq("business_id",enquiry.business_id).eq("job_id",job.id).maybeSingle(),
  job.quote_id?db.from("quotes").select("quote_number,total").eq("id",job.quote_id).maybeSingle():Promise.resolve({data:null}),
  appointment.vehicle_id?db.from("vehicles").select("make,model,year,registration").eq("id",appointment.vehicle_id).maybeSingle():Promise.resolve({data:null})
 ]);
 if(entryError)return jsonError("Could not load the final Work Order report.",500);
 return Response.json({workOrder:{...job,entries:entries??[],invoice:invoice??null,quote:quote??null,booking:appointment,vehicle:vehicle??null}});
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const {id}=await params;
 try{
  const body=await request.json();const token=String(body.guestToken??"");const jobId=String(body.jobId??"");
  const decision=String(body.decision??"");const note=String(body.note??"").trim().slice(0,2000);
  if(!/^[0-9a-f-]{36}$/i.test(jobId)||!["approved","changes_requested"].includes(decision))return jsonError("Invalid Work Order response.");
  if(decision==="changes_requested"&&note.length<5)return jsonError("Describe what needs attention before submitting.");
  const {db,enquiry}=await guestAccess(id,token);if(!enquiry)return jsonError("Request not found or guest access expired.",404);
  const {data:appointments}=await db.from("appointments").select("id,quote_id").eq("business_id",enquiry.business_id).eq("enquiry_id",id).eq("status","confirmed");
  const appointmentIds=(appointments??[]).map(x=>x.id);if(!appointmentIds.length)return jsonError("No confirmed booking was found for this request.",404);
  const {data:job}=await db.from("jobs").select("id,business_id,job_number,status,customer_approval_status,senior_approval_status,appointment_id,quote_id").eq("id",jobId).eq("business_id",enquiry.business_id).in("appointment_id",appointmentIds).maybeSingle();
  if(!job||job.status!=="completed"||!["approved","legacy_approved"].includes(String(job.senior_approval_status))||job.customer_approval_status!=="pending")return jsonError("This Workcard is not yet approved for customer review.",409);
  const {data:invoice}=await db.from("invoices").select("id,invoice_number,status").eq("job_id",job.id).eq("business_id",job.business_id).maybeSingle();
  if(!invoice||invoice.status!=="draft")return jsonError("The final invoice is not ready for approval.",409);
  const now=new Date().toISOString();
  const {error:jobError}=await db.from("jobs").update({customer_approval_status:decision,customer_approved_at:decision==="approved"?now:null,customer_approval_note:note||null,updated_at:now}).eq("id",job.id).eq("customer_approval_status","pending");
  if(jobError)return jsonError("Could not save your Work Order response.",500);
  if(decision==="approved"){
   const {error:invoiceError}=await db.from("invoices").update({status:"issued",issue_date:now.slice(0,10),updated_at:now}).eq("id",invoice.id).eq("status","draft");
   if(invoiceError){await db.from("jobs").update({customer_approval_status:"pending",customer_approved_at:null,updated_at:new Date().toISOString()}).eq("id",job.id);return jsonError("Your approval was saved but the invoice could not be issued. Please contact Brandon RV.",500);}
  }
  await db.from("customer_messages").insert({business_id:job.business_id,customer_id:null,user_id:null,enquiry_id:id,quote_id:job.quote_id,sender_type:"customer",sender_user_id:null,guest_name:enquiry.contact_name,guest_email:enquiry.email,message:decision==="approved"?"Customer approved completed Work Order "+job.job_number+".":"Customer requested changes to completed Work Order "+job.job_number+": "+note,is_internal:false});
  await db.from("audit_events").insert({business_id:job.business_id,actor_user_id:null,action:"guest_work_order.customer_"+decision,entity_type:"job",entity_id:job.id,details:{invoice_id:invoice.id,note,request_id:id}});
  return Response.json({success:true,decision,invoiceStatus:decision==="approved"?"issued":"draft"});
 }catch{return jsonError("Could not save your Work Order response.",500);}
}
