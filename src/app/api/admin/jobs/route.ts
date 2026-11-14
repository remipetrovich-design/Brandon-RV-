import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";

export async function GET(request:Request){
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 const db=database(),businessId=access.membership!.business_id,quoteId=new URL(request.url).searchParams.get("quoteId");
 let query=db.from("quotes").select("id,quote_number,total,status,revision_number,enquiry_id,quote_items(description,quantity,unit_price),users!quotes_user_id_users_fkey(full_name),enquiries!quotes_enquiry_id_fkey(contact_name,request_number,request_type,archived_at)").eq("business_id",businessId).eq("quote_kind","standard").eq("status","accepted").not("enquiry_id","is",null).order("updated_at",{ascending:false});
 if(quoteId)query=query.eq("id",quoteId);
 const [{data:quotes,error},{data:jobs,error:jobsError}]=await Promise.all([
  query,
  db.from("jobs").select("id,quote_id,job_number,title,status,senior_approval_status,workcard_review_status").eq("business_id",businessId).not("quote_id","is",null)
 ]);
 if(error||jobsError)return jsonError("Could not load accepted quotes and Workcards.",500);
 const availableQuotes=(quotes??[]).filter((quote:any)=>quote.enquiries?.request_type==="quote_request"&&!quote.enquiries?.archived_at);
 const jobsByQuote=new Map((jobs??[]).map(job=>[job.quote_id,job]));
 const quoteIds=availableQuotes.map(q=>q.id);
 const {data:appointments,error:appointmentError}=quoteIds.length?await db.from("appointments").select("id,quote_id,status,starts_at,preferred_start,location").eq("business_id",businessId).in("quote_id",quoteIds).eq("status","confirmed").order("starts_at",{ascending:true}):{data:[],error:null};
 if(appointmentError)return jsonError("Could not load confirmed bookings.",500);
 const bookingByQuote=new Map((appointments??[]).map(a=>[a.quote_id,a]));
 return Response.json({acceptedQuotes:availableQuotes.map(q=>({...q,existingWorkcard:jobsByQuote.get(q.id)??null,confirmedBooking:bookingByQuote.get(q.id)??null})),existingWorkcard:quoteId?jobsByQuote.get(quoteId)??null:null});
}

