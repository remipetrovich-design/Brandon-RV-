import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
const defaults={
 operating_hours:"",accepting_enquiries:true,booking_notice_hours:24,customer_message:"",
 booking:{working_days:[],opening_time:"",closing_time:"",appointment_duration_minutes:60,travel_buffer_minutes:30,maximum_advance_days:90,unavailable_dates:[],cancellation_notice_hours:24,cancellation_policy:"",approval_required:true},
 pricing:{labour_rate:null,parts_markup_percent:null,minimum_attendance_minutes:60,freight_policy:"at_cost",consumables_policy:"at_cost",gst_status:"not_configured",gst_rate:10}
};
const isObject=(value:unknown):value is Record<string,any>=>!!value&&typeof value==="object"&&!Array.isArray(value);
const time=(value:unknown)=>String(value??"");
const number=(value:unknown,fallback:number)=>value===null||value===undefined||value===""?fallback:Number(value);
export async function GET(){
 const access=await authorizePermission("business.settings.manage");if(access.response)return access.response;
 const {data,error}=await database().from("business_settings").select("settings,updated_at").eq("business_id",access.membership!.business_id).maybeSingle();
 if(error)return jsonError("Could not load business settings.",500);
 const saved=isObject(data?.settings)?data!.settings:{};
 return Response.json({settings:{...defaults,...saved,booking:{...defaults.booking,...(isObject(saved.booking)?saved.booking:{})},pricing:{...defaults.pricing,...(isObject(saved.pricing)?saved.pricing:{})}},updated_at:data?.updated_at??null});
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("business.settings.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const input=body.settings;
  if(!isObject(input))return jsonError("Invalid business settings.");
  const operating_hours=String(input.operating_hours??"").trim().slice(0,2000);
  const customer_message=String(input.customer_message??"").trim().slice(0,2000);
  const accepting_enquiries=input.accepting_enquiries!==false;
  const booking_notice_hours=number(input.booking_notice_hours,24);
  if(!Number.isInteger(booking_notice_hours)||booking_notice_hours<1||booking_notice_hours>8760)return jsonError("Booking notice must be between 1 and 8760 hours.");
  const b=isObject(input.booking)?input.booking:{};
  const working_days=Array.isArray(b.working_days)?[...new Set(b.working_days.map((x:unknown)=>String(x)))]:[];
  const validDays=["mon","tue","wed","thu","fri","sat","sun"];
  if(working_days.some((day:string)=>!validDays.includes(day)))return jsonError("Select valid working days.");
  const opening_time=time(b.opening_time),closing_time=time(b.closing_time);
  if((opening_time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(opening_time))||(closing_time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(closing_time)))return jsonError("Enter opening and closing times in 24-hour format.");
  if(opening_time&&closing_time&&opening_time>=closing_time)return jsonError("Closing time must be later than opening time.");
  const appointment_duration_minutes=number(b.appointment_duration_minutes,60);
  const travel_buffer_minutes=number(b.travel_buffer_minutes,30);
  const maximum_advance_days=number(b.maximum_advance_days,90);
  const cancellation_notice_hours=number(b.cancellation_notice_hours,24);
  if(!Number.isInteger(appointment_duration_minutes)||appointment_duration_minutes<15||appointment_duration_minutes>480)return jsonError("Appointment duration must be 15 to 480 minutes.");
  if(!Number.isInteger(travel_buffer_minutes)||travel_buffer_minutes<0||travel_buffer_minutes>240)return jsonError("Travel and setup buffer must be 0 to 240 minutes.");
  if(!Number.isInteger(maximum_advance_days)||maximum_advance_days<1||maximum_advance_days>365)return jsonError("Maximum advance booking must be 1 to 365 days.");
  if(!Number.isInteger(cancellation_notice_hours)||cancellation_notice_hours<0||cancellation_notice_hours>720)return jsonError("Cancellation notice must be 0 to 720 hours.");
  const unavailable_dates=Array.isArray(b.unavailable_dates)?[...new Set(b.unavailable_dates.map((x:unknown)=>String(x)))]:[];
  if(unavailable_dates.length>200||unavailable_dates.some((date:string)=>!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)||!Number.isFinite(Date.parse(date+"T00:00:00Z"))))return jsonError("Unavailable dates must be valid YYYY-MM-DD dates (maximum 200).");
  const cancellation_policy=String(b.cancellation_policy??"").trim().slice(0,2000);
  const approval_required=b.approval_required!==false;
  const p=isObject(input.pricing)?input.pricing:{};
  const optionalAmount=(value:unknown,max:number)=>value===null||value===undefined||value===""?null:Number(value);
  const labour_rate=optionalAmount(p.labour_rate,5000);
  const parts_markup_percent=optionalAmount(p.parts_markup_percent,200);
  const minimum_attendance_minutes=number(p.minimum_attendance_minutes,60);
  const freight_policy=String(p.freight_policy??"at_cost");
  const consumables_policy=String(p.consumables_policy??"at_cost");
  const gst_status=String(p.gst_status??"not_configured");
  const gst_rate=number(p.gst_rate,10);
  if(labour_rate!==null&&(!Number.isFinite(labour_rate)||labour_rate<0||labour_rate>5000))return jsonError("Enter a valid labour rate.");
  if(parts_markup_percent!==null&&(!Number.isFinite(parts_markup_percent)||parts_markup_percent<0||parts_markup_percent>200))return jsonError("Parts markup must be 0 to 200 percent.");
  if(!Number.isInteger(minimum_attendance_minutes)||minimum_attendance_minutes<0||minimum_attendance_minutes>1440)return jsonError("Minimum attendance must be 0 to 1440 minutes.");
  if(!["at_cost","quoted","included"].includes(freight_policy)||!["at_cost","quoted","included"].includes(consumables_policy))return jsonError("Select a valid freight and consumables policy.");
  if(!["not_configured","registered","not_registered"].includes(gst_status)||!Number.isFinite(gst_rate)||gst_rate<0||gst_rate>20)return jsonError("Check the GST configuration.");
  const db=database();const {data:existing}=await db.from("business_settings").select("settings").eq("business_id",access.membership!.business_id).maybeSingle();
  const previous=isObject(existing?.settings)?existing!.settings:{};
  const settings={...defaults,...previous,operating_hours,accepting_enquiries,booking_notice_hours,customer_message,
   booking:{...defaults.booking,...(isObject(previous.booking)?previous.booking:{}),working_days,opening_time,closing_time,appointment_duration_minutes,travel_buffer_minutes,maximum_advance_days,unavailable_dates,cancellation_notice_hours,cancellation_policy,approval_required},
   pricing:{...defaults.pricing,...(isObject(previous.pricing)?previous.pricing:{}),labour_rate,parts_markup_percent,minimum_attendance_minutes,freight_policy,consumables_policy,gst_status,gst_rate}};
  const {error}=await db.from("business_settings").upsert({business_id:access.membership!.business_id,settings,updated_at:new Date().toISOString()},{onConflict:"business_id"});
  if(error)return jsonError("Could not save business settings.",500);
  await db.from("audit_events").insert({business_id:access.membership!.business_id,actor_user_id:access.user!.id,action:"business.settings.updated",entity_type:"business_settings",details:settings});
  return Response.json({settings});
 }catch{return jsonError("Could not save business settings.");}
}
