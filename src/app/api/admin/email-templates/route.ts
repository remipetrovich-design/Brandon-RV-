import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
const SECURITY_KEYS=new Set(["verify_account","forgot_password","password_changed"]);
const ALLOWED_KEYS=new Set(["verify_account","forgot_password","password_changed","welcome","enquiry_received"]);
export async function GET(){
 const access=await authorizePermission("business.settings.manage");if(access.response)return access.response;
 const {data,error}=await database().from("email_templates").select("id,template_key,subject,title,intro,body,button_label,enabled,is_security,updated_at").eq("business_id",access.membership!.business_id).order("template_key");
 if(error)return jsonError("Could not load email templates. Apply the email-template database migration first.",500);
 return Response.json({templates:data??[]});
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("business.settings.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const key=String(body.template_key??"");
  if(!ALLOWED_KEYS.has(key))return jsonError("Unknown email template.");
  const subject=String(body.subject??"").trim();const title=String(body.title??"").trim();const intro=String(body.intro??"").trim();const content=String(body.body??"").trim();const buttonLabel=String(body.button_label??"").trim();
  if(!subject||subject.length>180||!title||title.length>180||intro.length>500||!content||content.length>5000||buttonLabel.length>80)return jsonError("Check the subject, heading, introduction, message and button label lengths.");
  const enabled=SECURITY_KEYS.has(key)?true:body.enabled!==false;
  const db=database();const {data:template,error}=await db.from("email_templates").update({subject,title,intro,body:content,button_label:buttonLabel,enabled,is_security:SECURITY_KEYS.has(key),updated_at:new Date().toISOString()}).eq("business_id",access.membership!.business_id).eq("template_key",key).select("id,template_key,subject,title,intro,body,button_label,enabled,is_security,updated_at").maybeSingle();
  if(error||!template)return jsonError("Could not save this email template. Confirm the database migration has been applied.",500);
  await db.from("audit_events").insert({business_id:access.membership!.business_id,actor_user_id:access.user!.id,action:"email_template.updated",entity_type:"email_template",entity_id:template.id,details:{template_key:key,enabled}});
  return Response.json({template});
 }catch{return jsonError("Could not save email template.");}
}
