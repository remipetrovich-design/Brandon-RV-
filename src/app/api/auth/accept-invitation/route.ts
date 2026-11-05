import { createSession, database, digest, normalizeEmail, passwordHash, jsonError } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = String(body.token ?? "");
    const password = String(body.password ?? "");
    if (token.length < 32 || password.length < 12 || password.length > 128) return jsonError("Invitation token or password is invalid.");
    const db = database();
    const { data: invite } = await db.from("user_invitations").select("*").eq("token_hash", digest(token)).is("accepted_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!invite) return jsonError("This invitation is invalid or has expired.", 410);
    const { data: existing } = await db.from("users").select("id").eq("email", normalizeEmail(invite.email)).maybeSingle();
    if (existing) return jsonError("An account with this email already exists.", 409);
    const { data: user, error } = await db.from("users").insert({ email: normalizeEmail(invite.email), full_name: invite.full_name, password_hash: await passwordHash(password), account_type: "staff", status: "active", email_verified_at: new Date().toISOString() }).select("id,email,full_name,account_type").single();
    if (error || !user) return jsonError("Could not create staff account.", 500);
    const { error: staffError } = await db.from("staff").insert({ business_id: invite.business_id, user_id: user.id, job_title: invite.role, employment_status: "active", start_date: new Date().toISOString().slice(0,10) });
    const { error: memberError } = await db.from("business_members").insert({ business_id: invite.business_id, user_id: user.id, role: invite.role, is_active: true, invited_at: invite.created_at, joined_at: new Date().toISOString() });
    if (staffError || memberError) {
      await db.from("staff").delete().eq("user_id", user.id);
      await db.from("business_members").delete().eq("user_id", user.id);
      await db.from("users").delete().eq("id", user.id);
      return jsonError("Could not finish setting up staff access.", 500);
    }
    await db.from("user_invitations").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
    await createSession(user.id, request);
    return Response.json({ user }, { status: 201 });
  } catch { return jsonError("Could not accept invitation.", 500); }
}
