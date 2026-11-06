import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";

const employmentTypes=["casual","part_time","full_time","contractor","temporary"];

export async function GET(){
 const access=await authorizePermission("staff.view");if(access.response)return access.response;
 const db=database();
 const [{data:staff,error},{data:roles,error:rolesError},{data:customers,error:customersError}]=await Promise.all([
  db.from("staff").select("id,user_id,employee_number,job_title,employment_type,employment_status,start_date,full_name,email,phone,account_status,created_at").eq("business_id",access.membership!.business_id).order("created_at",{ascending:false}),
  db.from("permission_groups").select("id,name,description,is_system").eq("business_id",access.membership!.business_id).order("name"),
  db.from("customers").select("id,user_id,full_name,email,phone,status").eq("business_id",access.membership!.business_id).eq("status","active").order("full_name")
 ]);
 if(error||rolesError||customersError)return jsonError("Could not load staff records.",500);
 const ids=(staff??[]).map(x=>x.user_id);
 const {data:members}=await (ids.length?db.from("business_members").select("user_id,role,is_active").eq("business_id",access.membership!.business_id).in("user_id",ids):Promise.resolve({data:[]}));
 const memberMap=new Map((members??[]).map(x=>[x.user_id,x]));
 const roleNames=new Map((roles??[]).map(x=>[String(x.name).toLowerCase(),String(x.name)]));
 const visibleRoles=(roles??[]).filter((role:any)=>!role.is_system||["apprentice","worker","senior worker","supervisor","manager","owner","website developer"].includes(String(role.name).toLowerCase()));
 const existingStaff=new Set(ids);
 return Response.json({
  staff:(staff??[]).map(x=>{
   const member=memberMap.get(x.user_id)??null;
   const canonicalRole=member?.role?roleNames.get(String(member.role).toLowerCase())??String(member.role):null;
   return {...x,user:{id:x.user_id,email:x.email,full_name:x.full_name,phone:x.phone,status:x.account_status},membership:member?{...member,role:canonicalRole}:null};
  }),
  availableCustomers:(customers??[]).filter((customer:any)=>!existingStaff.has(customer.user_id??customer.id)),
  roles:visibleRoles,
  canAssignDeveloper:["owner","developer","website developer"].includes(access.membership!.role.toLowerCase())
 });
}

export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("staff.manage");if(access.response)return access.response;
 try{
  const body=await request.json();
  const customerId=String(body.customerId??"");
  const role=String(body.role??"").trim();
  const jobTitle=String(body.jobTitle??"").trim();
  const employmentType=String(body.employmentType??"full_time");
  if(!/^[0-9a-f-]{36}$/i.test(customerId))return jsonError("Select an existing customer account.");
  if(!role)return jsonError("Select a staff usergroup.");
  if(!jobTitle||jobTitle.length>100)return jsonError("Enter a staff title of 1 to 100 characters.");
  if(!employmentTypes.includes(employmentType))return jsonError("Select a valid employment type.");
  const db=database(),businessId=access.membership!.business_id;
  const {data:group}=await db.from("permission_groups").select("name").eq("business_id",businessId).ilike("name",role).maybeSingle();
  if(!group||group.name.toLowerCase()==="owner")return jsonError("Select a configured staff usergroup.");
  if(["developer","website developer"].includes(group.name.toLowerCase())&&!["owner","developer","website developer"].includes(access.membership!.role.toLowerCase()))return jsonError("Only the owner or an existing website developer can assign website developer access.",403);
  const {data:customer,error:customerError}=await db.from("customers").select("id,user_id").eq("id",customerId).eq("business_id",businessId).eq("status","active").maybeSingle();
  if(customerError||!customer)return jsonError("Only an existing active customer can be assigned employee access.",404);
  const userId=customer.user_id??customer.id;
  const {data:user}=await db.from("users").select("id,primary_group,secondary_group").eq("id",userId).maybeSingle();
  if(!user||user.primary_group!=="customer")return jsonError("The selected customer account could not be verified.",409);
  const {data:existingMembership}=await db.from("business_members").select("id,is_active").eq("business_id",businessId).eq("user_id",userId).maybeSingle();
  if(existingMembership?.is_active)return jsonError("This customer already has active employee access.",409);
  let memberId=existingMembership?.id??null;
  if(existingMembership){
   const {error}=await db.from("business_members").update({role:group.name,is_active:true,joined_at:new Date().toISOString()}).eq("id",memberId);
   if(error)return jsonError("Could not activate employee access.",500);
  }else{
   const {data:member,error}=await db.from("business_members").insert({business_id:businessId,user_id:userId,role:group.name,is_active:true,joined_at:new Date().toISOString()}).select("id").single();
   if(error||!member)return jsonError("Could not create employee access.",500);
   memberId=member.id;
  }
  const {data:existingStaff}=await db.from("staff").select("id").eq("business_id",businessId).eq("user_id",userId).maybeSingle();
  const staffValues={job_title:jobTitle,employment_type:employmentType,employment_status:"active",start_date:new Date().toISOString().slice(0,10)};
  const staffResult=existingStaff
   ?await db.from("staff").update({...staffValues,updated_at:new Date().toISOString()}).eq("id",existingStaff.id).select("id").maybeSingle()
   :await db.from("staff").insert({business_id:businessId,user_id:userId,...staffValues}).select("id").single();
  if(staffResult.error||!staffResult.data){
   if(existingMembership)await db.from("business_members").update({is_active:false}).eq("id",memberId);
   else await db.from("business_members").delete().eq("id",memberId);
   return jsonError("Could not finish setting up employee access.",500);
  }
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"staff.assigned_from_customer",entity_type:"staff",entity_id:staffResult.data.id,details:{customer_id:customerId,role:group.name,job_title:jobTitle,employment_type:employmentType}});
  return Response.json({success:true,staffId:staffResult.data.id,userId},{status:201});
 }catch{return jsonError("Could not assign employee access.",500);}
}

