import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const access=await authorizePermission("enquiries.view");if(access.response)return access.response;
 const {id}=await params,db=database(),businessId=access.membership!.business_id;
 const {data:record}=await db.from("enquiries").select("id").eq("id",id).eq("business_id",businessId).maybeSingle();if(!record)return jsonError("Enquiry not found.",404);
 const [{data:staff},{data:assignments}]=await Promise.all([
  db.from("staff").select("id,full_name,email,job_title,employment_status").eq("business_id",businessId).eq("employment_status","active").order("full_name"),
  db.from("enquiry_assignments").select("staff_id,assigned_at").eq("enquiry_id",id).is("unassigned_at",null)
 ]);
 return Response.json({staff:staff??[],assignedStaff:(assignments??[]).map(x=>x.staff_id)});
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("enquiries.manage");if(access.response)return access.response;
 try{
  const {id}=await params,body=await request.json(),db=database(),businessId=access.membership!.business_id;
  const {data:record}=await db.from("enquiries").select("id").eq("id",id).eq("business_id",businessId).maybeSingle();if(!record)return jsonError("Enquiry not found.",404);
  const ids=Array.isArray(body.staffIds)?[...new Set(body.staffIds.map((x:unknown)=>String(x)))]:[];
  if(ids.length>20||ids.some((x:string)=>!/^[0-9a-f-]{36}$/i.test(x)))return jsonError("Select up to 20 valid staff members.");
  if(ids.length){const {data:staff}=await db.from("staff").select("id").eq("business_id",businessId).eq("employment_status","active").in("id",ids);if((staff??[]).length!==ids.length)return jsonError("One or more selected staff members are not active in this business.");}
  const {error:releaseError}=await db.from("enquiry_assignments").update({unassigned_at:new Date().toISOString()}).eq("enquiry_id",id).is("unassigned_at",null);
  if(releaseError)return jsonError("Could not update current assignments.",500);
  if(ids.length){const {error}=await db.from("enquiry_assignments").insert(ids.map((staff_id:string)=>({business_id:businessId,enquiry_id:id,staff_id,assigned_by:access.user!.id})));if(error)return jsonError("Could not save staff assignments.",500);}
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"enquiry.staff_assigned",entity_type:"enquiry",entity_id:id,details:{staff_ids:ids}});
  return Response.json({success:true});
 }catch{return jsonError("Could not assign staff.",500);}
}
