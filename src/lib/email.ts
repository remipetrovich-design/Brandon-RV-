import "server-only";

export type EmailSender = "noreply" | "system" | "brandonrv";

type EmailInput = {
  /** Retained as the notification category; the actual From address comes from Mail Admin. */
  sender: EmailSender;
  to: string;
  subject: string;
  html: string;
};

function mailConfig() {
  const baseUrl = process.env.ORBITFS_MAIL_URL?.trim().replace(/\\/+$/, "");
  const apiKey = process.env.BRANDONSRV_MAIL_API_KEY?.trim();

  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

function plainTextFromHtml(html: string) {
  return html
    .replace(/<\\s*br\\s*\\/?>/gi, "\\n")
    .replace(/<\\/(p|div|h[1-6]|li)>/gi, "\\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \\t]+\\n/g, "\\n")
    .replace(/\\n{3,}/g, "\\n\\n")
    .trim();
}

export function isEmailConfigured() {
  return mailConfig() !== null;
}

/**
 * Brandon RV owns and renders the email templates. OrbitFS Mail supplies the
 * active sender address assigned to this external system; no From address is
 * duplicated or hardcoded in the Brandon RV application.
 */
export async function sendEmail(input: EmailInput) {
  const config = mailConfig();
  if (!config) return false;

  try {
    const authHeaders = {
      Authorization: "Bearer " + config.apiKey,
      "Content-Type": "application/json",
    };

    // Resolve the current sender assignment on every send so mailbox changes
    // in Mail Admin take effect immediately without a Brandon RV redeploy.
    const senderResponse = await fetch(config.baseUrl + "/api/mail/senders", {
      method: "GET",
      headers: authHeaders,
      cache: "no-store",
    });
    if (!senderResponse.ok) return false;

    const senderData = await senderResponse.json() as { sender?: unknown };
    const fromAddress = typeof senderData.sender === "string"
      ? senderData.sender.trim().toLowerCase()
      : "";
    if (!/^[^\\s@]+@incendiarynetworks\\.cc$/i.test(fromAddress)) return false;

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
