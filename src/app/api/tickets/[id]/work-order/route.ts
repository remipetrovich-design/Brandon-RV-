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
 const [{data:entries,error:entryError},{data:invoice},{data:quote},{data:vehicle},{data:photos}]=await Promise.all([
  db.from("job_work_entries").select("id,entry_type,description,quantity,line_total,customer_visible").eq("business_id",enquiry.business_id).eq("job_id",job.id).eq("customer_visible",true).order("occurred_at"),
  db.from("invoices").select("invoice_number,subtotal,tax_amount,total,status,payments(id,amount,method,reference,paid_at,status),invoice_items(id,description,quantity,unit_price,line_total)").eq("business_id",enquiry.business_id).eq("job_id",job.id).maybeSingle(),
  job.quote_id?db.from("quotes").select("quote_number,total").eq("id",job.quote_id).maybeSingle():Promise.resolve({data:null}),
  appointment.vehicle_id?db.from("vehicles").select("make,model,year,registration").eq("id",appointment.vehicle_id).maybeSingle():Promise.resolve({data:null}),
  db.from("job_attachments").select("id,file_name,mime_type,storage_path").eq("business_id",enquiry.business_id).eq("job_id",job.id).eq("customer_visible",true).order("created_at",{ascending:false})
 ]);
 if(entryError)return jsonError("Could not load the final Work Order report.",500);
 const attachments=await Promise.all((photos??[]).map(async file=>{const {data:signed}=await db.storage.from("brandon-rv-private").createSignedUrl(file.storage_path,300);return {...file,url:signed?.signedUrl??null};}));
 return Response.json({workOrder:{...job,entries:entries??[],attachments,invoice:invoice??null,quote:quote??null,booking:appointment,vehicle:vehicle??null}});
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const {id}=await params;
 try{
  const body=await request.json(),token=String(body.guestToken??""),jobId=String(body.jobId??"");
  const decision=String(body.decision??""),note=String(body.note??"").trim().slice(0,2000);
  if(!/^[0-9a-f-]{36}$/i.test(jobId)||!["approved","changes_requested"].includes(decision))return jsonError("Invalid Workcard response.");
  if(decision==="changes_requested"&&note.length<5)return jsonError("Describe what needs attention before submitting.");
  const {enquiry}=await guestAccess(id,token);if(!enquiry)return jsonError("Request not found or guest access expired.",404);
  const {data,error}=await database().rpc("respond_to_completed_workcard",{p_job_id:jobId,p_business_id:enquiry.business_id,p_actor_user_id:null,p_guest_enquiry_id:id,p_guest_token_hash:digest(token),p_decision:decision,p_note:note||null});
  if(error){if(error.code==="P0001")return jsonError(error.message??"This Workcard is not ready for your response.",409);if(error.code==="22023")return jsonError(error.message??"Invalid Workcard response.");return jsonError("Could not save your Workcard response. No changes were made.",500);}
  return Response.json(data);
 }catch{return jsonError("Could not save your Workcard response.",500);}
}
