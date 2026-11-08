import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
import {getAvailableEmailSenders} from "@/lib/email";
export const runtime="nodejs";
const EVENTS=[
 {key:"customer.registration_verification",label:"Customer registration → verify account",security:true,template:"verify_account"},
 {key:"customer.password_reset_requested",label:"Customer requests password reset",security:true,template:"forgot_password"},
 {key:"customer.password_changed",label:"Customer password changed",security:true,template:"password_changed"},
 {key:"customer.account_activated",label:"Customer account activated → welcome",security:false,template:"welcome"},
 {key:"customer.enquiry_received",label:"Website enquiry submitted",security:false,template:"enquiry_received"},
 {key:"staff.invitation_sent",label:"Staff invitation created",security:false,template:"staff_invitation"},
] as const;
const SECURITY_EVENTS=new Set<string>(EVENTS.filter(event=>event.security).map(event=>event.key));
const clean=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);
const slug=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,64);
async function validate(body:any){
 const templateKey=slug(clean(body.template_key,64));
 const eventKey=clean(body.event_key,100);
 const event=EVENTS.find(item=>item.key===eventKey);
 const subject=clean(body.subject,180),title=clean(body.title,180),intro=clean(body.intro,500),content=clean(body.body,5000),buttonLabel=clean(body.button_label,80);
 const senderMailboxId=clean(body.sender_mailbox_id,80)||null;
 if(!event)return {error:"Select a registered system function."};
 if(!/^[a-z][a-z0-9_]{1,63}$/.test(templateKey))return {error:"Template key must use lowercase letters, numbers and underscores."};
 if(!subject||!title||!content)return {error:"Subject, heading and message body are required."};
 if(subject.length>180||title.length>180||intro.length>500||content.length>5000||buttonLabel.length>80)return {error:"One or more template fields exceed their allowed length."};
 if(senderMailboxId){
  const senders=await getAvailableEmailSenders();
  if(!senders.some(sender=>sender.id===senderMailboxId))return {error:"That sender is no longer assigned to Brandon RV in Mail System. Refresh the sender list."};
 }
 return {value:{template_key:templateKey,event_key:eventKey,subject,title,intro,body:content,button_label:buttonLabel,
   enabled:SECURITY_EVENTS.has(eventKey)?true:body.enabled!==false,is_security:SECURITY_EVENTS.has(eventKey),sender_mailbox_id:senderMailboxId}};
}
export async function GET(){
 const access=await authorizePermission("business.settings.manage");if(access.response)return access.response;
 const db=database();
 const [{data,error},senders]=await Promise.all([
  db.from("email_templates").select("id,template_key,event_key,subject,title,intro,body,button_label,enabled,is_security,sender_mailbox_id,updated_at").eq("business_id",access.membership!.business_id).order("updated_at",{ascending:false}),
  getAvailableEmailSenders(),
 ]);
 if(error)return jsonError("Could not load email templates. Apply the email-template management migration first.",500);
 return Response.json({templates:data??[],events:EVENTS,senders});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("business.settings.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const checked=await validate(body);if(!checked.value)return jsonError(checked.error??"Invalid email template.");
  const db=database();
  const {data:template,error}=await db.from("email_templates").insert({...checked.value,business_id:access.membership!.business_id})
    .select("id,template_key,event_key,subject,title,intro,body,button_label,enabled,is_security,sender_mailbox_id,updated_at").single();
  if(error)return jsonError(error.code==="23505"?"That template key already exists. Choose another name.":"Could not create this email template.",error.code==="23505"?409:500);
  await db.from("audit_events").insert({business_id:access.membership!.business_id,actor_user_id:access.user!.id,action:"email_template.created",entity_type:"email_template",entity_id:template.id,details:{template_key:template.template_key,event_key:template.event_key}});
  return Response.json({template},{status:201});
 }catch{return jsonError("Could not create email template.");}
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("business.settings.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const id=String(body.id??"");
  if(!/^[0-9a-f-]{36}$/i.test(id))return jsonError("Invalid email template.");
  const db=database();
  const {data:existing}=await db.from("email_templates").select("id,event_key,is_security").eq("id",id).eq("business_id",access.membership!.business_id).maybeSingle();
  if(!existing)return jsonError("Email template not found.",404);
  const checked=await validate(body);if(checked.error)return jsonError(checked.error);
  if(existing.is_security&&checked.value.event_key!==existing.event_key)return jsonError("Security templates cannot be reassigned to another function.");
  const {data:template,error}=await db.from("email_templates").update({...checked.value,updated_at:new Date().toISOString()})
    .eq("id",id).eq("business_id",access.membership!.business_id)
    .select("id,template_key,event_key,subject,title,intro,body,button_label,enabled,is_security,sender_mailbox_id,updated_at").maybeSingle();
  if(error||!template)return jsonError(error?.code==="23505"?"That template key already exists.":"Could not save this email template.",error?.code==="23505"?409:500);
  await db.from("audit_events").insert({business_id:access.membership!.business_id,actor_user_id:access.user!.id,action:"email_template.updated",entity_type:"email_template",entity_id:id,details:{template_key:template.template_key,event_key:template.event_key,enabled:template.enabled}});
  return Response.json({template});
 }catch{return jsonError("Could not save email template.");}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("business.settings.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const id=String(body.id??"");
  if(!/^[0-9a-f-]{36}$/i.test(id))return jsonError("Invalid email template.");
  const db=database();
  const {data:existing}=await db.from("email_templates").select("id,template_key,event_key,is_security").eq("id",id).eq("business_id",access.membership!.business_id).maybeSingle();
  if(!existing)return jsonError("Email template not found.",404);
  if(existing.is_security||SECURITY_EVENTS.has(existing.event_key))return jsonError("Required account-security templates cannot be deleted.");
  const {error}=await db.from("email_templates").delete().eq("id",id).eq("business_id",access.membership!.business_id);
  if(error)return jsonError("Could not delete this email template.",500);
  await db.from("audit_events").insert({business_id:access.membership!.business_id,actor_user_id:access.user!.id,action:"email_template.deleted",entity_type:"email_template",entity_id:id,details:{template_key:existing.template_key,event_key:existing.event_key}});
  return Response.json({ok:true});
 }catch{return jsonError("Could not delete email template.");}
}
