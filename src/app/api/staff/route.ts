import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const access=await authorizePermission("staff.view");if(access.response)return access.response;
 const db=database();const {data:staff,error}=await db.from("staff").select("id,user_id,employee_number,job_title,employment_status,start_date").eq("business_id",access.membership!.business_id).order("created_at",{ascending:false});
 if(error)return jsonError("Could not load staff records.",500);
 const ids=(staff??[]).map(x=>x.user_id);
 const [{data:users},{data:members}]=await Promise.all([
  ids.length?db.from("users").select("id,email,full_name,phone,status,last_login_at").in("id",ids):Promise.resolve({data:[]}),
  ids.length?db.from("business_members").select("user_id,role,is_active").eq("business_id",access.membership!.business_id).in("user_id",ids):Promise.resolve({data:[]})
 ]);
 const userMap=new Map((users??[]).map(x=>[x.id,x]));const memberMap=new Map((members??[]).map(x=>[x.user_id,x]));
 return Response.json({staff:(staff??[]).map(x=>({...x,user:userMap.get(x.user_id)??null,membership:memberMap.get(x.user_id)??null}))});
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("staff.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const staffId=String(body.staffId??"");const role=body.role===undefined?undefined:String(body.role);const employmentStatus=body.employmentStatus===undefined?undefined:String(body.employmentStatus);
  if(!/^[0-9a-f-]{36}$/i.test(staffId))return jsonError("Invalid staff record.");
  const roles=["administrator","manager","technician","office","accounts"];
  const statuses=["active","on_leave","inactive","terminated"];
  if(role!==undefined&&!roles.includes(role))return jsonError("Invalid staff role.");
  if(employmentStatus!==undefined&&!statuses.includes(employmentStatus))return jsonError("Invalid employment status.");
  if(role===undefined&&employmentStatus===undefined)return jsonError("No changes supplied.");
  const db=database();const {data:staff}=await db.from("staff").select("id,user_id").eq("id",staffId).eq("business_id",access.membership!.business_id).maybeSingle();
  if(!staff)return jsonError("Staff record not found.",404);
  if(employmentStatus!==undefined){
   const {error}=await db.from("staff").update({employment_status:employmentStatus,updated_at:new Date().toISOString()}).eq("id",staffId);
   if(error)return jsonError("Could not update employment status.",500);
   const active=["active","on_leave"].includes(employmentStatus);
   await db.from("business_members").update({is_active:active}).eq("business_id",access.membership!.business_id).eq("user_id",staff.user_id);
   await db.from("users").update({status:active?"active":"suspended",updated_at:new Date().toISOString()}).eq("id",staff.user_id);
   if(!active)await db.from("user_sessions").delete().eq("user_id",staff.user_id);
  }
  if(role!==undefined)await db.from("business_members").update({role}).eq("business_id",access.membership!.business_id).eq("user_id",staff.user_id);
  await db.from("audit_events").insert({business_id:access.membership!.business_id,actor_user_id:access.user!.id,action:"staff.updated",entity_type:"staff",entity_id:staffId,details:{role:role??null,employment_status:employmentStatus??null}});
  return Response.json({success:true});
 }catch{return jsonError("Could not update staff record.",500);}
}