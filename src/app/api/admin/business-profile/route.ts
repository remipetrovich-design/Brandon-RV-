import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const access=await authorizePermission("business.settings.manage");if(access.response)return access.response;
 const {data,error}=await database().from("businesses").select("id,name,brand_line,phone,public_email,city,region,country,status").eq("id",access.membership!.business_id).maybeSingle();
 if(error||!data)return jsonError("Could not load business profile.",500);return Response.json({business:data});
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("business.settings.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const update:Record<string,unknown>={updated_at:new Date().toISOString()};
  if(body.name!==undefined){const v=String(body.name).trim();if(v.length<2||v.length>120)return jsonError("Enter a valid business name.");update.name=v;}
  if(body.brand_line!==undefined)update.brand_line=String(body.brand_line).trim().slice(0,160)||null;
  if(body.phone!==undefined){const v=String(body.phone).trim();if(v.length>40)return jsonError("Enter a valid phone number.");update.phone=v||null;}
  if(body.city!==undefined)update.city=String(body.city).trim().slice(0,100)||null;
  if(body.region!==undefined)update.region=String(body.region).trim().slice(0,80)||null;
  if(body.public_email!==undefined){const v=String(body.public_email).trim().toLowerCase();if(v&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))return jsonError("Enter a valid email address.");update.public_email=v||null;}
  const {data,error}=await database().from("businesses").update(update).eq("id",access.membership!.business_id).select("id,name,brand_line,phone,public_email,city,region,country,status").single();
  if(error||!data)return jsonError("Could not save business profile.",500);
  await database().from("audit_events").insert({business_id:access.membership!.business_id,actor_user_id:access.user!.id,action:"business.profile.updated",entity_type:"business",entity_id:data.id,details:update});
  return Response.json({business:data});
 }catch{return jsonError("Could not save business profile.");}
}