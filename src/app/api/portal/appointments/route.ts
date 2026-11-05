import {currentUser,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const user=await currentUser();if(!user)return jsonError("Sign in to request an appointment.",401);if(user.account_type!=="customer")return jsonError("Customer account required.",403);
 try{
  const body=await request.json();const start=String(body.preferredStart??"");const location=String(body.location??"").trim();const notes=String(body.notes??"").trim().slice(0,2000);const vehicleId=body.vehicleId?String(body.vehicleId):null;const serviceId=body.serviceId?String(body.serviceId):null;
  const startDate=new Date(start);if(!start||!Number.isFinite(startDate.getTime())||startDate.getTime()<Date.now()+60*60*1000)return jsonError("Choose a preferred time at least one hour from now.");
  if(location.length>200)return jsonError("Enter a valid service location.");
  const db=database();const {data:customer}=await db.from("customers").select("id,business_id").eq("user_id",user.id).maybeSingle();if(!customer)return jsonError("Customer profile not found.",404);
  if(vehicleId){const {data:vehicle}=await db.from("vehicles").select("id").eq("id",vehicleId).eq("customer_id",customer.id).maybeSingle();if(!vehicle)return jsonError("Select one of your saved vehicles.");}
  if(serviceId){const {data:service}=await db.from("services").select("id").eq("id",serviceId).eq("business_id",customer.business_id).eq("is_active",true).maybeSingle();if(!service)return jsonError("Select a valid service.");}
  const preferredEnd=new Date(startDate.getTime()+60*60*1000).toISOString();
  const {data:appointment,error}=await db.from("appointments").insert({business_id:customer.business_id,customer_id:customer.id,user_id:user.id,vehicle_id:vehicleId,service_id:serviceId,preferred_start:startDate.toISOString(),preferred_end:preferredEnd,location:location||null,customer_notes:notes||null,status:"requested"}).select("id,status,preferred_start").single();
  if(error||!appointment)return jsonError("Could not submit appointment request.",500);
  await db.from("audit_events").insert({business_id:customer.business_id,actor_user_id:user.id,action:"appointment.requested",entity_type:"appointment",entity_id:appointment.id,details:{preferred_start:appointment.preferred_start}});
  return Response.json({success:true,appointment,message:"Appointment request sent. Brandon RV will confirm the time after checking availability."},{status:201});
 }catch{return jsonError("Could not submit appointment request.",500);}
}