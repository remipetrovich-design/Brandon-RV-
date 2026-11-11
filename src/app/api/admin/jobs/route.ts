import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";

export async function GET(request:Request){
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 const db=database(),businessId=access.membership!.business_id,url=new URL(request.url),quoteId=url.searchParams.get("quoteId");
 let query=db.from("quotes").select("id,quote_number,total,customer_id,user_id,enquiry_id,customers(full_name),enquiries(contact_name,request_number,request_type)").eq("business_id",businessId).eq("status","accepted").not("enquiry_id","is",null).order("created_at",{ascending:false});
 if(quoteId)query=query.eq("id",quoteId);
 const [{data:quotes,error},{data:jobs},{data:staff}]=await Promise.all([
  query,
  db.from("jobs").select("id,quote_id,job_number,workcard_review_status").eq("business_id",businessId).not("quote_id","is",null),
  db.from("staff").select("id,job_title,full_name,email").eq("business_id",businessId).eq("employment_status","active").order("full_name")
 ]);
 if(error)return jsonError("Could not load accepted quotes.",500);
 const existing=new Map((jobs??[]).map(x=>[x.quote_id,x]));
 return Response.json({quotes:(quotes??[]).filter(q=>!existing.has(q.id)),existingWorkcard:quoteId?existing.get(quoteId)??null:null,staff:staff??[]});
}

export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("jobs.manage");if(access.response)return access.response;
 try{
  const body=await request.json(),quoteId=String(body.quoteId??"");
  if(!/^[0-9a-f-]{36}$/i.test(quoteId))return jsonError("Select an accepted quote.");
  const db=database(),businessId=access.membership!.business_id;
  const {data:quote}=await db.from("quotes").select("id,quote_number,status,customer_id,user_id,enquiry_id").eq("id",quoteId).eq("business_id",businessId).maybeSingle();
  if(!quote||quote.status!=="accepted"||!quote.enquiry_id)return jsonError("A Workcard can only be created from an accepted Quote Request Jobcard.",409);
  const {data:existing}=await db.from("jobs").select("id,job_number,title,status,workcard_review_status").eq("business_id",businessId).eq("quote_id",quoteId).maybeSingle();
  if(existing)return Response.json({job:existing,alreadyCreated:true});
  const [{data:enquiry},{data:items}]=await Promise.all([
   db.from("enquiries").select("id,request_type,request_number,customer_id,user_id,contact_name,email,phone,location,vehicle_description,requested_service,description,vehicle_id").eq("id",quote.enquiry_id).eq("business_id",businessId).maybeSingle(),
   db.from("quote_items").select("description").eq("quote_id",quoteId).order("sort_order")
  ]);
  if(!enquiry||enquiry.request_type!=="quote_request")return jsonError("The linked Jobcard could not be found.",404);
  const title=String(body.title??items?.[0]?.description??("Work for "+quote.quote_number)).trim().slice(0,180);
  const defaultScope=(items??[]).map((x:any)=>x.description).join("\n")||enquiry.description;
  const scope=String(body.scope??defaultScope).trim().slice(0,5000);
  if(title.length<3||scope.length<3)return jsonError("Enter a Workcard title and scope of work.");
  const {data:job,error}=await db.from("jobs").insert({
   business_id:businessId,customer_id:quote.customer_id??enquiry.customer_id??null,user_id:quote.user_id??enquiry.user_id??null,
   guest_name:enquiry.contact_name,guest_email:enquiry.email,appointment_id:null,quote_id:quote.id,
   job_number:"BRV-"+Date.now().toString(36).toUpperCase(),title,scope_of_work:scope,status:"pending",
   workcard_review_status:"pending_review"
  }).select("id,job_number,title,status,workcard_review_status,quote_id").single();
  if(error||!job)return jsonError("Could not create Workcard.",500);
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"workcard.created_from_accepted_quote",entity_type:"job",entity_id:job.id,details:{quote_id:quote.id,enquiry_id:enquiry.id,review_status:"pending_review"}});
  return Response.json({job},{status:201});
 }catch{return jsonError("Could not create Workcard.",500);}
}
