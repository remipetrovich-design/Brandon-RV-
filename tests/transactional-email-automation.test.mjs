import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const email=await readFile(new URL("../src/lib/email.ts",import.meta.url),"utf8");
const migration=await readFile(new URL("../supabase/migrations/20261108000000_brandon_rv_email_templates.sql",import.meta.url),"utf8");
const register=await readFile(new URL("../src/app/api/auth/register/route.ts",import.meta.url),"utf8");
const reset=await readFile(new URL("../src/app/api/auth/forgot-password/route.ts",import.meta.url),"utf8");
const verify=await readFile(new URL("../src/app/api/auth/verify-email/route.ts",import.meta.url),"utf8");
const enquiry=await readFile(new URL("../src/app/api/enquiries/route.ts",import.meta.url),"utf8");
const api=await readFile(new URL("../src/app/api/admin/email-templates/route.ts",import.meta.url),"utf8");
test("security and customer emails use editable server-side templates",()=>{
 for(const key of ["account_verification","password_reset","welcome","enquiry_received"])assert.match(migration,new RegExp(key));
 assert.match(email,/sendTemplateEmail/);
 assert.match(register,/sendTemplateEmail/);
 assert.match(reset,/sendTemplateEmail/);
 assert.match(verify,/sendTemplateEmail/);
 assert.match(enquiry,/sendTemplateEmail/);
});
test("verification and password reset templates cannot be disabled",()=>{
 assert.match(migration,/template_key NOT IN \('account_verification','password_reset'\) OR \(enabled = true AND is_security = true\)/);
 assert.match(api,/SECURITY_KEYS/);
 assert.match(api,/SECURITY_KEYS\.has\(key\)\?true/);
});
test("template administration is protected by business settings permission",()=>{
 assert.match(api,/authorizePermission\("business\.settings\.manage"\)/);
 assert.match(api,/sameOrigin\(request\)/);
});
