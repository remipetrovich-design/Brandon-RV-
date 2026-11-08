import test from "node:test";
import assert from "node:assert/strict";
import { BRANDON_RV_EMAIL_TEMPLATE_IDS, renderBrandonRvEmail } from "../src/lib/email/templates.mjs";

const sample = {
  firstname: "Alex", lastname: "Taylor", email: "alex@example.com",
  site_url: "https://brandonrv.com.au", portal_url: "https://brandonrv.com.au/portal",
  verification_url: "https://brandonrv.com.au/verify?token=abc",
  reset_url: "https://brandonrv.com.au/reset?token=abc",
  invitation_url: "https://brandonrv.com.au/invite/abc",
  staff_portal_url: "https://brandonrv.com.au/staff",
  quote_url: "https://brandonrv.com.au/quotes/Q-1001",
  booking_url: "https://brandonrv.com.au/bookings/B-1001",
  job_url: "https://brandonrv.com.au/jobs/J-1001",
  invoice_url: "https://brandonrv.com.au/invoices/I-1001",
  task_url: "https://brandonrv.com.au/tasks/T-1001",
  admin_enquiry_url: "https://brandonrv.com.au/admin/enquiries/E-1001",
  admin_booking_url: "https://brandonrv.com.au/admin/bookings/B-1001",
  admin_quote_url: "https://brandonrv.com.au/admin/quotes/Q-1001",
  quote_conversation_url: "https://brandonrv.com.au/quotes/Q-1001/messages",
  admin_quote_conversation_url: "https://brandonrv.com.au/admin/quotes/Q-1001",
  onboarding_url: "https://brandonrv.com.au/staff/onboarding",
  feedback_url: "https://brandonrv.com.au/feedback",
  receipt_url: "https://brandonrv.com.au/receipts/R-1001",
  task_title: "Check awning latch", task_due_date: "2026-11-20", priority: "Normal",
  job_number: "J-1001", quote_number: "Q-1001", invoice_number: "I-1001",
  booking_reference: "B-1001", enquiry_number: "E-1001",
  service: "Interior cabinetry repair", vehicle: "2021 Jayco Journey",
  customer_name: "Alex Taylor", phone: "0400 000 000",
  service_location: "Tamworth NSW", booking_date: "20 November 2026",
  booking_time: "9:00 am", preferred_date: "20 November 2026", preferred_time: "9:00 am",
  total: "$250.00", amount_due: "$250.00", amount_paid: "$250.00",
  message_body: "Could you confirm the arrival window?",
  email_subject: "A quick update", email_heading: "An update from Brandon RV",
  announcement_title: "Team update", announcement_message: "Please check the new schedule.",
};

test("every registered email renders in the shared branded layout", () => {
  for (const id of BRANDON_RV_EMAIL_TEMPLATE_IDS) {
    const email = renderBrandonRvEmail(id, sample);
    assert.ok(email.subject, id + " subject");
    assert.match(email.html, /Brandon RV/);
    assert.match(email.html, /From Factory Experience to Repairs On The Go/);
    assert.match(email.html, /brv-logo\.webp/);
    assert.match(email.text, /Brandon RV/);
    assert.ok(email.category, id + " category");
  }
});

test("the catalog includes the expected account, staff, booking, quote and job messages", () => {
  for (const id of ["welcome", "verify_account", "forgot_password", "staff_invitation", "staff_onboarding", "staff_assignment", "staff_task_assigned", "booking_confirmed", "quote_created", "quote_reply_customer", "invoice_issued", "payment_received"]) {
    assert.ok(BRANDON_RV_EMAIL_TEMPLATE_IDS.includes(id), id);
  }
});

test("escapes user-supplied HTML in variables", () => {
  const email = renderBrandonRvEmail("general_customer_reply", {
    firstname: '<img src=x onerror="alert(1)">',
    email_subject: "Test",
    email_heading: "Hello",
    message_body: "<script>alert(1)</script>",
    portal_url: "https://brandonrv.com.au/portal",
  });
  assert.doesNotMatch(email.html, /<img src=x/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /&lt;script&gt;/);
});

test("does not allow unsafe action URL protocols", () => {
  const email = renderBrandonRvEmail("welcome", {
    firstname: "Alex",
    portal_url: "javascript:alert(1)",
  });
  assert.doesNotMatch(email.html, /href="javascript:/);
});

test("supports custom template identifiers using managed content overrides", () => {
  const email = renderBrandonRvEmail("not_a_template", {}, {subject:"Custom subject",title:"Custom heading",body:"Custom message"});
  assert.equal(email.subject,"Custom subject");
  assert.match(email.html,/Custom heading/);
  assert.match(email.html,/Custom message/);
});

test("keeps quote replies in the common shell with the message body", () => {
  const email = renderBrandonRvEmail("quote_reply_customer", {
    firstname: "Alex", sender_name: "Chris", quote_number: "Q-42",
    message_body: "Can you confirm the parts cost?",
    quote_conversation_url: "https://brandonrv.com.au/quotes/Q-42",
  });
  assert.match(email.html, /Can you confirm the parts cost\?/);
  assert.match(email.html, /Q-42/);
  assert.match(email.html, /QUOTE CONVERSATION/);
});
