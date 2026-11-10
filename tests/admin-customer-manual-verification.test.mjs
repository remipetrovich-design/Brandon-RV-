import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
test("customer register shows verified and unverified accounts together",()=>{
 const page=read("../src/app/admin/[section]/page.tsx");
 assert.match(page,/query\.eq\("primary_group","customer"\)/);
 assert.match(page,/row\.status==="unverified"/);
 assert.match(page,/AdminCustomerEmailVerification/);
 assert.doesNotMatch(page,/Unverified customers/);
});
test("manual verification requires permission and activates the account",()=>{
 const api=read("../src/app/api/admin/customers/[id]/verify-email/route.ts");
 assert.match(api,/customers\.manage/);
 assert.match(api,/sameOrigin/);
 assert.match(api,/email_verified_at/);
 assert.match(api,/status:"active"/);
 assert.match(api,/audit_events/);
 assert.match(api,/eq\("primary_group","customer"\)\.eq\("status","unverified"\)/);
});
test("verification control refreshes and displays success or failure banner",()=>{
 const component=read("../src/components/admin-customer-email-verification.tsx");
 assert.match(component,/verify-email/);
 assert.match(component,/router\.refresh/);
 assert.match(component,/form-banner-success/);
 assert.match(component,/form-banner-error/);
});
