import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
const stages=["new","contacted","awaiting_information","assessment_required","quote_in_progress","quote_sent","awaiting_approval","approved","declined","converted","closed"];
const legacyStatus=(stage:string)=>stage==="contacted"||stage==="awaiting_information"||stage==="assessment_required"||stage==="quote_in_progress"?"reviewing":stage==="quote_sent"||stage==="awaiting_approval"?"quoted":stage==="approved"?"accepted":stage==="declined"?"declined":stage==="converted"?"converted":stage==="closed"?"closed":"new";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const access=await authorizePermission("enquiries.view");if(access.response)return access.response;
 const {id}=await params,db=database(),businessId=access.membership!.business_id;
 const {data:enquiry,error}=await db.from("enquiries").select("*").eq("id",id).eq("business_id",businessId).maybeSingle();
 if(error||!enquiry)return jsonError("Enquiry not found.",404);
 const [{data:assignments},{data:history},{data:attachments}]=await Promise.all([
  db.from("enquiry_assignments").select("id,staff_id,assigned_by,assigned_at").eq("enquiry_id",id).is("unassigned_at",null),
  db.from("enquiry_stage_history").select("id,from_stage,to_stage,note,changed_by,created_at").eq("enquiry_id",id).order("created_at",{ascending:false}).limit(50),
  db.from("enquiry_attachments").select("id,file_name,mime_type,size_bytes,storage_path,created_at").eq("enquiry_id",id).order("created_at",{ascending:false})
 ]);
 const staffIds=[...new Set((assignments??[]).map(x=>x.staff_id))];
 const [{data:staff},{data:staffUsers}]=await Promise.all([
  staffIds.length?db.from("staff").select("id,full_name,email,job_title").eq("business_id",businessId).in("id",staffIds):Promise.resolve({data:[]}),
  db.from("staff").select("id,full_name,email,job_title").eq("business_id",businessId).eq("employment_status","active").order("full_name")
 ]);
 const staffById=new Map((staff??[]).map(x=>[x.id,x]));
 const assigned=(assignments??[]).map(x=>({...x,staff:staffById.get(x.staff_id)}));
 const files=await Promise.all((attachments??[]).map(async file=>{const {data}=await db.storage.from("brandon-rv-private").createSignedUrl(file.storage_path,300);return {id:file.id,file_name:file.file_name,mime_type:file.mime_type,size_bytes:file.size_bytes,created_at:file.created_at,url:data?.signedUrl??null};}));
 return Response.json({enquiry,assignments:assigned,staff:staffUsers??[],history:history??[],attachments:files});
}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("enquiries.manage");if(access.response)return access.response;
 try{
  const {id}=await params,body=await request.json(),db=database(),businessId=access.membership!.business_id;
  const {data:before}=await db.from("enquiries").select("id,stage,request_type,archived_at").eq("id",id).eq("business_id",businessId).maybeSingle();
  if(!before)return jsonError("Enquiry not found.",404);
  const allowed=["contact_name","email","phone","location","vehicle_description","requested_service","description","preferred_contact","internal_notes","stage"];
  const update:any={};
  for(const key of allowed){if(body[key]===undefined)continue;const value=body[key];
   if(key==="request_type"){if(!types.includes(String(value)))return jsonError("Select a valid enquiry type.");update.request_type=String(value);}
   else if(key==="stage"){if(!stages.includes(String(value)))return jsonError("Select a valid stage.");update.stage=String(value);}
   else if(key==="email"){const v=String(value).trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(v)||v.length>254)return jsonError("Enter a valid email address.");update.email=v;}
   else if(key==="contact_name"){const v=String(value).trim();if(v.length<2||v.length>120)return jsonError("Enter a contact name between 2 and 120 characters.");update.contact_name=v;}
   else if(key==="description"){const v=String(value).trim();if(v.length<3||v.length>5000)return jsonError("Description must be between 3 and 5,000 characters.");update.description=v;}
   else if(key==="preferred_contact"){const v=String(value);if(!["email","phone","sms"].includes(v))return jsonError("Select a valid preferred contact method.");update.preferred_contact=v;}
   else if(typeof value==="string")update[key]=value.trim().slice(0,key==="internal_notes"?5000:500)||null;
  }
  if(!Object.keys(update).length)return jsonError("No changes supplied.");
  if(update.stage){
   update.status=legacyStatus(update.stage);
   if(["closed","declined"].includes(update.stage)){
    update.archived_at=before.archived_at??new Date().toISOString();
    update.guest_access_token_hash=null;
    update.guest_access_expires_at=new Date().toISOString();
   }else if(before.archived_at){update.archived_at=null;}
  }
  update.updated_at=new Date().toISOString();
  const {error}=await db.from("enquiries").update(update).eq("id",id).eq("business_id",businessId);
  if(error)return jsonError("Could not save enquiry changes.",500);
  if(update.stage&&update.stage!==before.stage){await db.from("enquiry_stage_history").insert({business_id:businessId,enquiry_id:id,from_stage:before.stage,to_stage:update.stage,changed_by:access.user!.id,note:String(body.stage_note??"").trim().slice(0,1000)||null});}
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"enquiry.updated",entity_type:"enquiry",entity_id:id,details:update});
  return Response.json({success:true});
 }catch{return jsonError("Could not update enquiry.",500);}
}
