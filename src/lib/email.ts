import "server-only";
import {database} from "@/lib/auth";

export type EmailSender = "noreply" | "system" | "brandonrv";
type EmailInput = {sender:EmailSender;to:string;subject:string;html:string};
export type EmailTemplateKey = "account_verification" | "password_reset" | "welcome" | "enquiry_received";
const SENDER_ADDRESSES:Record<EmailSender,string>={noreply:"noreply@incendiarynetworks.cc",system:"system@incendiarynetworks.cc",brandonrv:"brandonrv@incendiarynetworks.cc"};
const DEFAULT_TEMPLATES:Record<EmailTemplateKey,{subject:string;body:string;button_label:string;security:boolean}>={
 account_verification:{subject:"Verify your Brandon RV account",body:"Hi {name},\n\nConfirm your email address to activate your Brandon RV customer account.\n\nThis link expires in 24 hours. If you did not create this account, ignore this email.",button_label:"Verify email address",security:true},
 password_reset:{subject:"Reset your Brandon RV password",body:"Hi {name},\n\nUse the link below to reset your password. It expires in one hour.\n\nIf you did not request this, ignore this email.",button_label:"Reset password",security:true},
 welcome:{subject:"Your Brandon RV account is ready",body:"Hi {name},\n\nYour email address has been verified and your Brandon RV customer account is now active.",button_label:"Open customer account",security:false},
 enquiry_received:{subject:"We received your Brandon RV enquiry",body:"Hi {name},\n\nThanks for contacting Brandon RV. Your enquiry has been received and will be reviewed. We will contact you to discuss the next steps.",button_label:"View customer account",security:false}
};
function mailConfig(){const baseUrl=process.env.ORBITFS_MAIL_URL?.trim().replace(/\/+$/,"");const apiKey=process.env.BRANDONSRV_MAIL_API_KEY?.trim();if(!baseUrl||!apiKey)return null;return {baseUrl,apiKey};}
function plainTextFromHtml(html:string){return html.replace(/<\s*br\s*\/?>/gi,"\n").replace(/<\/(p|div|h[1-6]|li)>/gi,"\n").replace(/<[^>]*>/g,"").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();}
const escapeHtml=(value:string)=>value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
export function isEmailConfigured(){return mailConfig()!==null;}
export async function sendEmail(input:EmailInput){const config=mailConfig();if(!config)return false;try{const response=await fetch(config.baseUrl+"/api/mail",{method:"POST",headers:{Authorization:"Bearer "+config.apiKey,"Content-Type":"application/json"},body:JSON.stringify({from_address:SENDER_ADDRESSES[input.sender],to:input.to,subject:input.subject,html:input.html,text:plainTextFromHtml(input.html)}),cache:"no-store"});return response.ok;}catch{return false;}}
export async function sendTemplateEmail(input:{key:EmailTemplateKey;to:string;name:string;buttonUrl:string}) {
 const fallback=DEFAULT_TEMPLATES[input.key];let template=fallback;
 try{
  const db=database();const {data:business}=await db.from("businesses").select("id").eq("slug","brandon-rv").single();
  if(business){const {data:stored}=await db.from("email_templates").select("subject,body,button_label,enabled,is_security").eq("business_id",business.id).eq("template_key",input.key).maybeSingle();if(stored){if(!stored.enabled&&!fallback.security)return true;template={subject:stored.subject,body:stored.body,button_label:stored.button_label,security:fallback.security};}}
 }catch{/* Use the built-in template if template storage is not available. */}
 const values:Record<string,string>={name:input.name};
 const interpolate=(value:string)=>value.replace(/\{([a-z_]+)\}/g,(_match,key:string)=>values[key]??"");
 const subject=interpolate(template.subject).replace(/[\r\n]/g," ").slice(0,180);
 const body=interpolate(template.body).split(/\n\s*\n/).map(part=>"<p>"+escapeHtml(part).replace(/\n/g,"<br>")+"</p>").join("");
 const button=template.button_label?'<p><a href="'+escapeHtml(input.buttonUrl)+'" style="display:inline-block;padding:12px 18px;background:#172d3b;color:#fff;text-decoration:none;border-radius:6px">'+escapeHtml(template.button_label)+'</a></p>':"";
 return sendEmail({sender:"noreply",to:input.to,subject,html:body+button});
}