export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("staff.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const staffId=String(body.staffId??"");const role=body.role===undefined?undefined:String(body.role);const employmentStatus=body.employmentStatus===undefined?undefined:String(body.employmentStatus);const employmentType=body.employmentType===undefined?undefined:String(body.employmentType);const jobTitle=body.jobTitle===undefined?undefined:String(body.jobTitle).trim();
  if(!/^[0-9a-f-]{36}$/i.test(staffId))return jsonError("Invalid staff record.");
  const statuses=["active","leave","suspended","terminated"];
  if(employmentStatus!==undefined&&!statuses.includes(employmentStatus))return jsonError("Invalid employment status.");
  if(employmentType!==undefined&&!employmentTypes.includes(employmentType))return jsonError("Invalid employment type.");
  if(jobTitle!==undefined&&jobTitle.length>100)return jsonError("Staff title must be 100 characters or fewer.");
  if(role===undefined&&employmentStatus===undefined&&employmentType===undefined&&jobTitle===undefined)return jsonError("No changes supplied.");
  const db=database();const {data:staff}=await db.from("staff").select("id,user_id").eq("id",staffId).eq("business_id",access.membership!.business_id).maybeSingle();if(!staff)return jsonError("Staff record not found.",404);
  if(role!==undefined){
   const {data:group}=await db.from("permission_groups").select("name").eq("business_id",access.membership!.business_id).ilike("name",role).maybeSingle();
   if(!group||group.name.toLowerCase()==="owner")return jsonError("Select a configured staff usergroup.");
   if(["developer","website developer"].includes(group.name.toLowerCase())&& !["owner","developer","website developer"].includes(access.membership!.role.toLowerCase()))return jsonError("Only the owner or an existing website developer can assign website developer access.",403);
   const {data:updated,error}=await db.from("business_members").update({role:group.name}).eq("business_id",access.membership!.business_id).eq("user_id",staff.user_id).select("id").maybeSingle();
   if(error||!updated)return jsonError("Could not update the staff role.",500);
  }
  if(employmentStatus!==undefined||employmentType!==undefined||jobTitle!==undefined){
   const updates:any={updated_at:new Date().toISOString()};
   if(employmentStatus!==undefined)updates.employment_status=employmentStatus;
   if(employmentType!==undefined)updates.employment_type=employmentType;
   if(jobTitle!==undefined)updates.job_title=jobTitle||null;
   if(employmentStatus!==undefined)updates.secondary_group=employmentStatus==="terminated"?null:"staff";
   const {error:profileError}=await db.from("users").update(updates).eq("id",staff.user_id);
   if(profileError)return jsonError("Could not update staff profile.",500);
   if(employmentStatus!==undefined){
    const active=employmentStatus==="active";
    const {error:memberError}=await db.from("business_members").update({is_active:active}).eq("business_id",access.membership!.business_id).eq("user_id",staff.user_id);
    if(memberError)return jsonError("Staff status was saved, but business access could not be updated.",500);
   }
  }
  await db.from("audit_events").insert({business_id:access.membership!.business_id,actor_user_id:access.user!.id,action:"staff.updated",entity_type:"staff",entity_id:staffId,details:{role:role??null,job_title:jobTitle??null,employment_type:employmentType??null,employment_status:employmentStatus??null}});
  return Response.json({success:true});
 }catch{return jsonError("Could not update staff record.",500);}
}
