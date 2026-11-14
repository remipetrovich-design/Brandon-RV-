import {currentUser,currentMembership,database,jsonError} from "@/lib/auth";
export const runtime="nodejs";
const firstRelation=<T,>(value:T|T[]|null|undefined):T|null=>Array.isArray(value)?value[0]??null:value??null;
export async function GET(){
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 const membership=await currentMembership(user.id);if(!membership)return jsonError("Staff access required.",403);
 const db=database();const {data:staff}=await db.from("staff").select("id").eq("user_id",user.id).eq("business_id",membership.business_id).maybeSingle();
 if(!staff)return jsonError("Employee profile not found.",404);
 const {data:assignments,error}=await db.from("job_assignments").select("id,job_id,status,assigned_at").eq("business_id",membership.business_id).eq("staff_id",staff.id).in("status",["assigned","accepted","completed"]).order("assigned_at",{ascending:false});
 if(error)return jsonError("Could not load assigned Workcards.",500);
 const ids=(assignments??[]).map(x=>x.job_id);
 const [{data:jobs, error:jobError},{data:entries,error:entryError}]=await Promise.all([
  ids.length?db.from("jobs").select("id,job_number,title,scope_of_work,status,scheduled_start,scheduled_end,actual_start,customer_visible_notes,work_summary,worker_signed_off_at,senior_approval_status,senior_approval_note,senior_approved_at,appointment_id,quote_id,guest_name,guest_email,customers(full_name,email,phone),quotes(quote_number,status,total,enquiries(id,request_number,request_type,requested_service,description,location,contact_name,email,phone,vehicle_description,vehicles(make,model,year,vehicle_type,registration,vin)))").eq("business_id",membership.business_id).in("id",ids):Promise.resolve({data:[],error:null}),
  ids.length?db.from("job_work_entries").select("id,job_id,source_quote_item_id,entry_type,description,quantity,quantity_required,quantity_used,quantity_ordered,quantity_received,quantity_returned,part_order_status,supplier_order_reference,ordered_at,expected_at,received_at,unit_price,cost_unit_price,tax_rate,line_total,part_number,supplier_name,invoiceable,occurred_at,customer_visible").in("job_id",ids).eq("business_id",membership.business_id).order("occurred_at",{ascending:false}):Promise.resolve({data:[],error:null})
 ]);
 if(jobError||entryError)return jsonError("Could not load Workcard details.",500);
 const appointmentIds=[...new Set((jobs??[]).map(x=>x.appointment_id).filter(Boolean))];
 const {data:appointments}=appointmentIds.length?await db.from("appointments").select("id,status,starts_at,ends_at,preferred_start,location,customer_notes,vehicle_id,vehicles(make,model,year,vehicle_type,registration,vin)").eq("business_id",membership.business_id).in("id",appointmentIds):{data:[]};
 const appointmentById=new Map((appointments??[]).map(x=>[x.id,{...x,vehicles:firstRelation(x.vehicles)}]));
 const enquiryIds=[...new Set((jobs??[]).map(x=>firstRelation(firstRelation(x.quotes)?.enquiries)?.id).filter(Boolean))];
 const {data:jobcardFiles,error:jobcardFilesError}=enquiryIds.length?await db.from("enquiry_attachments").select("id,enquiry_id,file_name,mime_type,storage_path,created_at").in("enquiry_id",enquiryIds).order("created_at",{ascending:false}):{data:[],error:null};
 if(jobcardFilesError)return jsonError("Could not load original Jobcard attachments.",500);
 const filesByEnquiry=new Map<string,any[]>();
 for(const file of jobcardFiles??[]){
  const {data:signed}=await db.storage.from("brandon-rv-private").createSignedUrl(file.storage_path,300);
  const group=filesByEnquiry.get(file.enquiry_id)??[];group.push({...file,url:signed?.signedUrl??null});filesByEnquiry.set(file.enquiry_id,group);
 }
 const jobById=new Map((jobs??[]).map(x=>{
  const quote=firstRelation(x.quotes);
  const enquiry=firstRelation(quote?.enquiries);
  const normalizedEnquiry=enquiry?{...enquiry,vehicles:firstRelation(enquiry.vehicles)}:null;
  const normalizedQuote=quote?{...quote,enquiries:normalizedEnquiry}:null;
  return [x.id,{...x,quotes:normalizedQuote,booking:appointmentById.get(x.appointment_id)??null,jobcardAttachments:filesByEnquiry.get(normalizedEnquiry?.id??"")??[]}];
 }));
 const entriesByJob=new Map<string,any[]>();
 for(const entry of entries??[]){const group=entriesByJob.get(entry.job_id)??[];group.push(entry);entriesByJob.set(entry.job_id,group);}
 return Response.json({workcards:(assignments??[]).map(a=>({...a,job:jobById.get(a.job_id)??null,entries:entriesByJob.get(a.job_id)??[]})).filter(x=>x.job)});
}
