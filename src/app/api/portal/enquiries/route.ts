import {currentUser,database,jsonError,sameOrigin} from "@/lib/auth";
import {randomBytes} from "node:crypto";
export const runtime="nodejs";
const makeReference=()=> "BRV-CE-"+new Date().toISOString().slice(2,10).replaceAll("-","")+"-"+randomBytes(3).toString("hex").toUpperCase();
export async function GET(){
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 const db=database();const {data,error}=await db.from("enquiries").select("id,request_number,request_type,requested_service,description,status,created_at,vehicle_description,location,preferred_contact").eq("user_id",user.id).in("request_type",["customer_enquiry","quote_request"]).order("created_at",{ascending:false});
 if(error)return jsonError("Could not load your enquiries.",500);return Response.json({enquiries:data??[]});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();if(!user||user.account_type!=="customer")return jsonError("Sign in to create a customer enquiry.",401);
 try{
  const body=await request.json();const subject=String(body.subject??"").trim();const message=String(body.message??"").trim();const vehicleId=body.vehicleId?String(body.vehicleId):null;
  const location=String(body.location??"").trim().slice(0,200)||null;const vehicleDescription=String(body.vehicleDescription??"").trim().slice(0,300)||null;
  const preferredContact=String(body.preferredContact??"email");const preferred=["email","phone","sms"].includes(preferredContact)?preferredContact:"email";
  if(subject.length<3||subject.length>180||message.length<5||message.length>5000)return jsonError("Enter a subject and message.");
  const db=database();const {data:customer}=await db.from("customers").select("id,business_id").eq("user_id",user.id).maybeSingle();if(!customer)return jsonError("Customer profile not found.",404);
  if(vehicleId){const {data:vehicle}=await db.from("vehicles").select("id").eq("id",vehicleId).eq("customer_id",user.id).maybeSingle();if(!vehicle)return jsonError("Select one of your saved vehicles.");}
  const {data:businessSettings}=await db.from("business_settings").select("settings").eq("business_id",customer.business_id).maybeSingle();const settings=businessSettings?.settings&&typeof businessSettings.settings==="object"?businessSettings.settings as Record<string,unknown>:{};if(settings.accepting_enquiries===false)return jsonError("Brandon RV is not accepting new enquiries at the moment.",503);
  const {data:enquiry,error}=await db.from("enquiries").insert({business_id:customer.business_id,customer_id:user.id,user_id:user.id,contact_name:user.full_name,email:user.email,phone:user.phone,location,vehicle_description:vehicleDescription,vehicle_id:vehicleId,requested_service:subject,description:message,preferred_contact:preferred,source:"customer_portal",request_type:"customer_enquiry",request_number:makeReference(),status:"new"}).select("id,request_number,request_type,requested_service,status,created_at").single();
  if(error||!enquiry)return jsonError("Could not create your enquiry.",500);
  await db.from("audit_events").insert({business_id:customer.business_id,actor_user_id:user.id,action:"customer_enquiry.created",entity_type:"enquiry",entity_id:enquiry.id,details:{request_number:enquiry.request_number}});
  return Response.json({enquiry},{status:201});
 }catch{return jsonError("Could not create your enquiry.",500);}
}
