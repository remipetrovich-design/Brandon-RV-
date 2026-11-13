import {currentUser,currentMembership,database,userHasPermission,jsonError,sameOrigin} from "@/lib/auth";
import {sendEmail} from "@/lib/email";
import {bookingTravelBuffer,validateBookingWindow} from "@/lib/booking-rules";
export const runtime="nodejs";
const config:any={
 enquiries:{table:"enquiries",permission:"enquiries.manage",status:["new","reviewing","quoted","accepted","declined","converted","closed"],fields:["status","internal_notes"]},
 appointments:{table:"appointments",permission:"appointments.manage",status:["requested","confirmed","rescheduled","completed","cancelled"],fields:["status","starts_at","ends_at","location","internal_notes"]},
 jobs:{table:"jobs",permission:"jobs.manage",status:["pending","scheduled","waiting_parts","cancelled"],fields:["status","priority","scheduled_start","scheduled_end","customer_visible_notes","internal_notes","estimated_hours"]},
 quotes:{table:"quotes",permission:"quotes.manage",status:["draft","sent","expired"],fields:["status"]},
 invoices:{table:"invoices",permission:"invoices.manage",status:["draft","issued","void"],fields:["status"]},
 customers:{table:"customers",permission:"customers.manage",status:["active","inactive"],fields:["status"]},
 suppliers:{table:"suppliers",permission:"suppliers.manage",fields:["is_active","notes"]},
 website:{table:"site_pages",permission:"website.manage",fields:["is_published","title","content","meta_title","meta_description"]}
};
export async function PATCH(request:Request,{params}:{params:Promise<{section:string;id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const user=await currentUser();if(!user)return jsonError("Not signed in.",401);const membership=await currentMembership(user.id);if(!membership)return jsonError("Business access required.",403);
 const {section,id}=await params;const c=config[section];if(!c||!/^[0-9a-f-]{36}$/i.test(id))return jsonError("Record not found.",404);
 if(!(await userHasPermission(user.id,c.permission)))return jsonError("You do not have permission to update this record.",403);
 try{
  const body=await request.json();const update:any={};
  for(const field of c.fields){if(body[field]===undefined)continue;const value=body[field];
   if(field==="status"){if(!c.status?.includes(String(value)))return jsonError("Invalid status.");update.status=String(value);}
   else if(field==="is_active"||field==="is_published"){if(typeof value!=="boolean")return jsonError("Invalid setting.");update[field]=value;}
   else if(["starts_at","ends_at","scheduled_start","scheduled_end"].includes(field)){if(value!==null&&!Number.isFinite(Date.parse(String(value))))return jsonError("Enter a valid date and time.");update[field]=value?new Date(String(value)).toISOString():null;}
   else if(field==="content"){if(!value||typeof value!=="object"||Array.isArray(value)||JSON.stringify(value).length>30000)return jsonError("Page content must be a JSON object under 30 KB.");update.content=value;}
   else if(field==="estimated_hours"){const n=Number(value);if(!Number.isFinite(n)||n<0||n>1000)return jsonError("Enter valid estimated hours.");update[field]=n;}
   else if(field==="priority"){if(!["low","normal","high","urgent"].includes(String(value)))return jsonError("Invalid priority.");update[field]=String(value);}
   else if(typeof value==="string")update[field]=value.trim().slice(0,5000)||null;
  }
  if(!Object.keys(update).length)return jsonError("No valid changes supplied.");
  const db=database();
  let quoteIssued=false;
  if(section==="quotes"&&update.status==="sent"){
   const {data:issued,error:issueError}=await db.rpc("issue_quote_for_jobcard",{p_quote_id:id,p_business_id:membership.business_id,p_actor_user_id:user.id});
   if(issueError){if(issueError.code==="P0001")return jsonError("This quote or Jobcard is no longer available for issue.",409);return jsonError("Could not issue quote. No changes were made.",500);}
   if(!issued?.success)return jsonError("Could not confirm quote issue. No changes were made.",500);
   quoteIssued=true;
  }
  let appointment:any=null;let quote:any=null;let linkedWorkcard:any=null;
  if(section==="appointments"&&["confirmed","rescheduled"].includes(String(update.status??""))){
   const result=await db.from("appointments").select("id,business_id,customer_id,user_id,quote_id,location,starts_at,ends_at,preferred_start,preferred_end,guest_name,guest_email,confirmed_by,confirmed_at,updated_at").eq("id",id).eq("business_id",membership.business_id).maybeSingle();
   appointment=result.data;
   if(result.error||!appointment)return jsonError("Could not load the appointment.",404);
   const startsAt=new Date(String(update.starts_at??appointment.starts_at??appointment.preferred_start??""));
   const endsAt=new Date(String(update.ends_at??appointment.ends_at??appointment.preferred_end??""));
   const location=String(update.location??appointment.location??"").trim();
   if(!location||!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())||endsAt<=startsAt)return jsonError("Set the agreed date, start time, finish time and service location.");
   if(appointment.quote_id){
    const quoteResult=await db.from("quotes").select("id,quote_number,status,enquiry_id").eq("id",appointment.quote_id).eq("business_id",membership.business_id).maybeSingle();quote=quoteResult.data;
    if(!quote||quote.status!=="accepted")return jsonError("The linked quote must be accepted before confirming this booking.",409);
    const byQuote=await db.from("jobs").select("id,job_number,appointment_id,status").eq("business_id",membership.business_id).eq("quote_id",quote.id).maybeSingle();
    linkedWorkcard=byQuote.data;
   }else{
    const byAppointment=await db.from("jobs").select("id,job_number,appointment_id,status").eq("business_id",membership.business_id).eq("appointment_id",id).maybeSingle();
    linkedWorkcard=byAppointment.data;
   }
   if(!linkedWorkcard)return jsonError("Create the Workcard from the accepted quote before confirming its booking.",409);
   if(linkedWorkcard.appointment_id&&linkedWorkcard.appointment_id!==id)return jsonError("This Workcard is already linked to another appointment.",409);
   const {data:settingsRow}=await db.from("business_settings").select("settings").eq("business_id",membership.business_id).maybeSingle();
   const settings=settingsRow?.settings&&typeof settingsRow.settings==="object"?settingsRow.settings:{};
   const policyError=validateBookingWindow(startsAt,endsAt,settings);if(policyError)return jsonError(policyError,409);
   const buffer=bookingTravelBuffer(settings),bufferedStart=new Date(startsAt.getTime()-buffer*60000).toISOString(),bufferedEnd=new Date(endsAt.getTime()+buffer*60000).toISOString();
   const {data:conflicts,error:conflictError}=await db.from("appointments").select("id").eq("business_id",membership.business_id).neq("id",id).in("status",["confirmed","rescheduled"]).not("starts_at","is",null).lt("starts_at",bufferedEnd).gt("ends_at",bufferedStart).limit(1);
   if(conflictError)return jsonError("Could not verify calendar availability.",500);
   if(conflicts?.length)return jsonError("That time conflicts with another booking or its travel buffer.",409);
   update.starts_at=startsAt.toISOString();update.ends_at=endsAt.toISOString();update.location=location;
   if(update.status==="confirmed"){update.confirmed_by=user.id;update.confirmed_at=new Date().toISOString();}
  }
  update.updated_at=new Date().toISOString();
  let record:any={id};
  if(!quoteIssued){
   const result=await db.from(c.table).update(update).eq("id",id).eq("business_id",membership.business_id).select("id").maybeSingle();
   if(result.error||!result.data)return jsonError("Could not update record. Check the record and your permissions.",500);
   record=result.data;
   await db.from("audit_events").insert({business_id:membership.business_id,actor_user_id:user.id,action:section+".updated",entity_type:section,entity_id:id,details:update});
  }
  let workcardLinked=false;
  if(section==="appointments"&&linkedWorkcard){
   const scheduleUpdate:any={appointment_id:id,scheduled_start:update.starts_at,scheduled_end:update.ends_at,updated_at:new Date().toISOString()};
   if(linkedWorkcard.status==="pending")scheduleUpdate.status="scheduled";
   const {error:workcardError}=await db.from("jobs").update(scheduleUpdate).eq("id",linkedWorkcard.id).eq("business_id",membership.business_id);
   if(workcardError){
    await db.from("appointments").update({status:appointment.status,starts_at:appointment.starts_at,ends_at:appointment.ends_at,location:appointment.location,confirmed_by:appointment.confirmed_by??null,confirmed_at:appointment.confirmed_at??null,updated_at:appointment.updated_at??new Date().toISOString()}).eq("id",id).eq("business_id",membership.business_id);
    return jsonError("Appointment was not changed because its Workcard schedule could not be updated.",500);
   }
   workcardLinked=true;
   await db.from("audit_events").insert({business_id:membership.business_id,actor_user_id:user.id,action:"workcard.booking_synced_from_calendar",entity_type:"job",entity_id:linkedWorkcard.id,details:{appointment_id:id,starts_at:update.starts_at,ends_at:update.ends_at,location:update.location}});
  }
  if(section==="appointments"&&update.status==="cancelled"){
   const {data:workcard}=await db.from("jobs").select("id,status").eq("business_id",membership.business_id).eq("appointment_id",id).maybeSingle();
   if(workcard){
    await db.from("jobs").update({scheduled_start:null,scheduled_end:null,status:workcard.status==="scheduled"?"pending":workcard.status,updated_at:new Date().toISOString()}).eq("id",workcard.id).eq("business_id",membership.business_id);
   }
  }
  let emailSent=false;
  if(section==="quotes"&&update.status==="sent"){
   const {data:quoteRecord}=await db.from("quotes").select("quote_number,total,customer_id,user_id,enquiry_id").eq("id",id).maybeSingle();
   let customer:any=null;if(quoteRecord?.user_id){const result=await db.from("users").select("full_name,email").eq("id",quoteRecord.user_id).maybeSingle();customer=result.data;}else if(quoteRecord?.customer_id){const result=await db.from("customers").select("full_name,email").eq("id",quoteRecord.customer_id).eq("business_id",membership.business_id).maybeSingle();customer=result.data;}else if(quoteRecord?.enquiry_id){const result=await db.from("enquiries").select("contact_name,email").eq("id",quoteRecord.enquiry_id).eq("business_id",membership.business_id).maybeSingle();customer=result.data;}
   if(quoteRecord&&customer?.email){
    const safeName=String(customer.full_name??customer.contact_name??"Customer").replace(/[&<>"]/g,"");
    const base=process.env.NEXT_PUBLIC_APP_URL??new URL(request.url).origin;
    const quoteUrl=quoteRecord.enquiry_id&&!quoteRecord.customer_id?base+"/request-status":base+"/portal/quotes";
    const guestNote=quoteRecord.enquiry_id&&!quoteRecord.customer_id?"Use the secure Request Quote link and access code from your original confirmation email. ":"";
    emailSent=await sendEmail({sender:"brandonrv",to:customer.email,subject:"Your Brandon RV quote "+quoteRecord.quote_number,html:`<p>Hi ${safeName},</p><p>Your Brandon RV quote ${quoteRecord.quote_number} is ready for review.</p><p>Quote total: <strong>$${Number(quoteRecord.total).toFixed(2)} AUD</strong></p><p>${guestNote}<a href="${quoteUrl}">View your quote</a></p><p>Work is not booked until Brandon RV confirms scheduling.</p>`});
   }
  }
  if(section==="invoices"&&update.status==="issued"){
   const {data:invoice}=await db.from("invoices").select("invoice_number,total,due_date,customer_id").eq("id",id).maybeSingle();
   const {data:customer}=invoice?.customer_id?await db.from("users").select("full_name,email").eq("id",invoice.customer_id).maybeSingle():{data:null};
   if(invoice&&customer?.email){
    const safeName=String(customer.full_name??"Customer").replace(/[&<>"]/g,"");
    const base=process.env.NEXT_PUBLIC_APP_URL??new URL(request.url).origin;
    emailSent=await sendEmail({sender:"brandonrv",to:customer.email,subject:"Your Brandon RV invoice "+invoice.invoice_number,html:`<p>Hi ${safeName},</p><p>Your Brandon RV invoice ${invoice.invoice_number} has been issued.</p><p>Amount due: <strong>$${Number(invoice.total).toFixed(2)} AUD</strong></p><p>Due date: ${invoice.due_date??"As shown on your invoice"}</p><p>View your invoice in the customer portal: <a href="${base}/portal/invoices">View invoices</a></p>`});
   }
  }
  return Response.json({success:true,emailSent,workcardLinked});
 }catch{return jsonError("Could not update record.",500);}
}