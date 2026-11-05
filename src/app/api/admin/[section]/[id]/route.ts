import {currentUser,currentMembership,database,userHasPermission,jsonError,sameOrigin} from "@/lib/auth";
import {sendEmail} from "@/lib/email";
export const runtime="nodejs";
const config:any={
 enquiries:{table:"enquiries",permission:"enquiries.manage",status:["new","reviewing","quoted","accepted","declined","converted","closed"],fields:["status","internal_notes"]},
 appointments:{table:"appointments",permission:"appointments.manage",status:["requested","confirmed","rescheduled","completed","cancelled"],fields:["status","starts_at","ends_at","location","internal_notes"]},
 jobs:{table:"jobs",permission:"jobs.manage",status:["scheduled","in_progress","waiting_parts","completed","cancelled"],fields:["status","priority","scheduled_start","scheduled_end","customer_visible_notes","internal_notes","estimated_hours"]},
 quotes:{table:"quotes",permission:"quotes.manage",status:["draft","sent","expired"],fields:["status"]},
 invoices:{table:"invoices",permission:"invoices.manage",status:["draft","issued","void"],fields:["status"]},
 customers:{table:"customers",permission:"customers.manage",status:["active","inactive"],fields:["status"]},
 suppliers:{table:"suppliers",permission:"suppliers.manage",fields:["is_active","notes"]},
 website:{table:"site_pages",permission:"website.manage",fields:["is_published"]}
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
   else if(field==="estimated_hours"){const n=Number(value);if(!Number.isFinite(n)||n<0||n>1000)return jsonError("Enter valid estimated hours.");update[field]=n;}
   else if(field==="priority"){if(!["low","normal","high","urgent"].includes(String(value)))return jsonError("Invalid priority.");update[field]=String(value);}
   else if(typeof value==="string")update[field]=value.trim().slice(0,5000)||null;
  }
  if(!Object.keys(update).length)return jsonError("No valid changes supplied.");
  if(section==="quotes"&&update.status==="sent")update.issue_date=new Date().toISOString().slice(0,10);
  update.updated_at=new Date().toISOString();
  const db=database();const {data:record,error}=await db.from(c.table).update(update).eq("id",id).eq("business_id",membership.business_id).select("id").maybeSingle();
  if(error||!record)return jsonError("Could not update record. Check the record and your permissions.",500);
  await db.from("audit_events").insert({business_id:membership.business_id,actor_user_id:user.id,action:section+".updated",entity_type:section,entity_id:id,details:update});
  let emailSent=false;
  if(section==="quotes"&&update.status==="sent"){
   const {data:quote}=await db.from("quotes").select("quote_number,total,customers(full_name,email)").eq("id",id).maybeSingle();
   const customer=(quote?.customers as any)??null;
   if(customer?.email){const safeName=String(customer.full_name??"Customer").replace(/[&<>"]/g,"");const base=process.env.NEXT_PUBLIC_APP_URL??new URL(request.url).origin;emailSent=await sendEmail({to:customer.email,subject:"Your Brandon RV quote "+quote.quote_number,html:"<p>Hi "+safeName+",</p><p>Your Brandon RV quote "+quote.quote_number+" is ready for review.</p><p>Quote total: <strong>$"+Number(quote.total).toFixed(2)+" AUD</strong></p><p>Sign in to your customer portal to review and respond: <a href=\""+base+"/portal/quotes\">View your quote</a></p><p>Work is not booked until Brandon RV confirms scheduling.</p>"});}
  }
  if(section==="invoices"&&update.status==="issued"){
   const {data:invoice}=await db.from("invoices").select("invoice_number,total,due_date,customers(full_name,email)").eq("id",id).maybeSingle();
   const customer=(invoice?.customers as any)??null;
   if(customer?.email){const safeName=String(customer.full_name??"Customer").replace(/[&<>"]/g,"");const base=process.env.NEXT_PUBLIC_APP_URL??new URL(request.url).origin;emailSent=await sendEmail({to:customer.email,subject:"Your Brandon RV invoice "+invoice.invoice_number,html:"<p>Hi "+safeName+",</p><p>Your Brandon RV invoice "+invoice.invoice_number+" has been issued.</p><p>Amount due: <strong>$"+Number(invoice.total).toFixed(2)+" AUD</strong></p><p>Due date: "+(invoice.due_date??"As shown on your invoice")+"</p><p>View your invoice in the customer portal: <a href=\""+base+"/portal/invoices\">View invoices</a></p>"});}
  }
  return Response.json({success:true,emailSent});
 }catch{return jsonError("Could not update record.",500);}
}