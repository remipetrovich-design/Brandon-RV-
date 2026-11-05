import { database, normalizeEmail, passwordHash, createSession, jsonError } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fullName = String(body.fullName ?? "").trim();
    const email = normalizeEmail(String(body.email ?? ""));
    const phone = String(body.phone ?? "").trim();
    const password = String(body.password ?? "");
    if (fullName.length < 2 || fullName.length > 120) return jsonError("Enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return jsonError("Enter a valid email address.");
    if (password.length < 12 || password.length > 128) return jsonError("Use a password between 12 and 128 characters.");
    if (phone.length > 40) return jsonError("Enter a valid phone number.");
    const db = database();
    const { data: existing } = await db.from("users").select("id").eq("email", email).maybeSingle();
    if (existing) return jsonError("An account with that email already exists.", 409);
    const { data: business, error: businessError } = await db.from("businesses").select("id").eq("slug", "brandon-rv").single();
    if (businessError || !business) return jsonError("Business setup is incomplete. Please contact Brandon RV.", 503);
    const { data: user, error } = await db.from("users").insert({ email, password_hash: await passwordHash(password), full_name: fullName, phone: phone || null, account_type: "customer", status: "active", email_verified_at: null }).select("id,email,full_name,phone,account_type,status").single();
    if (error || !user) return jsonError("Could not create your account. Please try again.", 500);
    const { error: customerError } = await db.from("customers").insert({ business_id: business.id, user_id: user.id, full_name: fullName, email, phone: phone || null, status: "active" });
    if (customerError) {
      await db.from("users").delete().eq("id", user.id);
      return jsonError("Could not finish setting up your customer profile.", 500);
    }
    await createSession(user.id, request);
    return Response.json({ user }, { status: 201 });
  } catch {
    return jsonError("Registration is temporarily unavailable.", 500);
  }
}
