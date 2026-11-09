import {currentUser,currentMembership,database,userHasPermission,jsonError,sameOrigin} from "@/lib/auth";
import {sendEmail} from "@/lib/email";
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
  if(section==="quotes"&&update.status==="sent")update.issue_date=new Date().toISOString().slice(0,10);
  const db=database();
  let appointment:any=null;let quote:any=null;
  if(section==="appointments"&&update.status==="confirmed"){
   const result=await db.from("appointments").select("id,business_id,customer_id,user_id,quote_id,location,starts_at,ends_at,preferred_start,preferred_end,guest_name,guest_email").eq("id",id).eq("business_id",membership.business_id).maybeSingle();appointment=result.data;
   if(!appointment||!appointment.quote_id)return jsonError("A confirmed booking must be linked to an accepted quote.",409);
   if(!update.starts_at)update.starts_at=appointment.starts_at??appointment.preferred_start;
   if(!update.ends_at)update.ends_at=appointment.ends_at??appointment.preferred_end;
   if(!update.location)update.location=appointment.location;
   if(!update.starts_at||!update.ends_at||!update.location||Date.parse(update.ends_at)<=Date.parse(update.starts_at))return jsonError("Set the agreed date, start time, end time and service location before confirming.");
   const quoteResult=await db.from("quotes").select("id,quote_number,status,enquiry_id").eq("id",appointment.quote_id).eq("business_id",membership.business_id).maybeSingle();quote=quoteResult.data;
   if(!quote||quote.status!=="accepted")return jsonError("The linked quote must be accepted before a booking can be confirmed.",409);
   update.confirmed_by=user.id;update.confirmed_at=new Date().toISOString();
  }
  update.updated_at=new Date().toISOString();
  const {data:record,error}=await db.from(c.table).update(update).eq("id",id).eq("business_id",membership.business_id).select("id").maybeSingle();
  if(error||!record)return jsonError("Could not update record. Check the record and your permissions.",500);
  await db.from("audit_events").insert({business_id:membership.business_id,actor_user_id:user.id,action:section+".updated",entity_type:section,entity_id:id,details:update});
  let jobCreated=false;
  if(section==="appointments"&&update.status==="confirmed"&&appointment&&quote){
   const {data:existingJob}=await db.from("jobs").select("id").eq("appointment_id",id).maybeSingle();
   if(!existingJob){
    const {data:items}=await db.from("quote_items").select("description").eq("quote_id",quote.id).order("sort_order");
    const title=items?.[0]?.description??("Work for quote "+quote.quote_number);
    const {data:job,error:jobError}=await db.from("jobs").insert({business_id:membership.business_id,customer_id:appointment.customer_id,user_id:appointment.user_id,guest_name:appointment.guest_name??null,guest_email:appointment.guest_email??null,appointment_id:id,quote_id:quote.id,job_number:"BRV-"+Date.now().toString(36).toUpperCase(),title,scope_of_work:(items??[]).map((x:any)=>x.description).join("\\n"),status:"pending",scheduled_start:update.starts_at,scheduled_end:update.ends_at}).select("id,job_number").single();
    if(jobError||!job){await db.from("appointments").update({status:"requested",confirmed_by:null,confirmed_at:null,updated_at:new Date().toISOString()}).eq("id",id);return jsonError("Booking could not be confirmed because its Work Order could not be created.",500);}
    jobCreated=true;await db.from("audit_events").insert({business_id:membership.business_id,actor_user_id:user.id,action:"work_order.created_from_booking",entity_type:"job",entity_id:job.id,details:{job_number:job.job_number,appointment_id:id,quote_id:quote.id}});
   }
  }
  let emailSent=false;
  if(section==="quotes"&&update.status==="sent"){
   const {data:quoteRecord}=await db.from("quotes").select("quote_number,total,customer_id,enquiry_id").eq("id",id).maybeSingle();
   let customer:any=null;if(quoteRecord?.customer_id){const result=await db.from("users").select("full_name,email").eq("id",quoteRecord.customer_id).maybeSingle();customer=result.data;}else if(quoteRecord?.enquiry_id){const result=await db.from("enquiries").select("contact_name,email").eq("id",quoteRecord.enquiry_id).maybeSingle();customer=result.data;}
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
  return Response.json({success:true,emailSent,jobCreated});
 }catch{return jsonError("Could not update record.",500);}
}