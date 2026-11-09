import {currentUser,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 const db=database();const {data:quotes,error}=await db.from("quotes").select("id,quote_number,total,enquiry_id,quote_items(description)").eq("user_id",user.id).eq("status","accepted").order("created_at",{ascending:false});
 if(error)return jsonError("Could not load accepted quotes.",500);
 return Response.json({quotes:quotes??[]});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();if(!user||user.account_type!=="customer")return jsonError("Sign in to request a booking.",401);
 try{
  const body=await request.json();const quoteId=String(body.quoteId??"");const start=String(body.preferredStart??"");const location=String(body.location??"").trim();const notes=String(body.notes??"").trim().slice(0,2000);const vehicleId=body.vehicleId?String(body.vehicleId):null;
  const startDate=new Date(start);if(!/^[0-9a-f-]{36}$/i.test(quoteId)||!start||!Number.isFinite(startDate.getTime()))return jsonError("Choose an accepted quote and a valid preferred date and time.");
  if(location.length<3||location.length>200)return jsonError("Enter the vehicle location so travel can be assessed.");
  const db=database();const {data:quote}=await db.from("quotes").select("id,business_id,customer_id,user_id,enquiry_id,quote_number,status").eq("id",quoteId).eq("user_id",user.id).eq("status","accepted").maybeSingle();
  if(!quote)return jsonError("Only an accepted quote can be used to request a booking.",409);
  const {data:customer}=await db.from("customers").select("id,business_id").eq("user_id",user.id).maybeSingle();if(!customer)return jsonError("Customer profile not found.",404);
  const {data:businessSettings}=await db.from("business_settings").select("settings").eq("business_id",customer.business_id).maybeSingle();const configured=businessSettings?.settings&&typeof businessSettings.settings==="object"?businessSettings.settings as Record<string,unknown>:{};const configuredNotice=Number(configured.booking_notice_hours??24);const noticeHours=Number.isFinite(configuredNotice)&&configuredNotice>=0?Math.max(1,configuredNotice):24;
  if(startDate.getTime()<Date.now()+noticeHours*60*60*1000)return jsonError("Choose a preferred time at least "+noticeHours+" hours from now.");
  if(vehicleId){const {data:vehicle}=await db.from("vehicles").select("id").eq("id",vehicleId).eq("customer_id",user.id).maybeSingle();if(!vehicle)return jsonError("Select one of your saved vehicles.");}
  let linkedVehicle=vehicleId;const enquiryId=quote.enquiry_id;
  if(!linkedVehicle&&enquiryId){const {data:enquiry}=await db.from("enquiries").select("vehicle_id").eq("id",enquiryId).maybeSingle();linkedVehicle=enquiry?.vehicle_id??null;}
  const preferredEnd=new Date(startDate.getTime()+60*60*1000).toISOString();
  const {data:appointment,error}=await db.from("appointments").insert({business_id:customer.business_id,customer_id:user.id,user_id:user.id,enquiry_id:enquiryId,quote_id:quote.id,vehicle_id:linkedVehicle,preferred_start:startDate.toISOString(),preferred_end:preferredEnd,location,customer_notes:notes||null,status:"requested"}).select("id,status,preferred_start,quote_id").single();
  if(error||!appointment)return jsonError("Could not submit booking request.",500);
  await db.from("audit_events").insert({business_id:customer.business_id,actor_user_id:user.id,action:"booking.requested_after_quote_acceptance",entity_type:"appointment",entity_id:appointment.id,details:{quote_id:quote.id,preferred_start:appointment.preferred_start}});
  return Response.json({success:true,appointment,message:"Your preferred booking time has been sent. It is not confirmed until Brandon RV agrees the date, time and location."},{status:201});
 }catch{return jsonError("Could not submit booking request.",500);}
}