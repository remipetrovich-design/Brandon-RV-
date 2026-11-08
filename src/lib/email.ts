import "server-only";
import {database} from "@/lib/auth";
import {renderBrandonRvEmail} from "@/lib/email/templates.mjs";

export type EmailSender = "noreply" | "system" | "brandonrv";
export type EmailSenderMailbox = {id:string;address:string};
type EmailInput = {sender:EmailSender;senderMailboxId?:string|null;to:string;subject:string;html:string};
type SenderResponse = {sender?:unknown;senders?:Array<{id?:unknown;address?:unknown}>};

function mailConfig() {
  const baseUrl=process.env.ORBITFS_MAIL_URL?.trim().replace(/\/+$/,"");
  const apiKey=process.env.BRANDONSRV_MAIL_API_KEY?.trim();
  if(!baseUrl||!apiKey)return null;
  return {baseUrl,apiKey};
}

function plainTextFromHtml(html:string) {
  return html.replace(/<\s*br\s*\/?>/gi,"\n").replace(/<\/(p|div|h[1-6]|li)>/gi,"\n")
    .replace(/<[^>]*>/g,"").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&")
    .replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"')
    .replace(/&#39;/gi,"'").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
}

async function senderDirectory() {
  const config=mailConfig();if(!config)return null;
  const response=await fetch(config.baseUrl+"/api/mail/senders",{method:"GET",headers:{Authorization:"Bearer "+config.apiKey,"Content-Type":"application/json"},cache:"no-store"});
  if(!response.ok)throw new Error("Could not load assigned Mail System senders.");
  return await response.json() as SenderResponse;
}

/** Live mailbox assignments supplied by the Brandon RV external system in OrbitFS Mail. */
export async function getAvailableEmailSenders():Promise<EmailSenderMailbox[]> {
  try {
    const data=await senderDirectory();
    return (data?.senders??[]).flatMap((item)=>{
      const id=typeof item.id==="string"?item.id:"";
      const address=typeof item.address==="string"?item.address.trim().toLowerCase():"";
      return id&&address.includes("@")&&address.includes(".")?[{id,address}]:[];
    });
  } catch {return [];}
}

export function isEmailConfigured(){return mailConfig()!==null;}

export async function sendEmail(input:EmailInput) {
  const config=mailConfig();if(!config)return false;
  try {
    const data=await senderDirectory();if(!data)return false;
    const available=(data.senders??[]).flatMap((item)=>{
      const id=typeof item.id==="string"?item.id:"";
      const address=typeof item.address==="string"?item.address.trim().toLowerCase():"";
      return id&&address.includes("@")&&address.includes(".")?[{id,address}]:[];
    });
    let fromAddress="";
    if(input.senderMailboxId) {
      fromAddress=available.find((item)=>item.id===input.senderMailboxId)?.address??"";
      if(!fromAddress)return false;
    } else {
      const roleSender=available.find((item)=>item.address.split("@")[0]===input.sender)?.address??"";
      const defaultSender=typeof data.sender==="string"?data.sender.trim().toLowerCase():"";
      fromAddress=roleSender||defaultSender;
    }
    if(!fromAddress.includes("@")||!fromAddress.includes("."))return false;
    const response=await fetch(config.baseUrl+"/api/mail",{method:"POST",headers:{Authorization:"Bearer "+config.apiKey,"Content-Type":"application/json"},body:JSON.stringify({from_address:fromAddress,to:input.to,subject:input.subject,html:input.html,text:plainTextFromHtml(input.html)}),cache:"no-store"});
    return response.ok;
  } catch {return false;}
}

const EVENT_ALIASES:Record<string,string>={
  verify_account:"customer.registration_verification",
  forgot_password:"customer.password_reset_requested",
  password_changed:"customer.password_changed",
  welcome:"customer.account_activated",
  enquiry_received:"customer.enquiry_received",
  staff_invitation:"staff.invitation_sent",
};

/** Render and send every enabled template attached to the matching system event. */
export async function sendBrandonRvTemplateEmail(input:{
  templateId:string;sender:EmailSender;to:string;variables:Record<string,unknown>;
}) {
  const eventKey=EVENT_ALIASES[input.templateId]??input.templateId;
  try {
    const db=database();
    const {data:business}=await db.from("businesses").select("id").eq("slug","brandon-rv").single();
    if(business) {
      const {data:templates,error}=await db.from("email_templates")
        .select("template_key,event_key,subject,title,intro,body,button_label,enabled,is_security,sender_mailbox_id")
        .eq("business_id",business.id).eq("event_key",eventKey);
      if(!error&&templates?.length) {
        const active=templates.filter((template)=>template.enabled||template.is_security);
        const results=await Promise.all(active.map(async(template)=>{
          const message=renderBrandonRvEmail(template.template_key,{...input.variables,sender_type:input.sender},{
            subject:template.subject,title:template.title,intro:template.intro,body:template.body,cta:template.button_label,
          });
          return sendEmail({sender:input.sender,senderMailboxId:template.sender_mailbox_id,to:input.to,subject:message.subject,html:message.html});
        }));
        return results.every(Boolean);
      }
    }
  } catch {
    // If the optional template configuration is unavailable, use the bundled default.
  }
  const message=renderBrandonRvEmail(input.templateId,{...input.variables,sender_type:input.sender});
  return sendEmail({sender:input.sender,to:input.to,subject:message.subject,html:message.html});
}
