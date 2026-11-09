import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
const clean=(v:unknown,max:number)=>String(v??"").trim().slice(0,max);
const makeSlug=(v:string)=>v.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,100);
const price=(v:unknown)=>v===""||v===null||v===undefined?null:Number(v);
const approvalStatuses=["approved_for_launch","conditional","assessment_required","deferred","not_offered"];
const columns="id,name,slug,category,description,scope_notes,price_from,pricing_label,approval_status,is_active,is_published,sort_order";
export async function GET(){
 const access=await authorizePermission("business.settings.manage");if(access.response)return access.response;
 const {data,error}=await database().from("services").select(columns).eq("business_id",access.membership!.business_id).order("sort_order").order("name");
 if(error)return jsonError("Could not load services.",500);return Response.json({services:data??[]});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("business.settings.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const name=clean(body.name,120);const category=clean(body.category,80);const description=clean(body.description,3000);const scope_notes=clean(body.scope_notes,3000);const slug=makeSlug(clean(body.slug,120)||name);const priceFrom=price(body.price_from);
  if(name.length<2||!slug)return jsonError("Enter a service name.");
  if(priceFrom!==null&&(!Number.isFinite(priceFrom)||priceFrom<0||priceFrom>10000000))return jsonError("Enter a valid starting price.");
  const approvalStatus=approvalStatuses.includes(String(body.approval_status))?String(body.approval_status):"assessment_required";
  if(body.is_published===true&&approvalStatus!=="approved_for_launch")return jsonError("Only services approved for launch can be published.");
  const db=database();const {data:existing}=await db.from("services").select("id").eq("business_id",access.membership!.business_id).eq("slug",slug).maybeSingle();if(existing)return jsonError("A service with that name already exists.",409);
  const {data:service,error}=await db.from("services").insert({business_id:access.membership!.business_id,name,slug,category:category||null,description:description||null,scope_notes:scope_notes||null,price_from:priceFrom,pricing_label:clean(body.pricing_label,100)||null,approval_status:approvalStatus,is_active:true,is_published:false,sort_order:100}).select(columns).single();
  if(error||!service)return jsonError("Could not create service.",500);
  await db.from("audit_events").insert({business_id:access.membership!.business_id,actor_user_id:access.user!.id,action:"service.created",entity_type:"service",entity_id:service.id,details:{name,slug,approval_status:approvalStatus}});
  return Response.json({service},{status:201});
 }catch{return jsonError("Could not create service.");}
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("business.settings.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const id=String(body.id??"");if(!/^[0-9a-f-]{36}$/i.test(id))return jsonError("Invalid service.");
  const update:Record<string,unknown>={updated_at:new Date().toISOString()};
  if(body.name!==undefined){const name=clean(body.name,120);if(name.length<2)return jsonError("Enter a service name.");update.name=name;if(body.slug===undefined)update.slug=makeSlug(name);}
  if(body.slug!==undefined){const slug=makeSlug(clean(body.slug,120));if(!slug)return jsonError("Enter a valid service name.");update.slug=slug;}
  if(body.category!==undefined)update.category=clean(body.category,80)||null;
  if(body.description!==undefined)update.description=clean(body.description,3000)||null;
  if(body.scope_notes!==undefined)update.scope_notes=clean(body.scope_notes,3000)||null;
  if(body.price_from!==undefined){const n=price(body.price_from);if(n!==null&&(!Number.isFinite(n)||n<0||n>10000000))return jsonError("Enter a valid starting price.");update.price_from=n;}
  if(body.pricing_label!==undefined)update.pricing_label=clean(body.pricing_label,100)||null;
  if(body.approval_status!==undefined){if(!approvalStatuses.includes(String(body.approval_status)))return jsonError("Select a valid service approval status.");update.approval_status=String(body.approval_status);if(body.approval_status!=="approved_for_launch")update.is_published=false;}
  if(body.is_active!==undefined){if(typeof body.is_active!=="boolean")return jsonError("Invalid active setting.");update.is_active=body.is_active;if(!body.is_active)update.is_published=false;}
  if(body.is_published!==undefined){if(typeof body.is_published!=="boolean")return jsonError("Invalid publication setting.");if(body.is_published&&(body.approval_status??"approved_for_launch")!=="approved_for_launch")return jsonError("Only services approved for launch can be published.");if(body.is_published&&body.is_active===false)return jsonError("An inactive service cannot be published.");update.is_published=body.is_published;}
  if(body.sort_order!==undefined){const n=Number(body.sort_order);if(!Number.isInteger(n)||n<0||n>10000)return jsonError("Invalid display order.");update.sort_order=n;}
  const db=database();const {data:current}=await db.from("services").select("approval_status,is_active").eq("id",id).eq("business_id",access.membership!.business_id).maybeSingle();if(!current)return jsonError("Service not found.",404);
  const nextApproval=String(update.approval_status??current.approval_status??"assessment_required");
  const nextActive=Boolean(update.is_active??current.is_active);
  if(update.is_published===true&&(nextApproval!=="approved_for_launch"||!nextActive))return jsonError("Only active services approved for launch can be published.");
  const {data:service,error}=await db.from("services").update(update).eq("id",id).eq("business_id",access.membership!.business_id).select(columns).maybeSingle();
  if(error||!service)return jsonError("Could not update service.",500);
  await db.from("audit_events").insert({business_id:access.membership!.business_id,actor_user_id:access.user!.id,action:"service.updated",entity_type:"service",entity_id:id,details:update});
  return Response.json({service});
 }catch{return jsonError("Could not update service.");}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("business.settings.manage");if(access.response)return access.response;
 const id=new URL(request.url).searchParams.get("id")??"";
 if(!/^[0-9a-f-]{36}$/i.test(id))return jsonError("Invalid service.");
 const db=database();const {data,error}=await db.from("services").delete().eq("id",id).eq("business_id",access.membership!.business_id).select("id,name").maybeSingle();
 if(error)return jsonError("This service could not be deleted. It may already be linked to an existing record.",409);
 if(!data)return jsonError("Service not found.",404);
 await db.from("audit_events").insert({business_id:access.membership!.business_id,actor_user_id:access.user!.id,action:"service.deleted",entity_type:"service",entity_id:id,details:{name:data.name}});
 return Response.json({success:true});
}
