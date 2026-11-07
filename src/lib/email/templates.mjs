/**
 * Brandon RV email templates.
 *
 * This module ONLY renders email content. It does not send mail, connect to a
 * provider, trigger notifications, or implement authentication/booking logic.
 *
 * Merge vars using literal placeholders such as {firstname}, {lastname},
 * {site_name}, {site_url}, {action_url}, {booking_date}, {quote_number}.
 */
const DEFAULTS = Object.freeze({
  site_name: "Brandon RV",
  site_url: "https://brandonrv.com.au",
  logo_url: "https://brandonrv.com.au/brv-logo.webp",
  business_phone: "0407 189 087",
  business_email: "enquires@brandonrv.com.au",
  tagline: "From Factory Experience to Repairs On The Go",
  current_year: String(new Date().getFullYear()),
});

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

const safeHref = (value) => {
  try {
    const url = new URL(String(value ?? ""));
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : "#";
  } catch {
    return "#";
  }
};

const text = (value, fallback = "") => escapeHtml(value === undefined || value === null ? fallback : value);
const row = (label, key) => `<tr><td class="detail-label">${label}</td><td class="detail-value">{${key}}</td></tr>`;
const details = (...rows) => `<table class="details" role="presentation">${rows.join("")}</table>`;
const list = (key) => `{#${key}}<tr><td class="line-item">{description}</td><td class="line-qty">{quantity}</td><td class="line-amount">{amount}</td></tr>{/${key}}`;

