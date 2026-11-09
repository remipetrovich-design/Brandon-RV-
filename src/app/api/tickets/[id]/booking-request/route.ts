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
  const {data:settings}=await db.from("business_settings").select("settings").eq("business_id",enquiry.business_id).maybeSingle();const cfg=settings?.settings&&typeof settings.settings==="object"?settings.settings as Record<string,unknown>:{};const notice=Number(cfg.booking_notice_hours??24);const noticeHours=Number.isFinite(notice)&&notice>=0?Math.max(1,notice):24;
  if(start.getTime()<Date.now()+noticeHours*3600000)return jsonError("Choose a preferred time at least "+noticeHours+" hours from now.");
  const end=new Date(start.getTime()+3600000).toISOString();
  const {data:appointment,error}=await db.from("appointments").insert({business_id:enquiry.business_id,customer_id:null,user_id:null,enquiry_id:id,quote_id:quote.id,vehicle_id:enquiry.vehicle_id,guest_name:enquiry.contact_name,guest_email:enquiry.email,preferred_start:start.toISOString(),preferred_end:end,location,customer_notes:notes||null,status:"requested"}).select("id,status,preferred_start").single();
  if(error||!appointment)return jsonError("Could not submit your booking request.",500);
  await db.from("audit_events").insert({business_id:enquiry.business_id,actor_user_id:null,action:"guest_booking.requested",entity_type:"appointment",entity_id:appointment.id,details:{quote_id:quote.id,request_id:id}});
  return Response.json({success:true,appointment,message:"Your preferred visit time has been sent. The booking is not confirmed until Brandon RV agrees the date, time and location."},{status:201});
 }catch{return jsonError("Could not submit your booking request.",500);}
}