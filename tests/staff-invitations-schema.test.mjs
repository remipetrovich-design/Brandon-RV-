import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
const invitations=read("../supabase/migrations/20261110100000_create_staff_invitations.sql");
const workOrders=read("../supabase/migrations/20261109200000_work_order_execution_and_customer_signoff.sql");
const register=read("../src/app/api/auth/register/route.ts");
const staffInvitations=read("../src/app/api/staff/invitations/route.ts");

test("staff invitation storage supports the customer-first invitation flow",()=>{
  for(const column of ["business_id","email","user_id","role_key","job_title","employment_type","start_date","invited_by","token_hash","expires_at","accepted_at","revoked_at"]) {
    assert.match(invitations,new RegExp("\\b"+column+"\\b"));
  }
  assert.match(invitations,/REFERENCES public\.users\(id\)/);
  assert.match(invitations,/REFERENCES public\.user_roles\(role_key\)/);
  assert.match(invitations,/ENABLE ROW LEVEL SECURITY/);
  assert.match(invitations,/GRANT ALL ON public\.staff_invitations TO service_role/);
});

test("registration and staff invitation endpoints use the provisioned staff_invitations table",()=>{
  assert.match(register,/from\("staff_invitations"\)/);
  assert.match(staffInvitations,/from\("staff_invitations"\)/);
});

test("work order entries reference the underlying user identity, not the staff compatibility view",()=>{
  assert.match(workOrders,/staff_id uuid REFERENCES public\.users\(id\) ON DELETE SET NULL/);
  assert.doesNotMatch(workOrders,/REFERENCES public\.staff\(id\)/);
});