const definitions = {
  welcome: {
    category: "CUSTOMER ACCOUNT", subject: "Welcome to {site_name}, {firstname}",
    title: "Welcome to Brandon RV",
    intro: "Hi {firstname}, your Brandon RV customer account is ready.",
    body: "Your customer portal keeps your enquiries, vehicle details, quotes, bookings, invoices and job updates together. You can return to your portal whenever you need to check progress or contact the team.",
    cta: "Open customer portal", url: "{portal_url}",
    note: "If you did not create this account, please contact us.",
  },
  verify_account: {
    category: "ACCOUNT SECURITY", subject: "Verify your {site_name} account",
    title: "Verify your email address",
    intro: "Hi {firstname},",
    body: "Please confirm your email address to finish setting up your Brandon RV account. This helps us make sure important quotes, booking updates and job information reach the right person.",
    cta: "Verify email address", url: "{verification_url}",
    note: "This verification link expires in {expiry_time}. If you did not create an account, you can ignore this email.",
  },
  forgot_password: {
    category: "ACCOUNT SECURITY", subject: "Reset your {site_name} password",
    title: "Password reset requested",
    intro: "Hi {firstname},",
    body: "We received a request to reset the password for your Brandon RV account. Use the secure button below to choose a new password.",
    cta: "Reset password", url: "{reset_url}",
    note: "This link expires in {expiry_time}. If you did not request a password reset, no action is required. Your current password will remain unchanged.",
  },
  password_changed: {
    category: "ACCOUNT SECURITY", subject: "Your {site_name} password was changed",
    title: "Your password has been changed",
    intro: "Hi {firstname},",
    body: "The password for your Brandon RV account was successfully changed.",
    note: "If you did not make this change, contact Brandon RV immediately and secure your email account.",
  },
  staff_invitation: {
    category: "TEAM INVITATION", subject: "{inviter_name} invited you to join {site_name}",
    title: "You're invited to join the Brandon RV team",
    intro: "Hi {firstname},",
    body: "{inviter_name} has invited you to join Brandon RV as {staff_role}. We're pleased to invite you into the team workspace.",
    cta: "Accept staff invitation", url: "{invitation_url}",
    note: "Your invitation expires in {expiry_time}. This invitation is intended for {email}. If you were not expecting it, contact the person who sent it before accepting.",
    extra: "Once you accept, you'll be guided through account setup and staff onboarding.",
  },
  staff_welcome: {
    category: "TEAM ONBOARDING", subject: "Welcome to the Brandon RV team, {firstname}",
    title: "Welcome aboard",
    intro: "Hi {firstname},",
    body: "Your Brandon RV staff account is ready. Your staff workspace is where you'll find the work assigned to you, job instructions, customer/site details, schedule updates and team messages.",
    cta: "Open staff workspace", url: "{staff_portal_url}",
    extra: "Before starting work, review your role, contact details, safety procedures and any training or supervision requirements assigned to you.",
  },
  staff_onboarding: {
    category: "TEAM ONBOARDING", subject: "Your Brandon RV onboarding checklist",
    title: "Your onboarding checklist",
    intro: "Hi {firstname},",
    body: "Please complete the onboarding items below before your first shift or assigned job.",
    bullets: ["Confirm your contact and emergency contact details", "Review your role and permitted duties", "Read the job safety and site assessment procedures", "Confirm required training, licences and competency records", "Review communication, customer privacy and photo-consent requirements", "Confirm how to report incidents, hazards, defects and job variations"],
    cta: "Complete onboarding", url: "{onboarding_url}",
    note: "Only accept and perform work that has been authorised for your role, is within your demonstrated competence and has the required approvals and insurance.",
  },
  staff_role_changed: {
    category: "TEAM UPDATE", subject: "Your Brandon RV staff role has been updated",
    title: "Your staff role has changed",
    intro: "Hi {firstname},",
    body: "Your Brandon RV staff role has been updated to {staff_role}. The permissions and work available in your staff workspace may have changed.",
    cta: "Review staff workspace", url: "{staff_portal_url}",
    note: "If you believe this change is incorrect, contact {manager_name}.",
  },
  staff_assignment: {
    category: "JOB ASSIGNMENT", subject: "New job assigned: {job_number}",
    title: "A job has been assigned to you",
    intro: "Hi {firstname},",
    body: "{assigned_by} has assigned you to a Brandon RV job. Review the approved scope, customer information, site conditions and instructions before confirming the assignment.",
    details: ["job_number", "customer_name", "service", "booking_date", "booking_time", "service_location"],
    cta: "View assigned job", url: "{job_url}",
    note: "Do not undertake work outside the approved scope, your authorised role or the confirmed safe working conditions. Raise scope changes before proceeding.",
  },
  staff_task_assigned: {
    category: "TASK ASSIGNMENT", subject: "New task assigned: {task_title}",
    title: "A task has been assigned to you",
    intro: "Hi {firstname},",
    body: "A new task has been assigned to you by {assigned_by}. Please review the task details and due date.",
    details: ["task_title", "job_number", "task_due_date", "priority", "assigned_by"],
    cta: "View task", url: "{task_url}",
  },
  staff_task_updated: {
    category: "TASK UPDATE", subject: "Task updated: {task_title}",
    title: "Your task has been updated",
    intro: "Hi {firstname},",
    body: "There has been an update to your assigned task. Please check the latest instructions before continuing.",
    details: ["task_title", "job_number", "task_status", "task_due_date"],
    cta: "Review task", url: "{task_url}",
    note: "Latest update: {update_message}",
  },
  staff_task_due: {
    category: "TASK REMINDER", subject: "Reminder: {task_title} is due {task_due_date}",
    title: "Task due reminder",
    intro: "Hi {firstname},",
    body: "This is a reminder that the following Brandon RV task is due.",
    details: ["task_title", "job_number", "task_due_date", "priority"],
    cta: "Open task", url: "{task_url}",
  },
  staff_announcement: {
    category: "TEAM ANNOUNCEMENT", subject: "Brandon RV team update: {announcement_title}",
    title: "{announcement_title}",
    intro: "Hi {firstname},",
    body: "{announcement_message}",
    cta: "Open staff workspace", url: "{staff_portal_url}",
  },
  enquiry_received: {
    category: "ENQUIRY RECEIVED", subject: "We've received your Brandon RV enquiry",
    title: "Thanks for getting in touch",
    intro: "Hi {firstname},",
    body: "Your enquiry has been received. The Brandon RV team will review the information and get back to you about the next step.",
    details: ["enquiry_number", "service", "vehicle", "suburb"],
    cta: "View your enquiry", url: "{enquiry_url}",
    note: "This is an acknowledgement only. It is not confirmation that the requested work is within our service scope or that an appointment has been booked.",
  },
  enquiry_admin: {
    category: "NEW CUSTOMER ENQUIRY", subject: "New enquiry from {firstname} {lastname} — {enquiry_number}",
    title: "A new customer enquiry has arrived",
    intro: "A customer has submitted an enquiry through the Brandon RV website.",
    body: "Review the request, check the supplied vehicle and job information, and confirm whether the work is within the currently approved service scope before quoting.",
    details: ["enquiry_number", "customer_name", "email", "phone", "service", "vehicle", "suburb"],
    cta: "Review enquiry", url: "{admin_enquiry_url}",
  },
  quote_created: {
    category: "QUOTE READY", subject: "Your Brandon RV quote {quote_number} is ready",
    title: "Your quote is ready",
    intro: "Hi {firstname},",
    body: "We've prepared your quote based on the information and work scope discussed. Please review the itemised details, inclusions, exclusions and any conditions before responding.",
    details: ["quote_number", "quote_date", "quote_valid_until", "vehicle", "service", "subtotal", "gst", "total"],
    cta: "Review your quote", url: "{quote_url}",
    note: "Please do not arrange work or purchase parts on the assumption that a quote is accepted. Work proceeds only after the required approval and arrangements are confirmed.",
  },
  quote_accepted_customer: {
    category: "QUOTE APPROVED", subject: "Your Brandon RV quote {quote_number} has been accepted",
    title: "Quote approval received",
    intro: "Hi {firstname},",
    body: "Thanks for approving quote {quote_number}. Your approval has been recorded. The next step is to confirm any agreed parts and freight arrangements, then arrange a suitable appointment.",
    details: ["quote_number", "total", "approved_at"],
    cta: "View approved quote", url: "{quote_url}",
  },
  quote_accepted_admin: {
    category: "CUSTOMER APPROVAL", subject: "Quote {quote_number} accepted by {firstname} {lastname}",
    title: "A customer has accepted a quote",
    intro: "A customer has approved a Brandon RV quote.",
    body: "Review the accepted revision, confirm any required parts prepayment and supplier availability, then arrange the job. Check that the approved scope and amount match the current quote revision.",
    details: ["quote_number", "customer_name", "total", "approved_at"],
    cta: "Open quote", url: "{admin_quote_url}",
  },
  quote_declined: {
    category: "QUOTE UPDATE", subject: "Your response to Brandon RV quote {quote_number}",
    title: "Your quote response has been recorded",
    intro: "Hi {firstname},",
    body: "Your response to quote {quote_number} has been recorded. If you'd like to discuss the scope, request a change or ask for a revised quote, contact the Brandon RV team.",
    cta: "View quote", url: "{quote_url}",
  },
  quote_reply_customer: {
    category: "QUOTE CONVERSATION", subject: "New message about quote {quote_number}",
    title: "There's a new message about your quote",
    intro: "Hi {firstname},",
    body: "{sender_name} has sent you a message about quote {quote_number}.",
    message: "{message_body}",
    cta: "View conversation and reply", url: "{quote_conversation_url}",
    note: "Replies are kept with the quote so the details and decisions stay together.",
  },
  quote_reply_staff: {
    category: "CUSTOMER MESSAGE", subject: "Customer replied to quote {quote_number}",
    title: "A customer has replied",
    intro: "A customer has sent a message about a quote.",
    body: "Review the message and respond through the quote conversation so the communication remains attached to the correct customer and quote.",
    details: ["quote_number", "customer_name", "email"],
    message: "{message_body}",
    cta: "Open quote conversation", url: "{admin_quote_conversation_url}",
  },
  booking_request: {
    category: "BOOKING REQUEST", subject: "Brandon RV booking request received",
    title: "We've received your booking request",
    intro: "Hi {firstname},",
    body: "Thanks for requesting an appointment. We'll review the requested time, work scope, location and availability, then contact you to confirm the booking.",
    details: ["booking_reference", "service", "vehicle", "preferred_date", "preferred_time", "service_location"],
    cta: "View booking request", url: "{booking_url}",
    note: "Your requested date and time are preferences only. Your appointment is not confirmed until Brandon RV confirms it.",
  },
  booking_admin: {
    category: "BOOKING ACTION REQUIRED", subject: "New booking request — {firstname} {lastname}",
    title: "A new booking request needs review",
    intro: "A customer has requested an appointment.",
    body: "Check the requested work, vehicle details, customer location, site suitability and availability. Confirm the scope and timing before accepting the booking.",
    details: ["booking_reference", "customer_name", "phone", "service", "vehicle", "preferred_date", "preferred_time", "service_location"],
    cta: "Review booking request", url: "{admin_booking_url}",
  },
  booking_confirmed: {
    category: "BOOKING CONFIRMED", subject: "Your Brandon RV appointment is confirmed — {booking_reference}",
    title: "Your appointment is confirmed",
    intro: "Hi {firstname},",
    body: "Your Brandon RV appointment has been confirmed. Please make sure the vehicle is available at the agreed location and that the work area is accessible, level and safe.",
    details: ["booking_reference", "service", "vehicle", "booking_date", "booking_time", "service_location", "arrival_window"],
    cta: "View appointment", url: "{booking_url}",
    note: "If site conditions change or the work area is not safe, the appointment may need to be rescheduled.",
  },
  booking_rescheduled: {
    category: "BOOKING UPDATED", subject: "Your Brandon RV appointment has been rescheduled",
    title: "Your appointment time has changed",
    intro: "Hi {firstname},",
    body: "Your appointment has been rescheduled. Please check the revised details below and let us know if the new time does not suit you.",
    details: ["booking_reference", "previous_date", "previous_time", "booking_date", "booking_time", "service_location"],
    cta: "View updated appointment", url: "{booking_url}",
  },
  booking_cancelled: {
    category: "BOOKING CANCELLED", subject: "Your Brandon RV appointment has been cancelled",
    title: "Your appointment has been cancelled",
    intro: "Hi {firstname},",
    body: "The appointment below has been cancelled. If you still need assistance, contact Brandon RV to discuss another suitable time.",
    details: ["booking_reference", "service", "booking_date", "booking_time", "cancellation_reason"],
    cta: "View booking", url: "{booking_url}",
  },
  appointment_reminder: {
    category: "APPOINTMENT REMINDER", subject: "Reminder: Brandon RV is booked for {booking_date}",
    title: "Your appointment is coming up",
    intro: "Hi {firstname},",
    body: "This is a reminder of your upcoming mobile appointment. Please ensure the vehicle is available and the agreed work area is safe and accessible.",
    details: ["booking_reference", "service", "vehicle", "booking_date", "booking_time", "service_location"],
    cta: "View appointment", url: "{booking_url}",
    note: "If anything has changed with access, parking, weather or the vehicle, please contact us before the appointment.",
  },
  parts_ordered: {
    category: "PARTS UPDATE", subject: "Parts update for your Brandon RV job {job_number}",
    title: "Your parts have been ordered",
    intro: "Hi {firstname},",
    body: "The agreed parts for your job have been ordered. We'll update you when availability and delivery timing are confirmed.",
    details: ["job_number", "parts_summary", "supplier_reference", "estimated_arrival"],
    cta: "View job update", url: "{job_url}",
    note: "Estimated arrival dates can change and are not a guaranteed job completion date.",
  },
  parts_delay: {
    category: "PARTS DELAY", subject: "An update about parts for your Brandon RV job",
    title: "There's a delay with your parts",
    intro: "Hi {firstname},",
    body: "We need to let you know that parts for your job have been delayed. We're checking availability and delivery timing and will update you as soon as we have reliable information.",
    details: ["job_number", "parts_summary", "delay_reason", "revised_eta"],
    cta: "View job update", url: "{job_url}",
    note: "We won't promise a revised completion date until the required parts and site arrangements are confirmed. We'll contact you to discuss practical options if the delay affects your booking.",
  },
  job_update: {
    category: "JOB PROGRESS", subject: "An update on your Brandon RV job {job_number}",
    title: "Your job has been updated",
    intro: "Hi {firstname},",
    body: "There's a new update on your Brandon RV job.",
    details: ["job_number", "job_status", "updated_at"],
    message: "{customer_update}",
    cta: "View job progress", url: "{job_url}",
    note: "Only customer-visible job updates are included in this email.",
  },
  job_completed: {
    category: "JOB COMPLETED", subject: "Your Brandon RV job {job_number} is complete",
    title: "Your job has been marked complete",
    intro: "Hi {firstname},",
    body: "The agreed work has been marked complete. Please review the handover information and any completion photographs available in your customer portal.",
    details: ["job_number", "service", "completed_date", "technician_name"],
    cta: "View completed job", url: "{job_url}",
    note: "Your invoice may be issued separately. Please contact us promptly if you have a question about the completed work.",
  },
  invoice_issued: {
    category: "INVOICE", subject: "Brandon RV invoice {invoice_number} is ready",
    title: "Your invoice is ready",
    intro: "Hi {firstname},",
    body: "Your itemised invoice is ready. Please review the work completed, parts, freight, consumables, applicable tax and payment due date.",
    details: ["invoice_number", "job_number", "invoice_date", "due_date", "subtotal", "gst", "total", "amount_due"],
    cta: "View invoice", url: "{invoice_url}",
  },
  payment_received: {
    category: "PAYMENT RECEIVED", subject: "Payment received — Brandon RV invoice {invoice_number}",
    title: "Thank you, your payment has been received",
    intro: "Hi {firstname},",
    body: "We've recorded your payment. Keep this email as confirmation for your records.",
    details: ["invoice_number", "payment_date", "payment_method", "amount_paid", "remaining_balance"],
    cta: "View payment receipt", url: "{receipt_url}",
  },
  payment_reminder: {
    category: "PAYMENT REMINDER", subject: "Payment reminder: Brandon RV invoice {invoice_number}",
    title: "A friendly payment reminder",
    intro: "Hi {firstname},",
    body: "Our records show that invoice {invoice_number} has an outstanding balance. If you've already paid, please disregard this reminder or contact us so we can check the payment against your account.",
    details: ["invoice_number", "invoice_date", "due_date", "amount_due"],
    cta: "View invoice", url: "{invoice_url}",
  },
  customer_followup: {
    category: "CUSTOMER FOLLOW-UP", subject: "How did we do? Brandon RV job {job_number}",
    title: "A quick follow-up",
    intro: "Hi {firstname},",
    body: "Thanks for choosing Brandon RV. We'd appreciate hearing how the completed work went and whether everything is operating as expected.",
    cta: "Send feedback", url: "{feedback_url}",
    note: "If something isn't right, contact us directly so we can review it with you.",
  },
  general_customer_reply: {
    category: "MESSAGE FROM BRANDON RV", subject: "{email_subject}",
    title: "{email_heading}",
    intro: "Hi {firstname},",
    body: "{message_body}",
    cta: "Open customer portal", url: "{portal_url}",
  },
  general_staff_reply: {
    category: "BRANDON RV TEAM MESSAGE", subject: "{email_subject}",
    title: "{email_heading}",
    intro: "Hi {firstname},",
    body: "{message_body}",
    cta: "Open staff workspace", url: "{staff_portal_url}",
  },
};

