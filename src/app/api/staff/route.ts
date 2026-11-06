import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const access=await authorizePermission("staff.view");if(access.response)return access.response;
 const db=database();
 const [{data:staff,error},{data:roles}]=await Promise.all([
  db.from("staff").select("id,user_id,employee_number,job_title,employment_status,start_date,full_name,email,phone,account_status,created_at").eq("business_id",access.membership!.business_id).order("created_at",{ascending:false}),
  db.from("permission_groups").select("id,name,description,is_system").eq("business_id",access.membership!.business_id).order("name")
 ]);
 if(error)return jsonError("Could not load staff records.",500);
 const ids=(staff??[]).map(x=>x.user_id);
 const {data:members}=await (ids.length?db.from("business_members").select("user_id,role,is_active").eq("business_id",access.membership!.business_id).in("user_id",ids):Promise.resolve({data:[]}));
 const memberMap=new Map((members??[]).map(x=>[x.user_id,x]));
 const roleNames=new Map((roles??[]).map(x=>[String(x.name).toLowerCase(),String(x.name)]));
 const visibleRoles=roles??[];
 return Response.json({
  staff:(staff??[]).map(x=>{
   const member=memberMap.get(x.user_id)??null;
   const canonicalRole=member?.role?roleNames.get(String(member.role).toLowerCase())??String(member.role):null;
   return {...x,user:{id:x.user_id,email:x.email,full_name:x.full_name,phone:x.phone,status:x.account_status},membership:member?{...member,role:canonicalRole}:null};
  }),
  roles:visibleRoles,canAssignDeveloper:["owner","developer"].includes(access.membership!.role.toLowerCase())
 });
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("staff.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const staffId=String(body.staffId??"");const role=body.role===undefined?undefined:String(body.role);const employmentStatus=body.employmentStatus===undefined?undefined:String(body.employmentStatus);
  if(!/^[0-9a-f-]{36}$/i.test(staffId))return jsonError("Invalid staff record.");
  const statuses=["active","on_leave","inactive","terminated"];if(employmentStatus!==undefined&&!statuses.includes(employmentStatus))return jsonError("Invalid employment status.");
  if(role===undefined&&employmentStatus===undefined)return jsonError("No changes supplied.");
  const db=database();const {data:staff}=await db.from("staff").select("id,user_id").eq("id",staffId).eq("business_id",access.membership!.business_id).maybeSingle();if(!staff)return jsonError("Staff record not found.",404);
  if(role!==undefined){
   const {data:group}=await db.from("permission_groups").select("name").eq("business_id",access.membership!.business_id).ilike("name",role).maybeSingle();
   if(!group||group.name.toLowerCase()==="owner")return jsonError("Select a configured staff role.");
   if(group.name.toLowerCase()==="developer"&& !["owner","developer"].includes(access.membership!.role.toLowerCase()))return jsonError("Only the owner or an existing developer can assign developer access.",403);
   const {data:updated,error}=await db.from("business_members").update({role:group.name}).eq("business_id",access.membership!.business_id).eq("user_id",staff.user_id).select("id").maybeSingle();
   if(error||!updated)return jsonError("Could not update the staff role.",500);
  }
  if(employmentStatus!==undefined){
   const {error}=await db.from("staff").update({employment_status:employmentStatus,updated_at:new Date().toISOString()}).eq("id",staffId);if(error)return jsonError("Could not update employment status.",500);
   const active=["active","on_leave"].includes(employmentStatus);
   const {error:memberError}=await db.from("business_members").update({is_active:active}).eq("business_id",access.membership!.business_id).eq("user_id",staff.user_id);
   if(memberError)return jsonError("Employment status was saved, but account access could not be updated.",500);
   if(!active){const {error:sessionError}=await db.from("user_sessions").delete().eq("user_id",staff.user_id);if(sessionError)return jsonError("Employment status was saved, but active sessions could not be revoked.",500);}
  }
  await db.from("audit_events").insert({business_id:access.membership!.business_id,actor_user_id:access.user!.id,action:"staff.updated",entity_type:"staff",entity_id:staffId,details:{role:role??null,employment_status:employmentStatus??null}});
  return Response.json({success:true});
 }catch{return jsonError("Could not update staff record.",500);}
}
