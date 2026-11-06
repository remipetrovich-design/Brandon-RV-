import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
import {isGlobalAdministrator,isHireableCustomer} from "@/lib/user-role-policy.mjs";
export const runtime="nodejs";
const roleKeys=["owner","website_developer"];
const employmentTypes=["casual","part_time","full_time"];
const employmentStatuses=["active","leave","suspended","terminated"];
const payFrequencies=["hourly","weekly","fortnightly","monthly","annually"];
const isId=(value:string)=>/^[0-9a-f-]{36}$/i.test(value);
const isDate=(value:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+"T00:00:00Z");return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;};
export async function GET(){
 const access=await authorizePermission("staff.view");if(access.response)return access.response;
 const db=database(),businessId=access.membership!.business_id;
 const [{data:employees,error},{data:roles, error:roleError},{data:customers,error:customerError}]=await Promise.all([
  db.from("users").select("id,first_name,last_name,full_name,email,phone,status,user_role,employee_number,job_title,employment_type,employment_status,start_date,end_date,pay_rate,pay_frequency,payroll_reference,payroll_notes,emergency_contact_name,emergency_contact_phone,employee_internal_notes,created_at").eq("business_id",businessId).not("employment_status","is",null).order("created_at",{ascending:false}),
  db.from("user_roles").select("role_key,name,description,is_system").order("name"),
  db.from("users").select("id,first_name,last_name,full_name,email,phone").eq("business_id",businessId).eq("status","active").is("user_role",null).or("employment_status.is.null,employment_status.eq.terminated").order("full_name")
 ]);
 if(error||roleError||customerError)return jsonError("Could not load the employee directory.",500);
 return Response.json({employees:employees??[],roles:(roles??[]).filter(x=>x.role_key!=="customer"&&(isGlobalAdministrator(access.user?.user_role)||!roleKeys.includes(x.role_key))),customers:customers??[]});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("staff.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const userId=String(body.userId??"");const userRole=String(body.userRole??"");const jobTitle=String(body.jobTitle??"").trim();const employmentType=String(body.employmentType??"full_time");const startDate=body.startDate?String(body.startDate):new Date().toISOString().slice(0,10);
  if(!isId(userId))return jsonError("Select an existing customer account.");
  if(!jobTitle||jobTitle.length>100)return jsonError("Enter a job title of 1 to 100 characters.");
  if(!employmentTypes.includes(employmentType))return jsonError("Select a valid employment type.");
  if(!isDate(startDate))return jsonError("Enter a valid employment start date.");
  if(!userRole)return jsonError("Select a user role for this employee.");
  const db=database(),businessId=access.membership!.business_id;
  const {data:role}=await db.from("user_roles").select("role_key").eq("role_key",userRole).maybeSingle();
  if(!role)return jsonError("Select a valid user role.");
  if(roleKeys.includes(userRole)&&!isGlobalAdministrator(access.user?.user_role))return jsonError("Only an Owner or Website Developer can assign this role.",403);
  const {data:customer}=await db.from("users").select("id,primary_group,status,user_role,employment_status,business_id,job_title,employee_number,employment_type,start_date,end_date,pay_rate,pay_frequency,payroll_reference,payroll_notes,emergency_contact_name,emergency_contact_phone,employee_internal_notes").eq("id",userId).eq("business_id",businessId).eq("primary_group","customer").eq("status","active").maybeSingle();
  if(!customer)return jsonError("Customer account not found.",404);
  if(!isHireableCustomer(customer))return jsonError("This customer already has an active employee record or is not eligible to be hired.",409);
  const updates:any={user_role:userRole,employment_status:"active",employment_type:employmentType,job_title:jobTitle,start_date:startDate,end_date:null,updated_at:new Date().toISOString()};
  if(body.employeeNumber!==undefined){const value=String(body.employeeNumber).trim();if(value.length>50)return jsonError("Employee number must be 50 characters or fewer.");updates.employee_number=value||null;}
  if(body.payRate!==undefined&&body.payRate!==""){const n=Number(body.payRate);if(!Number.isFinite(n)||n<0||n>9999999999.99)return jsonError("Enter a valid pay rate up to 9,999,999,999.99.");updates.pay_rate=n;}
  if(body.payFrequency!==undefined&&body.payFrequency!==""){if(!payFrequencies.includes(String(body.payFrequency)))return jsonError("Select a valid pay frequency.");updates.pay_frequency=String(body.payFrequency);}
  for(const [key,limit] of [["payrollReference",100],["payrollNotes",5000],["emergencyContactName",120],["emergencyContactPhone",40],["employeeInternalNotes",5000]] as const){if(body[key]!==undefined){const value=String(body[key]).trim();if(value.length>limit)return jsonError("One or more employee details exceed the allowed length.");updates[{payrollReference:"payroll_reference",payrollNotes:"payroll_notes",emergencyContactName:"emergency_contact_name",emergencyContactPhone:"emergency_contact_phone",employeeInternalNotes:"employee_internal_notes"}[key]]=value||null;}}
  const {data:updated,error}=await db.from("users").update(updates).eq("id",userId).eq("business_id",businessId).eq("primary_group","customer").eq("status","active").is("user_role",null).or("employment_status.is.null,employment_status.eq.terminated").select("id").maybeSingle();
  if(error)return jsonError("Could not activate the employee record.",500);
  if(!updated)return jsonError("This customer was changed by another request. Refresh the employee list and try again.",409);
  const wasRehire=customer.employment_status==="terminated";
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:wasRehire?"employee.rehired":"employee.activated",entity_type:"user",entity_id:userId,details:{previous_employment:wasRehire?{job_title:customer.job_title,employee_number:customer.employee_number,employment_type:customer.employment_type,start_date:customer.start_date,end_date:customer.end_date,pay_rate:customer.pay_rate,pay_frequency:customer.pay_frequency,payroll_reference:customer.payroll_reference,payroll_notes:customer.payroll_notes,emergency_contact_name:customer.emergency_contact_name,emergency_contact_phone:customer.emergency_contact_phone,employee_internal_notes:customer.employee_internal_notes}:null,new_employment:{user_role:userRole,job_title:jobTitle,employment_type:employmentType,start_date:startDate}}});
  return Response.json({success:true},{status:201});
 }catch{return jsonError("Could not activate the employee record.",500);}
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("staff.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const userId=String(body.userId??"");if(!isId(userId))return jsonError("Invalid employee record.");
  const db=database(),businessId=access.membership!.business_id;
  const {data:employee}=await db.from("users").select("id,user_role,employment_status,start_date,end_date,updated_at").eq("id",userId).eq("business_id",businessId).not("employment_status","is",null).maybeSingle();
  if(!employee)return jsonError("Employee record not found.",404);
  if(roleKeys.includes(String(employee.user_role))&&!isGlobalAdministrator(access.user?.user_role))return jsonError("Only an Owner or Website Developer can edit this account.",403);
  const updates:any={updated_at:new Date().toISOString()};
  if(body.userRole!==undefined){const roleKey=String(body.userRole);if(roleKey){const {data:role}=await db.from("user_roles").select("role_key").eq("role_key",roleKey).maybeSingle();if(!role)return jsonError("Select a valid user role.");if(roleKeys.includes(roleKey)&&!isGlobalAdministrator(access.user?.user_role))return jsonError("Only an Owner or Website Developer can assign this role.",403);updates.user_role=roleKey;}else updates.user_role=null;}
  if(body.employmentStatus!==undefined){const value=String(body.employmentStatus);if(!employmentStatuses.includes(value))return jsonError("Select a valid employment status.");if(roleKeys.includes(String(employee.user_role))&&value==="terminated")return jsonError("Owner and Website Developer access cannot be terminated here.",403);updates.employment_status=value;if(value==="terminated")updates.user_role=null;}
  if(body.employmentType!==undefined){const value=String(body.employmentType);if(!employmentTypes.includes(value))return jsonError("Select a valid employment type.");updates.employment_type=value;}
  if(body.jobTitle!==undefined){const value=String(body.jobTitle).trim();if(value.length>100)return jsonError("Job title must be 100 characters or fewer.");updates.job_title=value||null;}
  if(body.employeeNumber!==undefined){const value=String(body.employeeNumber).trim();if(value.length>50)return jsonError("Employee number must be 50 characters or fewer.");updates.employee_number=value||null;}
  if(body.startDate!==undefined){const value=String(body.startDate);if(value&&!isDate(value))return jsonError("Enter a valid start date.");updates.start_date=value||null;}
  if(body.endDate!==undefined){const value=String(body.endDate);if(value&&!isDate(value))return jsonError("Enter a valid end date.");updates.end_date=value||null;}
  if(body.payRate!==undefined){if(body.payRate==="")updates.pay_rate=null;else{const value=Number(body.payRate);if(!Number.isFinite(value)||value<0||value>9999999999.99)return jsonError("Enter a valid pay rate up to 9,999,999,999.99.");updates.pay_rate=value;}}
  if(body.payFrequency!==undefined){const value=String(body.payFrequency);if(value&&!payFrequencies.includes(value))return jsonError("Select a valid pay frequency.");updates.pay_frequency=value||null;}
  for(const [key,column,limit] of [["payrollReference","payroll_reference",100],["payrollNotes","payroll_notes",5000],["emergencyContactName","emergency_contact_name",120],["emergencyContactPhone","emergency_contact_phone",40],["employeeInternalNotes","employee_internal_notes",5000]] as const){if(body[key]!==undefined){const value=String(body[key]).trim();if(value.length>limit)return jsonError("One or more employee details exceed the allowed length.");updates[column]=value||null;}}
  if(updates.employment_status==="terminated"&&!updates.end_date)updates.end_date=new Date().toISOString().slice(0,10);
  const effectiveStart=updates.start_date??employee.start_date;const effectiveEnd=updates.end_date??employee.end_date;if(effectiveStart&&effectiveEnd&&effectiveEnd<effectiveStart)return jsonError("Employment end date cannot be before the start date.");
  if(Object.keys(updates).length===1)return jsonError("No employee changes supplied.");
  const {data:updated,error}=await db.from("users").update(updates).eq("id",userId).eq("business_id",businessId).eq("updated_at",employee.updated_at).not("employment_status","is",null).select("id").maybeSingle();if(error)return jsonError("Could not update employee details.",500);if(!updated)return jsonError("This employee record changed during the update. Refresh and try again.",409);
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"employee.updated",entity_type:"user",entity_id:userId,details:updates});
  return Response.json({success:true});
 }catch{return jsonError("Could not update employee details.",500);}
}
