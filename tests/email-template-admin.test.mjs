import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {renderBrandonRvEmail} from "../src/lib/email/templates.mjs";
const email=await readFile(new URL("../src/lib/email.ts",import.meta.url),"utf8");
const migration=await readFile(new URL("../supabase/migrations/20261108010000_brandon_rv_email_templates.sql",import.meta.url),"utf8");
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
 assert.match(migration,/verify_account','forgot_password','password_changed'.*enabled = true AND is_security = true/s);
 assert.match(api,/SECURITY_KEYS\.has\(key\)\?true/);
});
test("email template administration uses existing business settings permission",()=>{
 assert.match(api,/authorizePermission\("business\.settings\.manage"\)/);
 assert.match(api,/sameOrigin\(request\)/);
 assert.match(page,/userHasPermission\(user\.id,"business\.settings\.manage"\)/);
 assert.match(navigation,/href:"\/admin\/email-templates"/);
});
