import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { database } from "@/lib/auth";
import { hasIntegrationScope, isIntegrationCredentialActive } from "@/lib/integration-access.mjs";

export type IntegrationContext = {
  db: ReturnType<typeof database>;
  credential: any;
  businessId: string;
  requestId: string;
  ip: string | null;
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const requestIp = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;

export async function authenticateIntegration(request: Request, requiredScope?: string): Promise<{ context: IntegrationContext | null; response: Response | null }> {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || !token.startsWith("brv_live_")) return { context: null, response: Response.json({ error: { code: "UNAUTHENTICATED", message: "A valid Brandon RV integration bearer token is required." } }, { status: 401 }) };

  const db = database();
  const { data: credential, error } = await db.from("integration_credentials").select("id,business_id,name,token_prefix,scopes,allowed_ip_addresses,rate_limit_per_minute,expires_at,revoked_at").eq("token_hash", sha256(token)).maybeSingle();
  if (error || !credential || !isIntegrationCredentialActive(credential)) return { context: null, response: Response.json({ error: { code: "INVALID_CREDENTIAL", message: "The integration credential is invalid, expired or revoked." } }, { status: 401 }) };

  const ip = requestIp(request);
  const allowlist = Array.isArray(credential.allowed_ip_addresses) ? credential.allowed_ip_addresses : [];
  if (allowlist.length && (!ip || !allowlist.includes(ip))) return { context: null, response: Response.json({ error: { code: "IP_NOT_ALLOWED", message: "This source IP address is not allowed for this integration." } }, { status: 403 }) };

  const { data: control, error: controlError } = await db.from("integration_control_settings").select("api_enabled,default_rate_limit_per_minute").eq("business_id", credential.business_id).maybeSingle();
  if (controlError || !control?.api_enabled) return { context: null, response: Response.json({ error: { code: "API_PAUSED", message: "The Brandon RV external API is currently disabled by an administrator." } }, { status: 503 }) };

  if (!hasIntegrationScope(credential.scopes, requiredScope || null)) return { context: null, response: Response.json({ error: { code: "INSUFFICIENT_SCOPE", message: "This integration has not been granted the permission required for this operation.", requiredScope } }, { status: 403 }) };

  const rateLimit = Number(credential.rate_limit_per_minute ?? control.default_rate_limit_per_minute ?? 60);
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count: recentRequests } = await db.from("integration_audit_logs").select("id", { count: "exact", head: true }).eq("credential_id", credential.id).gte("created_at", since);
  if ((recentRequests ?? 0) >= rateLimit) return { context: null, response: Response.json({ error: { code: "RATE_LIMITED", message: "This integration has reached its request limit. Try again shortly." } }, { status: 429, headers: { "Retry-After": "60" } }) };

  const requestId = request.headers.get("x-request-id")?.slice(0, 120) || randomUUID();
  const now = new Date().toISOString();
  await db.from("integration_credentials").update({ last_used_at: now, last_used_ip_hash: ip ? sha256(ip) : null, updated_at: now }).eq("id", credential.id).is("revoked_at", null);
  return { context: { db, credential, businessId: credential.business_id, requestId, ip }, response: null };
}

export async function auditIntegrationRequest(context: IntegrationContext, request: Request, input: { status: number; outcome: "success" | "denied" | "error" | "pending"; scope?: string; action?: string; entityType?: string; entityId?: string; details?: Record<string, unknown> }) {
  await context.db.from("integration_audit_logs").insert({
    business_id: context.businessId,
    credential_id: context.credential.id,
    integration_name: context.credential.name,
    request_id: context.requestId,
    method: request.method,
    path: new URL(request.url).pathname,
    required_scope: input.scope ?? null,
    action: input.action ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    status_code: input.status,
    outcome: input.outcome,
    ip_hash: context.ip ? sha256(context.ip) : null,
    user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    details: input.details ?? {},
  });
}
