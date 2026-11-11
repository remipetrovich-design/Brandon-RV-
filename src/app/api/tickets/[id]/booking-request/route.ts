import {database,digest,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const {id}=await params;try{
  const body=await request.json();const token=String(body.guestToken??"");const quoteId=String(body.quoteId??"");const start=new Date(String(body.preferredStart??""));const location=String(body.location??"").trim();const notes=String(body.notes??"").trim().slice(0,2000);
  if(!token||!/^[0-9a-f-]{36}$/i.test(quoteId)||!Number.isFinite(start.getTime()))return jsonError("Choose an accepted quote and a valid preferred time.");
  if(location.length<3||location.length>200)return jsonError("Enter the agreed service location.");
  const db=database();const {data:enquiry}=await db.from("enquiries").select("id,business_id,contact_name,email,guest_access_token_hash,guest_access_expires_at,request_type,vehicle_id").eq("id",id).maybeSingle();
  if(!enquiry||enquiry.request_type!=="quote_request"||enquiry.guest_access_token_hash!==digest(token)||!enquiry.guest_access_expires_at||Date.parse(enquiry.guest_access_expires_at)<=Date.now())return jsonError("Request not found or guest access expired.",404);
  const {data:quote}=await db.from("quotes").select("id,status").eq("id",quoteId).eq("enquiry_id",id).eq("status","accepted").maybeSingle();if(!quote)return jsonError("Only an accepted quote can be used to request a booking.",409);
  const {data:existingBooking}=await db.from("appointments").select("id,status").eq("quote_id",quote.id).in("status",["requested","confirmed","rescheduled"]).limit(1).maybeSingle();if(existingBooking)return jsonError("A booking request already exists for this quote. Use your original Jobcard link to check its status.",409);
  const {data:settings}=await db.from("business_settings").select("settings").eq("business_id",enquiry.business_id).maybeSingle();const cfg=settings?.settings&&typeof settings.settings==="object"?settings.settings as Record<string,unknown>:{};const notice=Number(cfg.booking_notice_hours??24);const noticeHours=Number.isFinite(notice)&&notice>=0?Math.max(1,notice):24;
  if(start.getTime()<Date.now()+noticeHours*3600000)return jsonError("Choose a preferred time at least "+noticeHours+" hours from now.");
  const booking=cfg.booking&&typeof cfg.booking==="object"?cfg.booking as Record<string,unknown>:{};
  const maxDays=Number(booking.maximum_advance_days??90);
  if(Number.isFinite(maxDays)&&maxDays>0&&start.getTime()>Date.now()+maxDays*86400000)return jsonError("Choose a date within the next "+maxDays+" days.");
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Australia/Sydney",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(start);
  const localDate=parts.filter(x=>["year","month","day"].includes(x.type)).map(x=>x.value).join("-");
  const weekday=new Intl.DateTimeFormat("en-AU",{timeZone:"Australia/Sydney",weekday:"short"}).format(start).slice(0,3).toLowerCase();
  const workingDays=Array.isArray(booking.working_days)?booking.working_days.map(String):[];
  if(workingDays.length&&!workingDays.includes(weekday))return jsonError("That day is outside Brandon RV's configured working days.");
  const unavailable=Array.isArray(booking.unavailable_dates)?booking.unavailable_dates.map(String):[];
  if(unavailable.includes(localDate))return jsonError("Brandon RV is unavailable on that date. Please choose another day.");
  const duration=Number(booking.appointment_duration_minutes??60);
  const timeParts=new Intl.DateTimeFormat("en-AU",{timeZone:"Australia/Sydney",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(start);
  const minutes=Number(timeParts.find(x=>x.type==="hour")?.value??0)*60+Number(timeParts.find(x=>x.type==="minute")?.value??0);
  const opening=String(booking.opening_time??""),closing=String(booking.closing_time??"");
  const toMinutes=(value:string)=>{const [h,m]=value.split(":").map(Number);return h*60+m;};
  if(opening&&closing&&(minutes<toMinutes(opening)||minutes+duration>toMinutes(closing)))return jsonError("That time is outside Brandon RV's configured operating hours.");
  const travelBuffer=Number(booking.travel_buffer_minutes??30);
  const bufferedStart=new Date(start.getTime()-Math.max(0,travelBuffer)*60000).toISOString();
  const bufferedEnd=new Date(start.getTime()+(duration+Math.max(0,travelBuffer))*60000).toISOString();
  const {data:conflicts}=await db.from("appointments").select("id").eq("business_id",enquiry.business_id).in("status",["confirmed","rescheduled"]).not("starts_at","is",null).lt("starts_at",bufferedEnd).gt("ends_at",bufferedStart).limit(1);
  if(conflicts?.length)return jsonError("That time is already committed. Please choose another preferred time.");
  const end=new Date(start.getTime()+duration*60000).toISOString();
  const {data:appointment,error}=await db.from("appointments").insert({business_id:enquiry.business_id,customer_id:null,user_id:null,enquiry_id:id,quote_id:quote.id,vehicle_id:enquiry.vehicle_id,guest_name:enquiry.contact_name,guest_email:enquiry.email,preferred_start:start.toISOString(),preferred_end:end,location,customer_notes:notes||null,status:"requested"}).select("id,status,preferred_start").single();
  if(error||!appointment)return jsonError("Could not submit your booking request.",500);
  await db.from("audit_events").insert({business_id:enquiry.business_id,actor_user_id:null,action:"guest_booking.requested",entity_type:"appointment",entity_id:appointment.id,details:{quote_id:quote.id,request_id:id}});
  return Response.json({success:true,appointment,message:"Your preferred visit time has been sent. The booking is not confirmed until Brandon RV agrees the date, time and location."},{status:201});
 }catch{return jsonError("Could not submit your booking request.",500);}
}