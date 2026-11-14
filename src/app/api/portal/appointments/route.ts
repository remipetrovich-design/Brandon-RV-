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
  if(quote.enquiry_id){const {data:jobcard}=await db.from("enquiries").select("id,request_type,archived_at").eq("id",quote.enquiry_id).eq("user_id",user.id).maybeSingle();if(!jobcard||jobcard.request_type!=="quote_request"||jobcard.archived_at)return jsonError("This Jobcard is closed and cannot accept a booking request.",409);}
  const {data:existingBooking}=await db.from("appointments").select("id,status").eq("quote_id",quote.id).in("status",["requested","confirmed","rescheduled"]).limit(1).maybeSingle();
  if(existingBooking)return jsonError("A booking request already exists for this quote. Open the Jobcard to view its status.",409);
  const {data:customer}=await db.from("customers").select("id,business_id").eq("user_id",user.id).maybeSingle();if(!customer)return jsonError("Customer profile not found.",404);
  const {data:businessSettings}=await db.from("business_settings").select("settings").eq("business_id",customer.business_id).maybeSingle();const configured=businessSettings?.settings&&typeof businessSettings.settings==="object"?businessSettings.settings as Record<string,unknown>:{};const configuredNotice=Number(configured.booking_notice_hours??24);const noticeHours=Number.isFinite(configuredNotice)&&configuredNotice>=0?Math.max(1,configuredNotice):24;
  if(startDate.getTime()<Date.now()+noticeHours*60*60*1000)return jsonError("Choose a preferred time at least "+noticeHours+" hours from now.");
  const bookingConfig=configured.booking&&typeof configured.booking==="object"?configured.booking as Record<string,unknown>:{};
  const maximumAdvanceDays=Number(bookingConfig.maximum_advance_days??90);
  if(Number.isFinite(maximumAdvanceDays)&&maximumAdvanceDays>0&&startDate.getTime()>Date.now()+maximumAdvanceDays*24*60*60*1000)return jsonError("Choose a date within the next "+maximumAdvanceDays+" days.");
  const dateParts=new Intl.DateTimeFormat("en-CA",{timeZone:"Australia/Sydney",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(startDate);
  const localDate=dateParts.filter(x=>["year","month","day"].includes(x.type)).map(x=>x.value).join("-");
  const weekday=new Intl.DateTimeFormat("en-AU",{timeZone:"Australia/Sydney",weekday:"short"}).format(startDate).slice(0,3).toLowerCase();
  const workingDays=Array.isArray(bookingConfig.working_days)?bookingConfig.working_days.map(String):[];
  if(workingDays.length&&!workingDays.includes(weekday))return jsonError("That day is outside Brandon RV's configured working days.");
  const unavailable=Array.isArray(bookingConfig.unavailable_dates)?bookingConfig.unavailable_dates.map(String):[];
  if(unavailable.includes(localDate))return jsonError("Brandon RV is unavailable on that date. Please choose another day.");
  const timeParts=new Intl.DateTimeFormat("en-AU",{timeZone:"Australia/Sydney",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(startDate);
  const localMinutes=Number(timeParts.find(x=>x.type==="hour")?.value??0)*60+Number(timeParts.find(x=>x.type==="minute")?.value??0);
  const opening=String(bookingConfig.opening_time??"");const closing=String(bookingConfig.closing_time??"");
  const toMinutes=(value:string)=>{const [h,m]=value.split(":").map(Number);return h*60+m;};
  const duration=Number(bookingConfig.appointment_duration_minutes??60);
  if(opening&&closing&&(localMinutes<toMinutes(opening)||localMinutes+duration>toMinutes(closing)))return jsonError("That time is outside Brandon RV's configured operating hours.");
  const travelBuffer=Number(bookingConfig.travel_buffer_minutes??30);
  const bufferedStart=new Date(startDate.getTime()-Math.max(0,travelBuffer)*60000).toISOString();
  const bufferedEnd=new Date(startDate.getTime()+(duration+Math.max(0,travelBuffer))*60000).toISOString();
  const {data:conflicts}=await db.from("appointments").select("id").eq("business_id",customer.business_id).in("status",["confirmed","rescheduled"]).not("starts_at","is",null).lt("starts_at",bufferedEnd).gt("ends_at",bufferedStart).limit(1);
  if(conflicts?.length)return jsonError("That time is already committed. Please choose another preferred time.");
  if(vehicleId){const {data:vehicle}=await db.from("vehicles").select("id").eq("id",vehicleId).eq("customer_id",user.id).maybeSingle();if(!vehicle)return jsonError("Select one of your saved vehicles.");}
  let linkedVehicle=vehicleId;const enquiryId=quote.enquiry_id;
  if(!linkedVehicle&&enquiryId){const {data:enquiry}=await db.from("enquiries").select("vehicle_id").eq("id",enquiryId).maybeSingle();linkedVehicle=enquiry?.vehicle_id??null;}
  const preferredEnd=new Date(startDate.getTime()+Number(bookingConfig.appointment_duration_minutes??60)*60*1000).toISOString();
  const {data:appointment,error}=await db.from("appointments").insert({business_id:customer.business_id,customer_id:user.id,user_id:user.id,enquiry_id:enquiryId,quote_id:quote.id,vehicle_id:linkedVehicle,preferred_start:startDate.toISOString(),preferred_end:preferredEnd,location,customer_notes:notes||null,status:"requested"}).select("id,status,preferred_start,quote_id").single();
  if(error||!appointment)return jsonError("Could not submit booking request.",500);
  const {error:workcardLinkError}=await db.from("jobs").update({appointment_id:appointment.id,updated_at:new Date().toISOString()}).eq("business_id",customer.business_id).eq("quote_id",quote.id);\n  if(workcardLinkError){await db.from("appointments").delete().eq("id",appointment.id).eq("business_id",customer.business_id);return jsonError("Your booking request could not be linked to the Workcard. Please try again.",500);}\n  await db.from("audit_events").insert({business_id:customer.business_id,actor_user_id:user.id,action:"booking.requested_after_quote_acceptance",entity_type:"appointment",entity_id:appointment.id,details:{quote_id:quote.id,preferred_start:appointment.preferred_start}});
  return Response.json({success:true,appointment,message:"Your preferred booking time has been sent. It is not confirmed until Brandon RV agrees the date, time and location."},{status:201});
 }catch{return jsonError("Could not submit booking request.",500);}
}