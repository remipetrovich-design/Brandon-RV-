import { authorizePermission, database, digest, jsonError, newToken, sameOrigin } from "@/lib/auth";
import { validateIntegrationScopes } from "@/lib/integration-access.mjs";
export const runtime = "nodejs";

export async function GET() {
  const access = await authorizePermission("business.settings.manage");
  if (access.response) return access.response;
  const db = database(), businessId = access.membership!.business_id;
  const [{ data: control }, { data: credentials }, { data: audit }, { data: mailConfig }] = await Promise.all([
    db.from("integration_control_settings").select("*").eq("business_id", businessId).maybeSingle(),
    db.from("integration_credentials").select("id,name,description,token_prefix,is_enabled,scopes,allowed_ip_addresses,rate_limit_per_minute,expires_at,last_used_at,revoked_at,created_at").eq("business_id", businessId).order("created_at", { ascending: false }),
    db.from("integration_audit_logs").select("id,credential_id,integration_name,request_id,method,path,required_scope,action,entity_type,entity_id,status_code,outcome,created_at").eq("business_id", businessId).order("created_at", { ascending: false }).limit(100),
    Promise.resolve({ data: null }),
  ]);
  return Response.json({
    api: { enabled: control?.api_enabled ?? false, pauseReason: control?.pause_reason ?? null, requireApprovalForSensitiveActions: control?.require_approval_for_sensitive_actions ?? true, defaultRateLimitPerMinute: control?.default_rate_limit_per_minute ?? 60 },
    credentials: credentials ?? [], audit: audit ?? [],
    integrations: [{ id: "orbitfs-mail", name: "OrbitFS Mail System", description: "Existing transactional email service used by Brandon RV email templates.", configured: Boolean(process.env.ORBITFS_MAIL_URL && process.env.BRANDONSRV_MAIL_API_KEY), urlConfigured: Boolean(process.env.ORBITFS_MAIL_URL), keyConfigured: Boolean(process.env.BRANDONSRV_MAIL_API_KEY), management: "Email sender selection and templates are managed under Email Templates." }],
  });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const access = await authorizePermission("business.settings.manage");
  if (access.response) return access.response;
  try {
    const body = await request.json(), name = String(body.name ?? "").trim(), description = String(body.description ?? "").trim().slice(0, 500), scopes = body.scopes;
    const scopeCheck = validateIntegrationScopes(scopes);
    if (name.length < 2 || name.length > 100) return jsonError("Integration name must be between 2 and 100 characters.");
    if (!scopeCheck.valid) return Response.json({ error: { code: "INVALID_SCOPES", message: "One or more selected permissions are invalid.", details: scopeCheck.invalid } }, { status: 422 });
    const ips = Array.isArray(body.allowedIpAddresses) ? body.allowedIpAddresses.map((value: unknown) => String(value).trim()).filter(Boolean) : [];
    if (ips.some((value: string) => value.length > 64 || !/^[0-9a-fA-F:.]+$/.test(value))) return jsonError("IP allowlist entries must be valid IPv4 or IPv6 addresses.");
    const rate = body.rateLimitPerMinute == null ? null : Number(body.rateLimitPerMinute);
    if (rate !== null && (!Number.isInteger(rate) || rate < 1 || rate > 600)) return jsonError("Rate limit must be between 1 and 600 requests per minute.");
    const expiry = body.expiresAt ? new Date(String(body.expiresAt)) : null;
    if (expiry && (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now())) return jsonError("Credential expiry must be a future date.");
    const token = "brv_live_" + newToken(), db = database(), businessId = access.membership!.business_id;
    const { data, error } = await db.from("integration_credentials").insert({ business_id: businessId, name, description: description || null, token_hash: digest(token), token_prefix: token.slice(0, 16), scopes, allowed_ip_addresses: ips, rate_limit_per_minute: rate, expires_at: expiry?.toISOString() ?? null, created_by: access.user!.id }).select("id,name,description,token_prefix,scopes,allowed_ip_addresses,rate_limit_per_minute,expires_at,created_at").single();
    if (error || !data) return jsonError("Could not create integration credential.", 500);
    await db.from("integration_audit_logs").insert({ business_id: businessId, credential_id: data.id, integration_name: name, request_id: crypto.randomUUID(), method: "ADMIN", path: "/admin/integrations", action: "credential.created", status_code: 201, outcome: "success", details: { scopes, expires_at: data.expires_at } });
    return Response.json({ credential: data, token, warning: "Copy this token now. It will not be shown again." }, { status: 201 });
  } catch { return jsonError("Could not create integration credential.", 500); }
}
