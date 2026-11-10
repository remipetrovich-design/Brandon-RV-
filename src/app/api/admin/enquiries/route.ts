import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
const types=["public_enquiry","general_enquiry","customer_enquiry","quote_request"];
const stages=["new","contacted","awaiting_information","assessment_required","quote_in_progress","quote_sent","awaiting_approval","approved","declined","converted","closed"];
const legacyStatus=(stage:string)=>stage==="contacted"||stage==="awaiting_information"||stage==="assessment_required"||stage==="quote_in_progress"?"reviewing":stage==="quote_sent"||stage==="awaiting_approval"?"quoted":stage==="approved"?"accepted":stage==="declined"?"declined":stage==="converted"?"converted":stage==="closed"?"closed":"new";
const reference=()=> "BRV-ENQ-"+new Date().toISOString().slice(2,10).replaceAll("-","")+"-"+crypto.randomUUID().slice(0,6).toUpperCase();
export async function GET(request:Request){
 const access=await authorizePermission("enquiries.view");if(access.response)return access.response;
 const db=database(),businessId=access.membership!.business_id,url=new URL(request.url);
 const type=url.searchParams.get("type")??"all",stage=url.searchParams.get("stage")??"all",search=(url.searchParams.get("q")??"").replace(/[^a-zA-Z0-9@._+ -]/g,"").trim().slice(0,120);
 let query=db.from("enquiries").select("id,request_number,request_type,contact_name,email,phone,location,vehicle_description,requested_service,description,preferred_contact,status,stage,source,internal_notes,created_at,updated_at,customer_id,user_id").eq("business_id",businessId).order("created_at",{ascending:false}).limit(250);
 if(type==="general")query=query.in("request_type",["public_enquiry","general_enquiry"]);
 else if(types.includes(type))query=query.eq("request_type",type);
 if(stage==="archived")query=query.not("archived_at","is",null);
 else {query=query.is("archived_at",null);if(stages.includes(stage))query=query.eq("stage",stage);}
 if(search)query=query.or("request_number.ilike.%"+search+"%,contact_name.ilike.%"+search+"%,email.ilike.%"+search+"%,phone.ilike.%"+search+"%,requested_service.ilike.%"+search+"%");
 const {data,error}=await query;if(error)return jsonError("Could not load enquiry records.",500);
 const ids=(data??[]).map(x=>x.id);
 const [{data:assignments},{data:staffRecords}]=await Promise.all([
  ids.length?db.from("enquiry_assignments").select("enquiry_id,staff_id,assigned_at").in("enquiry_id",ids).is("unassigned_at",null):Promise.resolve({data:[]}),
  db.from("staff").select("id,full_name,email,job_title,employment_status").eq("business_id",businessId).order("full_name")
 ]);
 const activeStaff=(staffRecords??[]).filter(x=>x.employment_status==="active");
 const staffById=new Map((staffRecords??[]).map(x=>[x.id,x]));
 const assignmentsByEnquiry=new Map<string,{id:string;full_name:string;job_title:string|null;assigned_at:string}[]>();
 for(const assignment of assignments??[]){
  const staff=staffById.get(assignment.staff_id);if(!staff)continue;
  const list=assignmentsByEnquiry.get(assignment.enquiry_id)??[];
  list.push({...staff,assigned_at:assignment.assigned_at});assignmentsByEnquiry.set(assignment.enquiry_id,list);
 }
 const rows=(data??[]).map(row=>({...row,assigned_staff:assignmentsByEnquiry.get(row.id)??[]}));
 return Response.json({enquiries:rows,staff:activeStaff??[],stages,types});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("enquiries.manage");if(access.response)return access.response;
 try{
  const body=await request.json(),type=String(body.request_type??"general_enquiry"),stage=String(body.stage??"new");
  const contactName=String(body.contact_name??"").trim(),email=String(body.email??"").trim().toLowerCase(),phone=String(body.phone??"").trim(),description=String(body.description??"").trim();
  if(!types.includes(type))return jsonError("Select a valid enquiry type.");
  if(!stages.includes(stage))return jsonError("Select a valid stage.");
  if(contactName.length<2||contactName.length>120||!/^\S+@\S+\.\S+$/.test(email)||email.length>254)return jsonError("Enter a valid contact name and email address.");
  if(phone.length>40||description.length<3||description.length>5000)return jsonError("Enter a phone number under 40 characters and a description between 3 and 5,000 characters.");
  const staffIds=Array.isArray(body.staff_ids)?[...new Set<string>(body.staff_ids.map((x:unknown)=>String(x)))]:[];
  if(staffIds.length>20||staffIds.some((id:string)=>!/^[0-9a-f-]{36}$/i.test(id)))return jsonError("Invalid staff selection.");
  const db=database(),businessId=access.membership!.business_id;
  if(staffIds.length){const {data:staff}=await db.from("staff").select("id").eq("business_id",businessId).eq("employment_status","active").in("id",staffIds);if((staff??[]).length!==staffIds.length)return jsonError("One or more selected staff are not active in this business.");}
  const {data:record,error}=await db.from("enquiries").insert({
   business_id:businessId,request_type:type,request_number:reference(),contact_name:contactName,email,phone:phone||null,
   location:String(body.location??"").trim().slice(0,200)||null,vehicle_description:String(body.vehicle_description??"").trim().slice(0,300)||null,
   requested_service:String(body.requested_service??"").trim().slice(0,200)||null,description,
   preferred_contact:["email","phone","sms"].includes(String(body.preferred_contact))?String(body.preferred_contact):"email",
   source:"admin",status:legacyStatus(stage),stage,internal_notes:String(body.internal_notes??"").trim().slice(0,5000)||null
  }).select("id,request_number,request_type,stage").single();
  if(error||!record)return jsonError("Could not create the enquiry record.",500);
  if(staffIds.length){const {error:assignError}=await db.from("enquiry_assignments").insert(staffIds.map((staff_id:string)=>({business_id:businessId,enquiry_id:record.id,staff_id,assigned_by:access.user!.id})));if(assignError){await db.from("enquiries").delete().eq("id",record.id).eq("business_id",businessId);return jsonError("Could not assign staff. The enquiry was not saved.",500);}}
  await db.from("enquiry_stage_history").insert({business_id:businessId,enquiry_id:record.id,to_stage:stage,changed_by:access.user!.id,note:"Record created in admin."});
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"enquiry.created_in_admin",entity_type:"enquiry",entity_id:record.id,details:{request_type:type,stage,staff_ids:staffIds}});
  return Response.json({enquiry:record},{status:201});
 }catch{return jsonError("Could not create the enquiry record.",500);}
}
