import "server-only";
import {database} from "@/lib/auth";
import {renderBrandonRvEmail} from "@/lib/email/templates.mjs";

export type EmailSender = "noreply" | "system" | "brandonrv";

type EmailInput = {
  /** Selects a matching assigned mailbox when available; never supplies an address. */
  sender: EmailSender;
  to: string;
  subject: string;
  html: string;
};

type SenderMailbox = { address?: unknown };

function mailConfig() {
  const baseUrl = process.env.ORBITFS_MAIL_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.BRANDONSRV_MAIL_API_KEY?.trim();

  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

function plainTextFromHtml(html: string) {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isEmailConfigured() {
  return mailConfig() !== null;
}

/**
 * Brandon RV owns and renders the email templates. OrbitFS Mail supplies the
 * active sender addresses assigned to this external system. A matching
 * notification mailbox is selected when available; otherwise the system's
 * default assigned sender is used.
 */
export async function sendEmail(input: EmailInput) {
  const config = mailConfig();
  if (!config) return false;

  try {
    const authHeaders = {
      Authorization: "Bearer " + config.apiKey,
      "Content-Type": "application/json",
    };

    // Resolve assignments for every send so Mail Admin changes apply immediately.
    const senderResponse = await fetch(config.baseUrl + "/api/mail/senders", {
      method: "GET",
      headers: authHeaders,
      cache: "no-store",
    });
    if (!senderResponse.ok) return false;

    const senderData = await senderResponse.json() as {
      sender?: unknown;
      senders?: SenderMailbox[];
    };
    const availableSenders = Array.isArray(senderData.senders)
      ? senderData.senders
          .map((mailbox) => typeof mailbox.address === "string"
            ? mailbox.address.trim().toLowerCase()
            : "")
          .filter((address) => /^[^\s@]+@incendiarynetworks\.cc$/i.test(address))
      : [];

    const roleSender = availableSenders.find((address) =>
      address.split("@")[0] === input.sender,
    );
    const defaultSender = typeof senderData.sender === "string"
      ? senderData.sender.trim().toLowerCase()
      : "";
    const fromAddress = roleSender || defaultSender;

    if (!/^[^\s@]+@incendiarynetworks\.cc$/i.test(fromAddress)) return false;

    const response = await fetch(config.baseUrl + "/api/mail", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        from_address: fromAddress,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: plainTextFromHtml(input.html),
      }),
      cache: "no-store",
    });

    return response.ok;
  } catch {
    return false;
  }
}


/**
 * Render and send a branded transactional email, applying business-managed
 * wording overrides when configured. Security notifications always send.
 */
export async function sendBrandonRvTemplateEmail(input:{
  templateId:string;
  sender:EmailSender;
  to:string;
  variables:Record<string,unknown>;
}) {
  let overrides:Record<string,string>={};
  try {
    const db=database();
    const {data:business}=await db.from("businesses").select("id").eq("slug","brandon-rv").single();
    if(business) {
      const {data:template}=await db.from("email_templates")
        .select("subject,title,intro,body,button_label,enabled,is_security")
        .eq("business_id",business.id).eq("template_key",input.templateId).maybeSingle();
      if(template) {
        if(!template.enabled&&!template.is_security)return true;
        overrides={
          subject:template.subject,
          title:template.title,
          intro:template.intro,
          body:template.body,
          cta:template.button_label,
        };
      }
    }
  } catch {
    // Fall back to the bundled branded template if the optional overrides are unavailable.
  }
  const message=renderBrandonRvEmail(input.templateId,input.variables,overrides);
  return sendEmail({sender:input.sender,to:input.to,subject:message.subject,html:message.html});
}
