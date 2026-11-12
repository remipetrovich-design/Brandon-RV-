import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";

export async function GET(request:Request){
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 const db=database(),businessId=access.membership!.business_id,quoteId=new URL(request.url).searchParams.get("quoteId");
 let query=db.from("quotes").select("id,quote_number,total,status,revision_number,enquiry_id,quote_items(description,quantity,unit_price),users(full_name),enquiries(contact_name,request_number,request_type,archived_at)").eq("business_id",businessId).eq("quote_kind","standard").eq("status","accepted").not("enquiry_id","is",null).order("updated_at",{ascending:false});
 if(quoteId)query=query.eq("id",quoteId);
 const [{data:quotes,error},{data:jobs,error:jobsError}]=await Promise.all([
  query,
  db.from("jobs").select("id,quote_id,job_number,title,status,senior_approval_status,workcard_review_status").eq("business_id",businessId).not("quote_id","is",null)
 ]);
 if(error||jobsError)return jsonError("Could not load accepted quotes and Workcards.",500);
 const jobsByQuote=new Map((jobs??[]).map(job=>[job.quote_id,job]));
 const quoteIds=(quotes??[]).map(q=>q.id);
 const {data:appointments,error:appointmentError}=quoteIds.length?await db.from("appointments").select("id,quote_id,status,starts_at,preferred_start,location").eq("business_id",businessId).in("quote_id",quoteIds).eq("status","confirmed").order("starts_at",{ascending:true}):{data:[],error:null};
 if(appointmentError)return jsonError("Could not load confirmed bookings.",500);
 const bookingByQuote=new Map((appointments??[]).map(a=>[a.quote_id,a]));
 return Response.json({acceptedQuotes:(quotes??[]).map(q=>({...q,existingWorkcard:jobsByQuote.get(q.id)??null,confirmedBooking:bookingByQuote.get(q.id)??null})),existingWorkcard:quoteId?jobsByQuote.get(quoteId)??null:null});
}

export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 try{
  const body=await request.json(),quoteId=String(body.quoteId??"");
  if(!/^[0-9a-f-]{36}$/i.test(quoteId))return jsonError("Select a customer-accepted quote.");
  const db=database(),businessId=access.membership!.business_id;
  const {data:quote,error:quoteError}=await db.from("quotes").select("id,business_id,customer_id,user_id,enquiry_id,quote_number,status,quote_items(description)").eq("id",quoteId).eq("business_id",businessId).eq("quote_kind","standard").eq("status","accepted").maybeSingle();
  if(quoteError||!quote||!quote.enquiry_id)return jsonError("Only a customer-accepted quote can create a Workcard.",409);
  const {data:enquiry}=await db.from("enquiries").select("id,request_type,request_number,customer_id,user_id,contact_name,email,description,vehicle_id,archived_at").eq("id",quote.enquiry_id).eq("business_id",businessId).maybeSingle();
  if(!enquiry||enquiry.request_type!=="quote_request"||enquiry.archived_at)return jsonError("The linked Quote Request Jobcard is no longer active.",409);
  const {data:existing}=await db.from("jobs").select("id,job_number,title,status,senior_approval_status,quote_id").eq("business_id",businessId).eq("quote_id",quote.id).maybeSingle();
  if(existing)return Response.json({job:existing,alreadyCreated:true});
  const title=String(body.title??("Work for "+quote.quote_number)).trim().slice(0,180);
  const defaultScope=(quote.quote_items??[]).map((item:any)=>item.description).join("\n")||enquiry.description;
  const scope=String(body.scope??defaultScope).trim().slice(0,5000);
  if(title.length<3||scope.length<3)return jsonError("Enter a Workcard title and approved scope of work.");
  const {data:job,error}=await db.from("jobs").insert({
   business_id:businessId,customer_id:quote.customer_id??enquiry.customer_id??null,
   user_id:quote.user_id??enquiry.user_id??null,guest_name:enquiry.contact_name,guest_email:enquiry.email,
   quote_id:quote.id,title,scope_of_work:scope,status:"pending",senior_approval_status:"not_submitted",workcard_review_status:"pending_review"
  }).select("id,job_number,title,status,senior_approval_status,quote_id").single();
  if(error||!job){
   if(error?.code==="23505"){
    const {data:duplicate}=await db.from("jobs").select("id,job_number,title,status,senior_approval_status,quote_id").eq("business_id",businessId).eq("quote_id",quote.id).maybeSingle();
    if(duplicate)return Response.json({job:duplicate,alreadyCreated:true});
   }
   return jsonError("Could not create Workcard.",500);
  }
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"workcard.created_from_accepted_quote",entity_type:"job",entity_id:job.id,details:{quote_id:quote.id,enquiry_id:enquiry.id,review_status:"pending_review"}});
  return Response.json({job},{status:201});
 }catch{return jsonError("Could not create Workcard.",500);}
}
