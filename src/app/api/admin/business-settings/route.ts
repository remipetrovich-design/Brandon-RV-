import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
const defaults={operating_hours:"",accepting_enquiries:true,booking_notice_hours:24,customer_message:""};
export async function GET(){
 const access=await authorizePermission("business.settings.manage");if(access.response)return access.response;
 const {data,error}=await database().from("business_settings").select("settings,updated_at").eq("business_id",access.membership!.business_id).maybeSingle();
 if(error)return jsonError("Could not load business settings.",500);
 const settings=data?.settings&&typeof data.settings==="object"&&!Array.isArray(data.settings)?data.settings:{};
 return Response.json({settings:{...defaults,...settings},updated_at:data?.updated_at??null});
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("business.settings.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const input=body.settings;
  if(!input||typeof input!=="object"||Array.isArray(input))return jsonError("Invalid business settings.");
  const operatingHours=String(input.operating_hours??"").trim().slice(0,2000);
  const customerMessage=String(input.customer_message??"").trim().slice(0,2000);
  const acceptingEnquiries=input.accepting_enquiries!==false;
  const notice=Number(input.booking_notice_hours??24);
  if(!Number.isInteger(notice)||notice<0||notice>8760)return jsonError("Booking notice must be between 0 and 8760 hours.");
  const db=database();const {data:existing}=await db.from("business_settings").select("settings").eq("business_id",access.membership!.business_id).maybeSingle();
  const previous=existing?.settings&&typeof existing.settings==="object"&&!Array.isArray(existing.settings)?existing.settings:{};
  const settings={...defaults,...previous,operating_hours:operatingHours,accepting_enquiries:acceptingEnquiries,booking_notice_hours:notice,customer_message:customerMessage};
  const {error}=await db.from("business_settings").upsert({business_id:access.membership!.business_id,settings,updated_at:new Date().toISOString()},{onConflict:"business_id"});
  if(error)return jsonError("Could not save business settings.",500);
  await db.from("audit_events").insert({business_id:access.membership!.business_id,actor_user_id:access.user!.id,action:"business.settings.updated",entity_type:"business_settings",details:settings});
  return Response.json({settings});
 }catch{return jsonError("Could not save business settings.");}
}