const detailLabels = {
  job_number: "Job number", customer_name: "Customer", email: "Email", phone: "Phone",
  service: "Service", vehicle: "Vehicle", suburb: "Suburb", booking_reference: "Booking reference",
  preferred_date: "Preferred date", preferred_time: "Preferred time", booking_date: "Date",
  booking_time: "Time", previous_date: "Previous date", previous_time: "Previous time",
  service_location: "Service location", arrival_window: "Arrival window", quote_number: "Quote number",
  quote_date: "Quote date", quote_valid_until: "Valid until", subtotal: "Subtotal", gst: "GST",
  total: "Total", approved_at: "Approved at", invoice_number: "Invoice number",
  invoice_date: "Invoice date", due_date: "Due date", amount_due: "Amount due",
  payment_date: "Payment date", payment_method: "Payment method", amount_paid: "Amount paid",
  remaining_balance: "Remaining balance", task_title: "Task", task_due_date: "Due date",
  priority: "Priority", assigned_by: "Assigned by", task_status: "Status", staff_role: "Role",
  estimated_arrival: "Estimated arrival", parts_summary: "Parts", supplier_reference: "Supplier reference",
  delay_reason: "Delay reason", revised_eta: "Revised estimate", job_status: "Job status",
  updated_at: "Last updated", completed_date: "Completed", technician_name: "Technician",
  cancellation_reason: "Reason", booking_time: "Time", enquiry_number: "Enquiry reference",
  approved_at: "Approved at", quote_number: "Quote reference",
};

