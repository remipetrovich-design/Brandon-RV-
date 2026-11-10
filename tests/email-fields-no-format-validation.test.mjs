import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(p)=>readFileSync(new URL(p,import.meta.url),"utf8");
test("registration email is a plain required text field without format rejection",()=>{
 const page=read("../src/app/portal/register/page.tsx");
 const api=read("../src/app/api/auth/register/route.ts");
 assert.match(page,/name="email" type="text" inputMode="email" required/);
 assert.doesNotMatch(api,/valid email address|validEmail|@\[\^/);
 assert.match(api,/if\(!email\|\|email\.length>254\)/);
});
test("staff invitation email is a plain required text field without format rejection",()=>{
 const page=read("../src/components/admin-staff-invitations.tsx");
 const api=read("../src/app/api/staff/invitations/route.ts");
 assert.match(page,/name="email" type="text" inputMode="email" required/);
 assert.doesNotMatch(api,/valid email address|validEmail/);
 assert.match(api,/if\(!email\|\|email\.length>254\)/);
});