export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 try{
  const body=await request.json(),quoteId=String(body.quoteId??"");
  if(!/^[0-9a-f-]{36}$/i.test(quoteId))return jsonError("Select a customer-accepted quote.");
  const db=database(),businessId=access.membership!.business_id;
  const {data:quote,error:quoteError}=await db.from("quotes").select("id,business_id,customer_id,user_id,enquiry_id,quote_number,status,quote_items(id,description,quantity,unit_price,tax_rate,item_type,service_id)").eq("id",quoteId).eq("business_id",businessId).eq("quote_kind","standard").eq("status","accepted").maybeSingle();
  if(quoteError||!quote||!quote.enquiry_id)return jsonError("Only a customer-accepted quote can create a Workcard.",409);
  const {data:enquiry}=await db.from("enquiries").select("id,request_type,request_number,customer_id,user_id,contact_name,email,description,vehicle_id,archived_at,stage,status").eq("id",quote.enquiry_id).eq("business_id",businessId).maybeSingle();
  if(!enquiry||enquiry.request_type!=="quote_request"||enquiry.archived_at)return jsonError("The linked Quote Request Jobcard is no longer active.",409);
  const {data:existing}=await db.from("jobs").select("id,job_number,title,status,senior_approval_status,quote_id").eq("business_id",businessId).eq("quote_id",quote.id).maybeSingle();
  if(existing)return Response.json({job:existing,alreadyCreated:true});
  const title=String(body.title??("Work for "+quote.quote_number)).trim().slice(0,180);
  const defaultScope=(quote.quote_items??[]).map((item:any)=>item.description).join("\n")||enquiry.description;
  const scope=String(body.scope??defaultScope).trim().slice(0,5000);
  if(title.length<3||scope.length<3)return jsonError("Enter a Workcard title and approved scope of work.");
  // jobs.job_number is NOT NULL and has no database default. Generate it here.
  const jobNumber="BRV-WC-"+new Date().toISOString().slice(2,10).replaceAll("-","")+"-"+crypto.randomUUID().replaceAll("-","").slice(0,8).toUpperCase();
  const {data:linkedAppointment,error:appointmentLookupError}=await db.from("appointments").select("id,status,starts_at,ends_at").eq("business_id",businessId).eq("quote_id",quote.id).in("status",["requested","confirmed","rescheduled"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(appointmentLookupError)return jsonError("Could not link the existing customer booking to the new Workcard.",500);
  const bookingConfirmed=Boolean(linkedAppointment&&["confirmed","rescheduled"].includes(linkedAppointment.status));
  const hasQuotedParts=(quote.quote_items??[]).some((item:any)=>item.item_type==="parts");
  const nextEnquiryStage=hasQuotedParts?"parts_required":bookingConfirmed?"booked":linkedAppointment?.status==="requested"?"booking_requested":"workcard_created";
  const {data:job,error}=await db.from("jobs").insert({
   business_id:businessId,customer_id:quote.customer_id??enquiry.customer_id??null,
   user_id:quote.user_id??enquiry.user_id??null,guest_name:enquiry.contact_name,guest_email:enquiry.email,
   quote_id:quote.id,appointment_id:linkedAppointment?.id??null,scheduled_start:bookingConfirmed?linkedAppointment?.starts_at??null:null,scheduled_end:bookingConfirmed?linkedAppointment?.ends_at??null:null,job_number:jobNumber,title,scope_of_work:scope,status:bookingConfirmed?"scheduled":"pending",senior_approval_status:"not_submitted",workcard_review_status:"pending_review"
  }).select("id,job_number,title,status,senior_approval_status,quote_id").single();
  if(error||!job){
   console.error("Workcard insert failed",error);
   if(error?.code==="23505"){
    const {data:duplicate}=await db.from("jobs").select("id,job_number,title,status,senior_approval_status,quote_id").eq("business_id",businessId).eq("quote_id",quote.id).maybeSingle();
    if(duplicate)return Response.json({job:duplicate,alreadyCreated:true});
   }
   return jsonError("Could not create Workcard.",500);
  }
  // Convert the accepted quote into a prepared worker Workcard.
  // These are planned lines only: no quantity is treated as used or invoiceable.
  const plannedEntries=(quote.quote_items??[]).map((item:any)=>({
   business_id:businessId,job_id:job.id,created_by:access.user!.id,
   source_quote_item_id:item.id,entry_type:item.item_type==="parts"?"parts":"labour",
   description:String(item.description),quantity:Number(item.quantity),
   quantity_required:Number(item.quantity),quantity_used:0,
   quantity_ordered:0,quantity_received:0,
   part_order_status:item.item_type==="parts"?"not_ordered":"not_required",
   unit_price:Number(item.unit_price),cost_unit_price:0,tax_rate:Number(item.tax_rate??0),
   line_total:0,service_id:item.service_id??null,
   customer_visible:false,invoiceable:false
  }));
  if(plannedEntries.length){
   const {error:entryError}=await db.from("job_work_entries").insert(plannedEntries);
   if(entryError){
    console.error("Prepared Workcard entry creation failed",entryError);
    await db.from("jobs").delete().eq("id",job.id).eq("business_id",businessId);
    return jsonError("Could not prepare the Workcard from the accepted quote. No incomplete Workcard was kept.",500);
   }
  }
  const {error:jobcardError}=await db.from("enquiries").update({stage:nextEnquiryStage,status:"converted",updated_at:new Date().toISOString()}).eq("id",enquiry.id).eq("business_id",businessId);
  if(jobcardError){
   console.error("Jobcard conversion update failed",jobcardError);
   await db.from("job_work_entries").delete().eq("job_id",job.id).eq("business_id",businessId);
   await db.from("jobs").delete().eq("id",job.id).eq("business_id",businessId);
   return jsonError("Could not link the Workcard back to its original Jobcard. No incomplete conversion was kept.",500);
  }
  if(enquiry.stage!=="converted"){
   await db.from("enquiry_stage_history").insert({business_id:businessId,enquiry_id:enquiry.id,from_stage:enquiry.stage??null,to_stage:nextEnquiryStage,changed_by:access.user!.id,note:"Accepted quote converted into a prepared Workcard."});
  }
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"workcard.created_from_accepted_quote",entity_type:"job",entity_id:job.id,details:{quote_id:quote.id,enquiry_id:enquiry.id,review_status:"pending_review",prepared_entry_count:plannedEntries.length}});
  return Response.json({job},{status:201});
 }catch(error){
  console.error("Workcard creation failed",error);
  return jsonError("Could not create Workcard.",500);
 }
}