function interpolate(source, vars) {
  return source.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    const value = vars[key];
    return value === undefined || value === null ? "" : escapeHtml(value);
  });
}

function renderDetails(keys, vars) {
  const rows = keys.filter((key) => vars[key] !== undefined && vars[key] !== null && vars[key] !== "")
    .map((key) => `<tr><td style="padding:10px 12px;color:#64748b;border-bottom:1px solid #e7edf3;">${escapeHtml(detailLabels[key] || key.replaceAll("_", " "))}</td><td align="right" style="padding:10px 12px;color:#173451;font-weight:600;border-bottom:1px solid #e7edf3;">${escapeHtml(vars[key])}</td></tr>`).join("");
  return rows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:20px 0;background:#f7f9fc;border:1px solid #e7edf3;">${rows}</table>` : "";
}

function renderBullets(items = []) {
  return items.length ? `<ul style="margin:0 0 20px;padding-left:22px;color:#334155;font-size:15px;line-height:1.8;">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "";
}

export const BRANDON_RV_EMAIL_TEMPLATE_IDS = Object.freeze(Object.keys(definitions));

/**
 * @param {string} templateId
 * @param {Record<string, unknown>} variables
 * @returns {{templateId:string, subject:string, html:string, text:string, category:string}}
 */
export function renderBrandonRvEmail(templateId, variables = {}) {
  const definition = definitions[templateId];
  if (!definition) throw new Error(`Unknown Brandon RV email template: ${templateId}`);

  const vars = { ...DEFAULTS, ...variables };
  const subject = interpolate(definition.subject, vars);
  const title = interpolate(definition.title, vars);
  const intro = interpolate(definition.intro || "", vars);
  const body = interpolate(definition.body || "", vars);
  const note = interpolate(definition.note || "", vars);
  const message = interpolate(definition.message || "", vars);
  const detailsHtml = renderDetails(definition.details || [], vars);
  const bulletsHtml = renderBullets(definition.bullets || []);
  const ctaUrl = definition.url ? safeHref(interpolate(definition.url, vars)) : "";
  const cta = ctaUrl && ctaUrl !== "#" ? `<p style="margin:26px 0 22px;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#1672ad;color:#fff;text-decoration:none;font-weight:700;padding:14px 23px;border-radius:5px;">${escapeHtml(definition.cta)}</a></p>` : "";
  const messageHtml = message ? `<div style="margin:18px 0;padding:16px 18px;background:#f5f8fb;border-left:3px solid #1672ad;color:#334155;white-space:pre-line;line-height:1.7;">${message}</div>` : "";
  const noteHtml = note ? `<p style="margin:18px 0 0;padding:13px 15px;background:#fff8e8;border:1px solid #f2e3bd;color:#70551b;font-size:13px;line-height:1.65;">${note}</p>` : "";
  const extra = definition.extra ? `<p style="margin:0 0 18px;color:#334155;font-size:15px;line-height:1.75;">${interpolate(definition.extra, vars)}</p>` : "";
  const website = safeHref(vars.site_url);
  const logo = safeHref(vars.logo_url);
  const phone = text(vars.business_phone);
  const email = text(vars.business_email);
  const siteName = text(vars.site_name);
  const content = [
    `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.75;">${intro}</p>`,
    `<p style="margin:0 0 18px;color:#334155;font-size:15px;line-height:1.75;">${body}</p>`,
    detailsHtml, bulletsHtml, messageHtml, extra, cta, noteHtml,
  ].join("");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#edf1f5;font-family:Arial,Helvetica,sans-serif;color:#173451;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(title)} — ${escapeHtml(subject)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf1f5;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;background:#fff;border-radius:10px;overflow:hidden;">
