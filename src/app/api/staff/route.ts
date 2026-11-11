import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
import {isGlobalAdministrator} from "@/lib/user-role-policy.mjs";
export const runtime="nodejs";
const roleKeys=["ceo_founder","website_development_specialist","owner","website_developer"];
const staffRoleKeys=["trial_apprentice","apprentice","senior_apprentice","team_leader","supervisor","office_admin","office_supervisor","office_manager","manager","senior_manager","website_development_specialist","ceo_founder"];
const employmentTypes=["casual","part_time","full_time"];
const employmentStatuses=["active","leave","suspended","terminated"];
const payFrequencies=["hourly","weekly","fortnightly","monthly","annually"];
const isId=(value:string)=>/^[0-9a-f-]{36}$/i.test(value);
const isDate=(value:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+"T00:00:00Z");return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;};
export async function GET(){
 const access=await authorizePermission("staff.view");if(access.response)return access.response;
 const db=database(),businessId=access.membership!.business_id;
 const [{data:employees,error},{data:roles,error:roleError}]=await Promise.all([
  db.from("users").select("id,first_name,last_name,full_name,email,phone,status,user_role,employee_number,job_title,employment_type,employment_status,start_date,end_date,pay_rate,pay_frequency,payroll_reference,payroll_notes,emergency_contact_name,emergency_contact_phone,employee_internal_notes,custom_title,department,team_name,created_at").eq("business_id",businessId).not("user_role","is",null).neq("user_role","customer").order("full_name"),
  db.from("user_roles").select("role_key,name,description,is_system").order("name")
 ]);
 if(error||roleError)return jsonError("Could not load the employee directory.",500);
 const ids=(employees??[]).map(x=>x.id);
 const {data:customers,error:customerError}=ids.length?await db.from("customers").select("id,user_id").eq("business_id",businessId).in("user_id",ids):{data:[],error:null};
 if(customerError)return jsonError("Could not match staff to their customer profiles.",500);
 const customerByUser=new Map((customers??[]).map(x=>[x.user_id,x.id]));
 const directory=(employees??[]).filter(x=>customerByUser.has(x.id)).map(x=>({...x,customer_id:customerByUser.get(x.id)}));
 return Response.json({employees:directory,roles:(roles??[]).filter(x=>staffRoleKeys.includes(x.role_key)&&(isGlobalAdministrator(access.user?.user_role)||!roleKeys.includes(x.role_key))).sort((a,b)=>staffRoleKeys.indexOf(a.role_key)-staffRoleKeys.indexOf(b.role_key))});

}
export async function POST(){return jsonError("Staff access must be granted through a customer invitation.",410);}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("staff.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const userId=String(body.userId??"");if(!isId(userId))return jsonError("Invalid employee record.");
  const db=database(),businessId=access.membership!.business_id;
  const {data:employee}=await db.from("users").select("id,user_role,employment_status,start_date,end_date,updated_at").eq("id",userId).eq("business_id",businessId).not("user_role","is",null).neq("user_role","customer").maybeSingle();
  if(!employee)return jsonError("Employee record not found.",404);
  if(roleKeys.includes(String(employee.user_role))&&!isGlobalAdministrator(access.user?.user_role))return jsonError("Only an Owner or Website Developer can edit this account.",403);
  const updates:any={updated_at:new Date().toISOString()};\n  const managesAccess=body.roleKey!==undefined||body.additionalPermissions!==undefined||body.department!==undefined||body.teamName!==undefined;\n  if(managesAccess){const permissionAccess=await authorizePermission("roles.manage");if(permissionAccess.response)return permissionAccess.response;}
  if(body.employmentStatus!==undefined){const value=String(body.employmentStatus);if(!employmentStatuses.includes(value))return jsonError("Select a valid employment status.");updates.employment_status=value;}
  if(body.employmentType!==undefined){const value=String(body.employmentType);if(!employmentTypes.includes(value))return jsonError("Select a valid employment type.");updates.employment_type=value;}
  if(body.jobTitle!==undefined){const value=String(body.jobTitle).trim();if(value.length>100)return jsonError("Job title must be 100 characters or fewer.");updates.job_title=value||null;}
  if(body.customTitle!==undefined){const value=String(body.customTitle).trim();if(value.length>100)return jsonError("Custom title must be 100 characters or fewer.");updates.custom_title=value||null;}
  if(body.department!==undefined){const value=String(body.department).trim();if(value.length>100)return jsonError("Department must be 100 characters or fewer.");updates.department=value||null;}
  if(body.teamName!==undefined){const value=String(body.teamName).trim();if(value.length>100)return jsonError("Team name must be 100 characters or fewer.");updates.team_name=value||null;}
  if(body.roleKey!==undefined){const value=String(body.roleKey);const {data:role}=await db.from("user_roles").select("role_key").eq("role_key",value).maybeSingle();if(!role||value==="customer")return jsonError("Select a valid staff role.");updates.user_role=value;}
  if(body.employeeNumber!==undefined){const value=String(body.employeeNumber).trim();if(value.length>50)return jsonError("Employee number must be 50 characters or fewer.");updates.employee_number=value||null;}
  if(body.startDate!==undefined){const value=String(body.startDate);if(value&&!isDate(value))return jsonError("Enter a valid start date.");updates.start_date=value||null;}
  if(body.endDate!==undefined){const value=String(body.endDate);if(value&&!isDate(value))return jsonError("Enter a valid end date.");updates.end_date=value||null;}
  if(body.payRate!==undefined){if(body.payRate==="")updates.pay_rate=null;else{const value=Number(body.payRate);if(!Number.isFinite(value)||value<0||value>9999999999.99)return jsonError("Enter a valid pay rate up to 9,999,999,999.99.");updates.pay_rate=value;}}
  if(body.payFrequency!==undefined){const value=String(body.payFrequency);if(value&&!payFrequencies.includes(value))return jsonError("Select a valid pay frequency.");updates.pay_frequency=value||null;}
  for(const [key,column,limit] of [["payrollReference","payroll_reference",100],["payrollNotes","payroll_notes",5000],["emergencyContactName","emergency_contact_name",120],["emergencyContactPhone","emergency_contact_phone",40],["employeeInternalNotes","employee_internal_notes",5000]] as const){if(body[key]!==undefined){const value=String(body[key]).trim();if(value.length>limit)return jsonError("One or more employee details exceed the allowed length.");updates[column]=value||null;}}
  if(updates.employment_status==="terminated"&&!updates.end_date)updates.end_date=new Date().toISOString().slice(0,10);
  const effectiveStart=Object.prototype.hasOwnProperty.call(updates,"start_date")?updates.start_date:employee.start_date;const effectiveEnd=Object.prototype.hasOwnProperty.call(updates,"end_date")?updates.end_date:employee.end_date;if(effectiveStart&&effectiveEnd&&effectiveEnd<effectiveStart)return jsonError("Employment end date cannot be before the start date.");
  if(Object.keys(updates).length===1&&body.additionalPermissions===undefined)return jsonError("No employee changes supplied.");
  if(body.additionalPermissions!==undefined){
   if(!Array.isArray(body.additionalPermissions)||body.additionalPermissions.some((x:unknown)=>typeof x!=="string"))return jsonError("Additional permissions must be a list.");
   const requested=[...new Set(body.additionalPermissions as string[])];const {data:catalogue}=await db.from("permissions").select("permission_key").in("permission_key",requested);
   if((catalogue??[]).length!==requested.length)return jsonError("One or more additional permissions are invalid.");
   const reason=String(body.permissionReason??"").trim();if(!reason)return jsonError("A reason is required for additional permission grants.");
   const expiry=body.permissionExpiresAt?String(body.permissionExpiresAt):null;if(expiry&&Number.isNaN(Date.parse(expiry)))return jsonError("Enter a valid permission expiry date.");
   await db.from("user_permission_grants").update({revoked_at:new Date().toISOString(),revoked_by:access.user!.id}).eq("user_id",userId).is("revoked_at",null);
   if(requested.length){const {error:grantError}=await db.from("user_permission_grants").insert(requested.map(permission_key=>({user_id:userId,permission_key,granted_by:access.user!.id,reason,expires_at:expiry})));if(grantError)return jsonError("Could not save additional permissions.",500);}
  }
  const {data:updated,error}=await db.from("users").update(updates).eq("id",userId).eq("business_id",businessId).eq("updated_at",employee.updated_at).not("user_role","is",null).neq("user_role","customer").select("id").maybeSingle();if(error)return jsonError("Could not update employee details.",500);if(!updated)return jsonError("This employee record changed during the update. Refresh and try again.",409);
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"employee.updated",entity_type:"user",entity_id:userId,details:{...updates,additionalPermissions:body.additionalPermissions??undefined}});
  return Response.json({success:true});
 }catch{return jsonError("Could not update employee details.",500);}
}
