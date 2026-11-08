import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {renderBrandonRvEmail} from "../src/lib/email/templates.mjs";
const email=await readFile(new URL("../src/lib/email.ts",import.meta.url),"utf8");
const migration=await readFile(new URL("../supabase/migrations/20261108010000_brandon_rv_email_templates.sql",import.meta.url),"utf8");
const eventMigration=await readFile(new URL("../supabase/migrations/20261108020000_email_template_event_links_and_senders.sql",import.meta.url),"utf8");
const api=await readFile(new URL("../src/app/api/admin/email-templates/route.ts",import.meta.url),"utf8");
const page=await readFile(new URL("../src/app/admin/email-templates/page.tsx",import.meta.url),"utf8");
const navigation=await readFile(new URL("../src/app/admin/layout.tsx",import.meta.url),"utf8");

test("branded email renderer accepts business-managed content overrides",()=>{
 const rendered=renderBrandonRvEmail("welcome",{firstname:"Alex",portal_url:"https://brandonrv.com.au/portal"},{subject:"Custom subject for {firstname}",title:"Custom heading",intro:"Hello {firstname}",body:"Custom message body",cta:"Open account"});
 assert.equal(rendered.subject,"Custom subject for Alex");
 assert.match(rendered.html,/Custom heading/);
 assert.match(rendered.html,/Hello Alex/);
 assert.match(rendered.html,/Custom message body/);
 assert.match(rendered.html,/Open account/);
});
test("transactional email overrides are business-scoped and server-only",()=>{
 assert.match(migration,/UNIQUE \(business_id, template_key\)/);
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/REVOKE ALL ON public\.email_templates FROM anon, authenticated/);
 assert.match(email,/from\("email_templates"\)/);
 assert.match(email,/!template\.enabled&&!template\.is_security/);
});
test("account security notifications cannot be disabled",()=>{
 assert.match(eventMigration,/customer\.registration_verification/);
 assert.match(eventMigration,/enabled = true AND is_security = true/);
 assert.match(api,/SECURITY_EVENTS\.has\(eventKey\)\?true/);
});
test("email template administration uses existing business settings permission",()=>{
 assert.match(api,/authorizePermission\("business\.settings\.manage"\)/);
 assert.match(api,/sameOrigin\(request\)/);
 assert.match(page,/userHasPermission\(user\.id,"business\.settings\.manage"\)/);
 assert.match(navigation,/href:"\/admin\/email-templates"/);
});
test("templates can be created, edited, deleted and linked to registered system events",()=>{
 assert.match(api,/export async function POST/);
 assert.match(api,/export async function PATCH/);
 assert.match(api,/export async function DELETE/);
 assert.match(api,/event_key/);
 assert.match(migration,/event_key text/);
 assert.match(eventMigration,/registered system event\/function/);
});
test("custom templates can use the branded renderer without a bundled template definition",()=>{
 const rendered=renderBrandonRvEmail("custom_booking_update",{firstname:"Alex"},{subject:"Booking {firstname}",title:"Booking update",intro:"Hello {firstname}",body:"Your booking changed",cta:"View booking"});
 assert.equal(rendered.subject,"Booking Alex");
 assert.match(rendered.html,/Booking update/);
 assert.match(rendered.html,/Your booking changed/);
});
test("template sender choices are resolved from live assigned Mail System mailboxes",()=>{
 assert.match(api,/getAvailableEmailSenders/);
 assert.match(email,/senderMailboxId/);
 assert.match(email,/\/api\/mail\/senders/);
 assert.match(email,/sender_mailbox_id/);
});