<tr><td align="center" style="padding:25px 28px 20px;background:#102f4d;">
<a href="${escapeHtml(website)}" style="text-decoration:none;"><img src="${escapeHtml(logo)}" width="190" alt="${siteName}" style="display:block;width:190px;max-width:70%;height:auto;border:0;margin:0 auto 12px;"></a>
<div style="color:#dbe8f4;font-size:11px;letter-spacing:1.7px;text-transform:uppercase;">${escapeHtml(vars.tagline)}</div>
</td></tr>
<tr><td style="padding:32px 34px 30px;">
<div style="margin-bottom:12px;color:#1672ad;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">${escapeHtml(definition.category)}</div>
<h1 style="margin:0 0 22px;color:#102f4d;font-size:25px;line-height:1.3;">${title}</h1>
${content}
<p style="margin:24px 0 0;color:#334155;font-size:15px;line-height:1.7;">Regards,<br><strong>${siteName}</strong></p>
</td></tr>
<tr><td align="center" style="padding:23px 26px;background:#f5f7fa;border-top:1px solid #e6ebf0;">
<div style="font-size:13px;font-weight:700;color:#173451;">${siteName}</div>
<div style="margin-top:7px;font-size:12px;color:#64748b;">${phone} &nbsp;|&nbsp; <a href="mailto:${email}" style="color:#1672ad;text-decoration:none;">${email}</a></div>
<div style="margin-top:8px;font-size:12px;"><a href="${escapeHtml(website)}" style="color:#1672ad;text-decoration:none;">${escapeHtml(String(vars.site_url).replace(/^https?:\/\//, ""))}</a></div>
<div style="margin:15px auto 0;max-width:470px;font-size:11px;line-height:1.6;color:#8a96a5;">This message may be an automated notification or a personal reply from the Brandon RV team. If you need assistance, contact us using the details above.</div>
<div style="margin-top:9px;font-size:10px;color:#a0aab6;">© ${text(vars.current_year)} ${siteName}. All rights reserved.</div>
</td></tr></table></td></tr></table></body></html>`;

  const plain = [
    `${title}`, "", intro, body,
    ...(definition.details || []).filter((key) => vars[key] !== undefined && vars[key] !== "").map((key) => `${detailLabels[key] || key}: ${vars[key]}`),
    message ? `\n${vars.message_body || ""}` : "",
    definition.cta && ctaUrl && ctaUrl !== "#" ? `\n${definition.cta}: ${ctaUrl}` : "",
    note ? `\n${note}` : "",
    "", "Regards,", vars.site_name, vars.business_phone, vars.business_email, vars.site_url,
    "", "This message may be an automated notification or a personal reply from the Brandon RV team.",
  ].filter(Boolean).join("\n");

  return { templateId, subject, html, text: plain, category: definition.category };
}
