import { authorizePermission, database, jsonError, sameOrigin } from "@/lib/auth";
import { validateIntegrationScopes } from "@/lib/integration-access.mjs";
export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const access = await authorizePermission("business.settings.manage");
  if (access.response) return access.response;
  const { id } = await params;
  try {
    const body = await request.json(), patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.scopes !== undefined) {
      const checked = validateIntegrationScopes(body.scopes);
      if (!checked.valid) return jsonError("One or more selected permissions are invalid.");
      patch.scopes = body.scopes;
    }
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length < 2 || name.length > 100) return jsonError("Integration name must be between 2 and 100 characters.");
      patch.name = name;
    }
    if (body.allowedIpAddresses !== undefined) {
      if (!Array.isArray(body.allowedIpAddresses) || body.allowedIpAddresses.some((value: unknown) => typeof value !== "string" || !/^[0-9a-fA-F:.]+$/.test(value))) return jsonError("IP allowlist entries must be IPv4 or IPv6 addresses.");
      patch.allowed_ip_addresses = body.allowedIpAddresses;
    }
    if (body.rateLimitPerMinute !== undefined) {
      const rate = body.rateLimitPerMinute === null ? null : Number(body.rateLimitPerMinute);
      if (rate !== null && (!Number.isInteger(rate) || rate < 1 || rate > 600)) return jsonError("Rate limit must be between 1 and 600.");
      patch.rate_limit_per_minute = rate;
    }
    if (body.expiresAt !== undefined) {
      const expiry = body.expiresAt ? new Date(String(body.expiresAt)) : null;
      if (expiry && (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now())) return jsonError("Expiry must be a future date.");
      patch.expires_at = expiry?.toISOString() ?? null;
    }
    const db = database(), businessId = access.membership!.business_id;
    const { data, error } = await db.from("integration_credentials").update(patch).eq("id", id).eq("business_id", businessId).is("revoked_at", null).select("id,name,description,token_prefix,scopes,allowed_ip_addresses,rate_limit_per_minute,expires_at,last_used_at,revoked_at,created_at").maybeSingle();
    if (error || !data) return jsonError("Active integration credential not found.", 404);
    await db.from("integration_audit_logs").insert({ business_id: businessId, credential_id: id, integration_name: data.name, request_id: crypto.randomUUID(), method: "ADMIN", path: "/admin/integrations/" + id, action: "credential.updated", status_code: 200, outcome: "success", details: { changed_fields: Object.keys(patch) } });
    return Response.json({ credential: data });
  } catch { return jsonError("Could not update integration credential.", 500); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const access = await authorizePermission("business.settings.manage");
  if (access.response) return access.response;
  const { id } = await params, db = database(), businessId = access.membership!.business_id, now = new Date().toISOString();
  const { data, error } = await db.from("integration_credentials").update({ revoked_at: now, revoked_by: access.user!.id, updated_at: now }).eq("id", id).eq("business_id", businessId).is("revoked_at", null).select("id,name").maybeSingle();
  if (error || !data) return jsonError("Active integration credential not found.", 404);
  await db.from("integration_audit_logs").insert({ business_id: businessId, credential_id: id, integration_name: data.name, request_id: crypto.randomUUID(), method: "ADMIN", path: "/admin/integrations/" + id, action: "credential.revoked", status_code: 200, outcome: "success" });
  return Response.json({ success: true, id });
}
