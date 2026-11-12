import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";

export async function GET(request:Request){
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 const db=database(),businessId=access.membership!.business_id,url=new URL(request.url),quoteId=url.searchParams.get("quoteId");
 let bookingQuery=db.from("appointments").select("id,quote_id,enquiry_id,customer_id,user_id,guest_name,guest_email,location,starts_at,ends_at,quotes(quote_number,status,quote_items(description,sort_order)),enquiries(contact_name,request_number,request_type)").eq("business_id",businessId).eq("status","confirmed").not("quote_id","is",null).order("starts_at",{ascending:true});
 if(quoteId)bookingQuery=bookingQuery.eq("quote_id",quoteId);
 const [{data:bookings,error},{data:jobs,error:jobsError},{data:staff,error:staffError}]=await Promise.all([
  bookingQuery,
  db.from("jobs").select("id,appointment_id,quote_id,job_number,title,status,workcard_review_status").eq("business_id",businessId).not("appointment_id","is",null),
  db.from("staff").select("id,job_title,full_name,email").eq("business_id",businessId).eq("employment_status","active").order("full_name")
 ]);
 if(error||jobsError||staffError)return jsonError("Could not load confirmed bookings and Workcards.",500);
 const existingByAppointment=new Map((jobs??[]).map(job=>[job.appointment_id,job]));
 const existingWorkcard=quoteId?(jobs??[]).find(job=>job.quote_id===quoteId)??null:null;
 return Response.json({
  bookings:(bookings??[]).filter(booking=>!existingByAppointment.has(booking.id)),
  existingWorkcard,
  staff:staff??[]
 });
}

export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 try{
  const body=await request.json(),appointmentId=String(body.appointmentId??"");
  if(!/^[0-9a-f-]{36}$/i.test(appointmentId))return jsonError("Select a confirmed booking.");
  const db=database(),businessId=access.membership!.business_id;
  const {data:appointment,error:appointmentError}=await db.from("appointments").select("id,business_id,customer_id,user_id,guest_name,guest_email,enquiry_id,quote_id,location,starts_at,ends_at,status").eq("id",appointmentId).eq("business_id",businessId).eq("status","confirmed").maybeSingle();
  if(appointmentError||!appointment||!appointment.quote_id||!appointment.enquiry_id||!appointment.starts_at||!appointment.ends_at||!appointment.location)return jsonError("Only a complete confirmed booking linked to an accepted quote can create a Workcard.",409);
  const {data:quote}=await db.from("quotes").select("id,quote_number,status,customer_id,user_id,enquiry_id").eq("id",appointment.quote_id).eq("business_id",businessId).eq("status","accepted").maybeSingle();
  if(!quote||quote.enquiry_id!==appointment.enquiry_id)return jsonError("The booking must reference the accepted quote for this Jobcard.",409);
  const {data:existing}=await db.from("jobs").select("id,job_number,title,status,workcard_review_status,quote_id").eq("business_id",businessId).eq("quote_id",quote.id).limit(1).maybeSingle();
  if(existing)return Response.json({job:existing,alreadyCreated:true});
  const [{data:enquiry},{data:items}]=await Promise.all([
   db.from("enquiries").select("id,request_type,request_number,customer_id,user_id,contact_name,email,description,vehicle_id").eq("id",appointment.enquiry_id).eq("business_id",businessId).maybeSingle(),
   db.from("quote_items").select("description,sort_order").eq("quote_id",quote.id).order("sort_order")
  ]);
  if(!enquiry||enquiry.request_type!=="quote_request")return jsonError("The linked Quote Request Jobcard could not be found.",404);
  const title=String(body.title??("Work for "+quote.quote_number)).trim().slice(0,180);
  const defaultScope=(items??[]).map((item:any)=>item.description).join("\n")||enquiry.description;
  const scope=String(body.scope??defaultScope).trim().slice(0,5000);
  if(title.length<3||scope.length<3)return jsonError("Enter a Workcard title and approved scope of work.");
  const {data:job,error}=await db.from("jobs").insert({
   business_id:businessId,customer_id:appointment.customer_id??quote.customer_id??enquiry.customer_id??null,
   user_id:appointment.user_id??quote.user_id??enquiry.user_id??null,
   guest_name:appointment.guest_name??enquiry.contact_name,guest_email:appointment.guest_email??enquiry.email,
   appointment_id:appointment.id,quote_id:quote.id,
   job_number:"BRV-"+Date.now().toString(36).toUpperCase(),title,scope_of_work:scope,status:"pending",
   scheduled_start:appointment.starts_at,scheduled_end:appointment.ends_at,workcard_review_status:"pending_review"
  }).select("id,job_number,title,status,workcard_review_status,quote_id,appointment_id").single();
  if(error||!job)return jsonError("Could not create Workcard.",500);
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"workcard.created_from_confirmed_booking",entity_type:"job",entity_id:job.id,details:{appointment_id:appointment.id,quote_id:quote.id,enquiry_id:enquiry.id,review_status:"pending_review"}});
  return Response.json({job},{status:201});
 }catch{return jsonError("Could not create Workcard.",500);}
}
