import {currentUser,currentMembership,database,userHasPermission,jsonError,sameOrigin} from "@/lib/auth";
import {normalizeEmail} from "@/lib/auth";
export const runtime="nodejs";
const PROFILE_FIELDS=["full_name","email","phone","address","suburb","state","postcode","customer_internal_notes","customer_status"] as const;
const textFields=new Set(["full_name","email","phone","address","suburb","state","postcode","customer_internal_notes","customer_status"]);
async function access(permission:string){const user=await currentUser();if(!user)return {user:null,membership:null,error:jsonError("Not signed in.",401)};const membership=await currentMembership(user.id);if(!membership||!(await userHasPermission(user.id,permission)))return {user,membership,error:jsonError("You do not have permission to access this customer.",403)};return {user,membership,error:null};}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const a=await access("customers.view");if(a.error)return a.error;
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return jsonError("Customer not found.",404);
 const db=database();const businessId=a.membership!.business_id;
 const {data:customer,error}=await db.from("customers").select("*").eq("id",id).eq("business_id",businessId).maybeSingle();
 if(error||!customer)return jsonError("Customer not found.",404);
 const query=(table:string)=>db.from(table).select("*").eq("business_id",businessId).eq("customer_id",id).order("created_at",{ascending:false}).limit(100);
 const [vehicles,enquiries,appointments,quotes,jobs,invoices,payments,messages,documents,activity]=await Promise.all([
  query("vehicles"),query("enquiries"),query("appointments"),query("quotes"),query("jobs"),query("invoices"),query("payments"),query("customer_messages"),db.from("documents").select("*").eq("business_id",businessId).or("customer_id.eq."+id+",user_id.eq."+id).order("created_at",{ascending:false}).limit(100),db.from("audit_events").select("*").eq("business_id",businessId).eq("entity_type","customer").eq("entity_id",id).order("created_at",{ascending:false}).limit(100)
 ]);
 const quoteIds=(quotes.data??[]).map((x:any)=>x.id),invoiceIds=(invoices.data??[]).map((x:any)=>x.id),jobIds=(jobs.data??[]).map((x:any)=>x.id);
 const [quoteItems,invoiceItems,tasks,supplierOrders]=await Promise.all([
  quoteIds.length?db.from("quote_items").select("*").in("quote_id",quoteIds).order("sort_order"):Promise.resolve({data:[]}),
  invoiceIds.length?db.from("invoice_items").select("*").in("invoice_id",invoiceIds).order("sort_order"):Promise.resolve({data:[]}),
  jobIds.length?db.from("job_tasks").select("*").in("job_id",jobIds).order("sort_order"):Promise.resolve({data:[]}),
  jobIds.length?db.from("supplier_orders").select("*").eq("business_id",businessId).in("job_id",jobIds).order("created_at",{ascending:false}):Promise.resolve({data:[]})
 ]);
 const errors=[vehicles,enquiries,appointments,quotes,jobs,invoices,payments,messages,documents,activity].filter((x:any)=>x.error);
 if(errors.length)return jsonError("Could not load the complete customer history.",500);
 return Response.json({customer,vehicles:vehicles.data??[],enquiries:enquiries.data??[],appointments:appointments.data??[],quotes:quotes.data??[],quoteItems:quoteItems.data??[],jobs:jobs.data??[],tasks:tasks.data??[],invoices:invoices.data??[],invoiceItems:invoiceItems.data??[],payments:payments.data??[],messages:messages.data??[],documents:documents.data??[],supplierOrders:supplierOrders.data??[],activity:activity.data??[]});
}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const a=await access("customers.manage");if(a.error)return a.error;
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return jsonError("Customer not found.",404);
 try{
  const body=await request.json();const update:Record<string,string|null>={};
  for(const field of PROFILE_FIELDS){if(body[field]===undefined)continue;if(!textFields.has(field)||typeof body[field]!=="string")return jsonError("Invalid customer field: "+field);
   let value=String(body[field]).trim();
   if(field==="email"){value=normalizeEmail(value);if(value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))return jsonError("Enter a valid email address.");}
   if(field==="full_name"&&!value)return jsonError("Customer name is required.");
   if(field==="customer_status"&&!["active","inactive"].includes(value))return jsonError("Customer status must be active or inactive.");
   if(value.length>(field==="customer_internal_notes"?10000:field==="address"?500:255))return jsonError("One or more fields exceed the allowed length.");
   update[field]=value||null;
  }
  if(!Object.keys(update).length)return jsonError("No customer changes supplied.");
  const db=database(),businessId=a.membership!.business_id;
  if(update.email){const {data:duplicate}=await db.from("users").select("id").eq("email",update.email).neq("id",id).maybeSingle();if(duplicate)return jsonError("That email address is already used by another account.",409);}
  update.updated_at=new Date().toISOString();
  const {data:record,error}=await db.from("users").update(update).eq("id",id).eq("business_id",businessId).eq("primary_group","customer").select("id").maybeSingle();
  if(error||!record)return jsonError("Could not save customer details.",500);
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:a.user!.id,action:"customer.profile_updated",entity_type:"customer",entity_id:id,details:update});
  return Response.json({success:true});
 }catch{return jsonError("Could not save customer details.",500);}
}
