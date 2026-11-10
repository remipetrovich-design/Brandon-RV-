import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(p)=>readFileSync(new URL(p,import.meta.url),"utf8");
test("customer register includes a separate unverified-customer list with verification action",()=>{
 const page=read("../src/app/admin/[section]/page.tsx");
 assert.match(page,/email_verified_at/);
 assert.match(page,/Unverified customers/);
 assert.match(page,/AdminCustomerEmailVerification/);
 assert.match(page,/!row\.staff_account\?\.email_verified_at/);
});
test("manual verification endpoint requires customer management permission and activates the account",()=>{
 const api=read("../src/app/api/admin/customers/[id]/verify-email/route.ts");
 assert.match(api,/customers\.manage/);
 assert.match(api,/sameOrigin/);
 assert.match(api,/email_verified_at/);
 assert.match(api,/status:\s*"active"/);
 assert.match(api,/audit_events/);
});
test("verification control refreshes the customer register after successful verification",()=>{
 const component=read("../src/components/admin-customer-email-verification.tsx");
 assert.match(component,/verify-email/);
 assert.match(component,/router\.refresh/);
});
