import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
const roleKeys=["owner","website_developer","developer"];
const employmentTypes=["casual","part_time","full_time"];
const employmentStatuses=["active","leave","suspended","terminated"];
const payFrequencies=["hourly","weekly","fortnightly","monthly","annually"];
const isId=(value:string)=>/^[0-9a-f-]{36}$/i.test(value);
export async function GET(){
 const access=await authorizePermission("staff.view");if(access.response)return access.response;
 const db=database(),businessId=access.membership!.business_id;
 const [{data:employees,error},{data:roles, error:roleError},{data:customers,error:customerError}]=await Promise.all([
  db.from("users").select("id,first_name,last_name,full_name,email,phone,status,user_role,employee_number,job_title,employment_type,employment_status,start_date,end_date,pay_rate,pay_frequency,payroll_reference,payroll_notes,emergency_contact_name,emergency_contact_phone,employee_internal_notes,created_at").eq("business_id",businessId).not("employment_status","is",null).order("created_at",{ascending:false}),
  db.from("user_roles").select("role_key,name,description,is_system").order("name"),
  db.from("users").select("id,first_name,last_name,full_name,email,phone").eq("business_id",businessId).is("user_role",null).is("employment_status",null).order("full_name")
 ]);
 if(error||roleError||customerError)return jsonError("Could not load the employee directory.",500);
 return Response.json({employees:employees??[],roles:(roles??[]).filter(x=>!["customer"].includes(x.role_key)),customers:customers??[]});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("staff.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const userId=String(body.userId??"");const userRole=String(body.userRole??"");const jobTitle=String(body.jobTitle??"").trim();const employmentType=String(body.employmentType??"full_time");const startDate=body.startDate?String(body.startDate):new Date().toISOString().slice(0,10);
  if(!isId(userId))return jsonError("Select an existing customer account.");
  if(!jobTitle||jobTitle.length>100)return jsonError("Enter a job title of 1 to 100 characters.");
  if(!employmentTypes.includes(employmentType))return jsonError("Select a valid employment type.");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||Number.isNaN(Date.parse(startDate)))return jsonError("Enter a valid employment start date.");
  if(!userRole)return jsonError("Select a user role for this employee.");
  const db=database(),businessId=access.membership!.business_id;
  const {data:role}=await db.from("user_roles").select("role_key").eq("role_key",userRole).maybeSingle();
  if(!role)return jsonError("Select a valid user role.");
  if(roleKeys.includes(userRole)&&!roleKeys.includes(String(access.membership!.role).toLowerCase().replaceAll(" ","_")))return jsonError("Only an Owner or Website Developer can assign this role.",403);
  const {data:customer}=await db.from("users").select("id,user_role,employment_status,business_id").eq("id",userId).eq("business_id",businessId).eq("primary_group","customer").maybeSingle();
  if(!customer)return jsonError("Customer account not found.",404);
  if(customer.user_role||customer.employment_status)return jsonError("This customer already has an employee record.",409);
  const updates:any={user_role:userRole,employment_status:"active",employment_type:employmentType,job_title:jobTitle,start_date:startDate,updated_at:new Date().toISOString()};
  if(body.employeeNumber!==undefined)updates.employee_number=String(body.employeeNumber).trim()||null;
  if(body.payRate!==undefined&&body.payRate!==""){const n=Number(body.payRate);if(!Number.isFinite(n)||n<0)return jsonError("Enter a valid non-negative pay rate.");updates.pay_rate=n;}
  if(body.payFrequency!==undefined&&body.payFrequency!==""){if(!payFrequencies.includes(String(body.payFrequency)))return jsonError("Select a valid pay frequency.");updates.pay_frequency=String(body.payFrequency);}
  for(const [key,limit] of [["payrollReference",100],["payrollNotes",5000],["emergencyContactName",120],["emergencyContactPhone",40],["employeeInternalNotes",5000]] as const){if(body[key]!==undefined){const value=String(body[key]).trim();if(value.length>limit)return jsonError("One or more employee details exceed the allowed length.");updates[{payrollReference:"payroll_reference",payrollNotes:"payroll_notes",emergencyContactName:"emergency_contact_name",emergencyContactPhone:"emergency_contact_phone",employeeInternalNotes:"employee_internal_notes"}[key]]=value||null;}}
  const {error}=await db.from("users").update(updates).eq("id",userId);
  if(error)return jsonError("Could not activate the employee record.",500);
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"employee.activated",entity_type:"user",entity_id:userId,details:{user_role:userRole,job_title:jobTitle,employment_type:employmentType}});
  return Response.json({success:true},{status:201});
 }catch{return jsonError("Could not activate the employee record.",500);}
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("staff.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const userId=String(body.userId??"");if(!isId(userId))return jsonError("Invalid employee record.");
  const db=database(),businessId=access.membership!.business_id;
  const {data:employee}=await db.from("users").select("id,user_role,employment_status").eq("id",userId).eq("business_id",businessId).not("employment_status","is",null).maybeSingle();
  if(!employee)return jsonError("Employee record not found.",404);
  const updates:any={updated_at:new Date().toISOString()};
  if(body.userRole!==undefined){const roleKey=String(body.userRole);if(roleKey){const {data:role}=await db.from("user_roles").select("role_key").eq("role_key",roleKey).maybeSingle();if(!role)return jsonError("Select a valid user role.");if(roleKeys.includes(roleKey)&&!roleKeys.includes(String(access.membership!.role).toLowerCase().replaceAll(" ","_")))return jsonError("Only an Owner or Website Developer can assign this role.",403);updates.user_role=roleKey;}else updates.user_role=null;}
  if(body.employmentStatus!==undefined){const value=String(body.employmentStatus);if(!employmentStatuses.includes(value))return jsonError("Select a valid employment status.");if(roleKeys.includes(String(employee.user_role))&&value==="terminated")return jsonError("Owner and Website Developer access cannot be terminated here.",403);updates.employment_status=value;if(value==="terminated")updates.user_role=null;}
  if(body.employmentType!==undefined){const value=String(body.employmentType);if(!employmentTypes.includes(value))return jsonError("Select a valid employment type.");updates.employment_type=value;}
  if(body.jobTitle!==undefined){const value=String(body.jobTitle).trim();if(value.length>100)return jsonError("Job title must be 100 characters or fewer.");updates.job_title=value||null;}
  if(body.employeeNumber!==undefined){const value=String(body.employeeNumber).trim();if(value.length>50)return jsonError("Employee number must be 50 characters or fewer.");updates.employee_number=value||null;}
  if(body.startDate!==undefined){const value=String(body.startDate);if(value&&!/^\d{4}-\d{2}-\d{2}$/.test(value))return jsonError("Enter a valid start date.");updates.start_date=value||null;}
  if(body.endDate!==undefined){const value=String(body.endDate);if(value&&!/^\d{4}-\d{2}-\d{2}$/.test(value))return jsonError("Enter a valid end date.");updates.end_date=value||null;}
  if(body.payRate!==undefined){if(body.payRate==="")updates.pay_rate=null;else{const value=Number(body.payRate);if(!Number.isFinite(value)||value<0)return jsonError("Enter a valid non-negative pay rate.");updates.pay_rate=value;}}
  if(body.payFrequency!==undefined){const value=String(body.payFrequency);if(value&&!payFrequencies.includes(value))return jsonError("Select a valid pay frequency.");updates.pay_frequency=value||null;}
  for(const [key,column,limit] of [["payrollReference","payroll_reference",100],["payrollNotes","payroll_notes",5000],["emergencyContactName","emergency_contact_name",120],["emergencyContactPhone","emergency_contact_phone",40],["employeeInternalNotes","employee_internal_notes",5000]] as const){if(body[key]!==undefined){const value=String(body[key]).trim();if(value.length>limit)return jsonError("One or more employee details exceed the allowed length.");updates[column]=value||null;}}
  if(Object.keys(updates).length===1)return jsonError("No employee changes supplied.");
  const {error}=await db.from("users").update(updates).eq("id",userId);if(error)return jsonError("Could not update employee details.",500);
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"employee.updated",entity_type:"user",entity_id:userId,details:updates});
  return Response.json({success:true});
 }catch{return jsonError("Could not update employee details.",500);}
}
