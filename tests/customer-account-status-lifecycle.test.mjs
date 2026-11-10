import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
test("registration assigns customer group and unverified account status",()=>{
 const s=read("../src/app/api/auth/register/route.ts");
 assert.match(s,/primary_group:"customer"/);
 assert.match(s,/status:verificationEnabled\?"unverified":"active"/);
 assert.doesNotMatch(s,/primary_group:"unverified"/);
});
test("email verification changes only account status to active",()=>{
 const s=read("../src/app/api/auth/verify-email/route.ts");
 assert.match(s,/update\(\{status:"active",email_verified_at:now,updated_at:now\}\)/);
 assert.match(s,/eq\("primary_group","customer"\)\.eq\("status","unverified"\)/);
 assert.doesNotMatch(s,/primary_group:"customer"/);
});
test("manual verification changes unverified customer account to active",()=>{
 const s=read("../src/app/api/admin/customers/\[id\]/verify-email/route.ts");
 assert.match(s,/eq\("primary_group","customer"\)\.eq\("status","unverified"\)/);
 assert.match(s,/email_verified_at:verifiedAt,status:"active"/);
 assert.doesNotMatch(s,/primary_group:"unverified"/);
});
test("customer register includes every customer group account and shows account status",()=>{
 const s=read("../src/app/admin/\[section\]/page.tsx");
 assert.match(s,/query\.eq\("primary_group","customer"\)/);
 assert.match(s,/Account: "\+label\(row\.status\)/);
 assert.match(s,/row\.status==="unverified"/);
});

test("unverified is system-controlled and cannot be manually selected",()=>{
 const profile=read("../src/components/admin-customer-profile.tsx");
 const actions=read("../src/components/admin-record-actions.tsx");
 const api=read("../src/app/api/admin/customers/[id]/route.ts");
 assert.match(profile,/Unverified \(system controlled\)/);
 assert.match(profile,/disabled/);
 assert.doesNotMatch(profile,/<option value="unverified">Unverified<\/option>/);
 assert.doesNotMatch(actions,/customers:\["unverified"/);
 assert.match(api,/\["active","suspended","banned"\]/);
 assert.doesNotMatch(api,/\["unverified","active","suspended","banned"\]/);
});
