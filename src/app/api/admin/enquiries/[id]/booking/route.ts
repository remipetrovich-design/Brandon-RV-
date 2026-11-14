import {authorizePermission,database,jsonError} from "@/lib/auth";
export const runtime="nodejs";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const access=await authorizePermission("enquiries.view");if(access.response)return access.response;
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return jsonError("Invalid Jobcard ID.");
 const db=database(),businessId=access.membership!.business_id;
 const {data:enquiry,error:enquiryError}=await db.from("enquiries").select("id,request_number").eq("id",id).eq("business_id",businessId).maybeSingle();
 if(enquiryError||!enquiry)return jsonError("Jobcard not found.",404);
 const {data:quotes,error:quoteError}=await db.from("quotes").select("id").eq("business_id",businessId).eq("enquiry_id",id);
 if(quoteError)return jsonError("Could not load Jobcard quote links.",500);
 const quoteIds=(quotes??[]).map(quote=>quote.id);
 const [byEnquiry,byQuote]=await Promise.all([
  db.from("appointments").select("id,status,quote_id,preferred_start,preferred_end,starts_at,ends_at,location,customer_notes,internal_notes,created_at,updated_at").eq("business_id",businessId).eq("enquiry_id",id).order("created_at",{ascending:false}),
  quoteIds.length?db.from("appointments").select("id,status,quote_id,preferred_start,preferred_end,starts_at,ends_at,location,customer_notes,internal_notes,created_at,updated_at").eq("business_id",businessId).in("quote_id",quoteIds).order("created_at",{ascending:false}):Promise.resolve({data:[],error:null})
 ]);
 if(byEnquiry.error||byQuote.error)return jsonError("Could not load Jobcard booking requests.",500);
 const appointments=[...new Map([...(byEnquiry.data??[]),...(byQuote.data??[])].map(appointment=>[appointment.id,appointment])).values()].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
 const {data:jobs,error:jobsError}=quoteIds.length?await db.from("jobs").select("id,job_number,title,status,quote_id").eq("business_id",businessId).in("quote_id",quoteIds):{data:[],error:null};
 if(jobsError)return jsonError("Could not load linked Workcards.",500);
 const jobByQuote=new Map((jobs??[]).map(job=>[job.quote_id,job]));
 return Response.json({enquiry,bookings:(appointments??[]).map(appointment=>({...appointment,workcard:jobByQuote.get(appointment.quote_id)??null}))});
}
