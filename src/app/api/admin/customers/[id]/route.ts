import {currentUser,currentMembership,database,userHasPermission,userHasPermissions,jsonError,sameOrigin,normalizeEmail} from "@/lib/auth";
import {isGlobalAdministrator} from "@/lib/user-role-policy.mjs";
export const runtime="nodejs";
const STAFF_ROLE_KEYS=["apprentice","senior_worker","office","supervisor","manager","owner","website_developer"];
const PROFILE_FIELDS=["first_name","last_name","full_name","date_of_birth","email","phone","address","suburb","state","postcode","customer_internal_notes","customer_status","status"] as const;
const isValidBirthDate=(value:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+"T00:00:00Z");return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value&&date<=new Date();};
const textFields=new Set(["first_name","last_name","full_name","date_of_birth","email","phone","address","suburb","state","postcode","customer_internal_notes","customer_status","status"]);
const fieldLimits:Record<string,number>={first_name:120,last_name:120,full_name:120,date_of_birth:10,email:254,phone:40,address:500,suburb:120,state:80,postcode:12,customer_internal_notes:10000,customer_status:8,status:8};
async function access(permission:string){const user=await currentUser();if(!user)return {user:null,membership:null,error:jsonError("Not signed in.",401)};const membership=await currentMembership(user.id);if(!membership||!(await userHasPermission(user.id,permission)))return {user,membership,error:jsonError("You do not have permission to access this customer.",403)};return {user,membership,error:null};}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const a=await access("customers.view");if(a.error)return a.error;
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return jsonError("Customer not found.",404);
 const db=database(),businessId=a.membership!.business_id;
 const {data:customer,error}=await db.from("customers").select("*").eq("id",id).eq("business_id",businessId).maybeSingle();
 if(error||!customer)return jsonError("Customer not found.",404);
 const permissionKeys=["customers.manage","staff.manage","vehicles.view","enquiries.view","appointments.view","quotes.view","jobs.view","invoices.view","suppliers.view","documents.view","communications.manage"];
 const permitted=await userHasPermissions(a.user!.id,permissionKeys);
 const permissions=Object.fromEntries(permissionKeys.map(key=>[key,permitted.has(key)]));
 if(!permitted.has("customers.manage"))delete customer.internal_notes;
 const {data:account,error:accountError}=await db.from("users").select("id,status,email_verified_at,last_login_at,first_name,last_name,date_of_birth,user_role,employee_number,job_title,employment_type,employment_status,start_date,end_date,pay_rate,pay_frequency,payroll_reference,payroll_notes,emergency_contact_name,emergency_contact_phone,employee_internal_notes").eq("id",customer.user_id??id).maybeSingle();
 if(accountError)return jsonError("Could not load customer account status.",500);
 const query=(table:string)=>db.from(table).select("*").eq("business_id",businessId).eq("customer_id",id).order("created_at",{ascending:false}).limit(100);
 const empty={data:[],error:null};
 const [vehicles,enquiries,appointments,quotes,jobs,invoices,payments,messages,documents]=await Promise.all([
  permitted.has("vehicles.view")?query("vehicles"):Promise.resolve(empty),
  permitted.has("enquiries.view")?query("enquiries"):Promise.resolve(empty),
  permitted.has("appointments.view")?query("appointments"):Promise.resolve(empty),
  permitted.has("quotes.view")?query("quotes"):Promise.resolve(empty),
  permitted.has("jobs.view")?query("jobs"):Promise.resolve(empty),
  permitted.has("invoices.view")?query("invoices"):Promise.resolve(empty),
  permitted.has("invoices.view")?query("payments"):Promise.resolve(empty),
  permitted.has("communications.manage")?query("customer_messages"):Promise.resolve(empty),
  permitted.has("documents.view")?db.from("documents").select("*").eq("business_id",businessId).or("customer_id.eq."+id+",user_id.eq."+(customer.user_id??id)).order("created_at",{ascending:false}).limit(100):Promise.resolve(empty)
 ]);
 const quoteIds=(quotes.data??[]).map((x:any)=>x.id),invoiceIds=(invoices.data??[]).map((x:any)=>x.id),jobIds=(jobs.data??[]).map((x:any)=>x.id);
 const [quoteItems,invoiceItems,tasks,supplierOrders]=await Promise.all([
  quoteIds.length?db.from("quote_items").select("*").in("quote_id",quoteIds).order("sort_order"):Promise.resolve(empty),
  invoiceIds.length?db.from("invoice_items").select("*").in("invoice_id",invoiceIds).order("sort_order"):Promise.resolve(empty),
  jobIds.length?db.from("job_tasks").select("*").in("job_id",jobIds).order("sort_order"):Promise.resolve(empty),
  jobIds.length&&permitted.has("suppliers.view")?db.from("supplier_orders").select("*").eq("business_id",businessId).in("job_id",jobIds).order("created_at",{ascending:false}):Promise.resolve(empty)
 ]);
 const errors=[vehicles,enquiries,appointments,quotes,jobs,invoices,payments,messages,documents].filter((x:any)=>x.error);
 if(errors.length)return jsonError("Could not load the permitted customer history.",500);
 const supplierOrderIds=(supplierOrders.data??[]).map((x:any)=>x.id);
 const [supplierOrderItems,activity]=await Promise.all([
  supplierOrderIds.length?db.from("supplier_order_items").select("*").in("order_id",supplierOrderIds).order("sort_order"):Promise.resolve(empty),
  permitted.has("customers.manage")?db.from("audit_events").select("*").eq("business_id",businessId).in("entity_id",[id,...(vehicles.data??[]).map((x:any)=>x.id),...(enquiries.data??[]).map((x:any)=>x.id),...(appointments.data??[]).map((x:any)=>x.id),...quoteIds,...jobIds,...invoiceIds]).order("created_at",{ascending:false}).limit(200):Promise.resolve(empty)
 ]);
 const {data:roles}=await db.from("user_roles").select("role_key,name").in("role_key",STAFF_ROLE_KEYS).order("name");
 return Response.json({customer,account,permissions,roles:(roles??[]).sort((a,b)=>STAFF_ROLE_KEYS.indexOf(a.role_key)-STAFF_ROLE_KEYS.indexOf(b.role_key)),canChangeRoles:isGlobalAdministrator(a.user?.user_role),vehicles:vehicles.data??[],enquiries:enquiries.data??[],appointments:appointments.data??[],quotes:quotes.data??[],quoteItems:quoteItems.data??[],jobs:jobs.data??[],tasks:tasks.data??[],invoices:invoices.data??[],invoiceItems:invoiceItems.data??[],payments:payments.data??[],messages:messages.data??[],documents:documents.data??[],supplierOrders:supplierOrders.data??[],supplierOrderItems:supplierOrderItems.data??[],activity:activity.data??[]});
}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const a=await access("customers.manage");if(a.error)return a.error;
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return jsonError("Customer not found.",404);
 try{
  const body=await request.json(),update:Record<string,string|null>={};
  if(body.user_role!==undefined){if(!isGlobalAdministrator(a.user?.user_role))return jsonError("Only a global administrator can change user roles.",403);const roleKey=String(body.user_role??"").trim();if(roleKey){if(!STAFF_ROLE_KEYS.includes(roleKey))return jsonError("Select one of the available Brandon RV staff titles.");const {data:role}=await database().from("user_roles").select("role_key").eq("role_key",roleKey).maybeSingle();if(!role)return jsonError("Select a valid user role.");update.user_role=roleKey;}else update.user_role=null;}
  for(const field of PROFILE_FIELDS){
   if(body[field]===undefined)continue;
   if(!textFields.has(field)||typeof body[field]!=="string")return jsonError("Invalid customer field: "+field);
   let value=String(body[field]).trim();
   if(field==="status")continue;
   if(field==="date_of_birth"&&value&&!isValidBirthDate(value))return jsonError("Enter a valid date of birth.");
   if(field==="email"){value=normalizeEmail(value);if(!value||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))return jsonError("Enter a valid email address.");}
   if(field==="full_name"&&(!value||value.length>120))return jsonError("Customer name is required and must be 120 characters or fewer.");
   if((field==="first_name"||field==="last_name")&&value.length>120)return jsonError("Names must be 120 characters or fewer.");
   if(field==="customer_status"&& !["active","inactive"].includes(value))return jsonError("Customer status must be active or inactive.");
   if(value.length>fieldLimits[field])return jsonError("One or more fields exceed the allowed length.");
   update[field]=value||null;
  }
  if(body.status!==undefined){const value=String(body.status).trim();if(!["active","suspended","banned"].includes(value))return jsonError("Account status can only be set to active, suspended or banned. Unverified is system-controlled.");update.status=value;}
  if(!Object.keys(update).length)return jsonError("No customer changes supplied.");
  const db=database(),businessId=a.membership!.business_id;
  const {data:customer}=await db.from("customers").select("id,user_id,full_name,first_name,last_name").eq("id",id).eq("business_id",businessId).maybeSingle();
  if(!customer)return jsonError("Customer not found.",404);
  if(update.first_name!==undefined||update.last_name!==undefined){
   const first=String(update.first_name??customer.first_name??"").trim();
   const last=String(update.last_name??customer.last_name??"").trim();
   if(!first||!last)return jsonError("First and last name are required.");
   update.full_name=[first,last].join(" ");
  }
  const userId=customer.user_id??customer.id;
  if(update.email){const {data:duplicate}=await db.from("users").select("id").eq("email",update.email).neq("id",userId).maybeSingle();if(duplicate)return jsonError("That email address is already used by another account.",409);}
  update.updated_at=new Date().toISOString();
  const {data:record,error}=await db.from("users").update(update).eq("id",userId).eq("primary_group","customer").select("id").maybeSingle();
  if(error||!record)return jsonError("Could not save customer details.",500);
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:a.user!.id,action:"customer.profile_updated",entity_type:"customer",entity_id:id,details:update});
  return Response.json({success:true});
 }catch{return jsonError("Could not save customer details.",500);}
}
