import { authorizePermission, database, jsonError, sameOrigin } from "@/lib/auth";
export const runtime = "nodejs";
export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const access = await authorizePermission("business.settings.manage");
  if (access.response) return access.response;
  try {
    const body = await request.json(), businessId = access.membership!.business_id;
    const patch: Record<string, unknown> = { updated_by: access.user!.id, updated_at: new Date().toISOString() };
    if (typeof body.enabled === "boolean") {
      patch.api_enabled = body.enabled;
      patch.pause_reason = body.enabled ? null : String(body.pauseReason ?? "Paused by administrator").trim().slice(0, 500);
    }
    if (typeof body.requireApprovalForSensitiveActions === "boolean") patch.require_approval_for_sensitive_actions = body.requireApprovalForSensitiveActions;
    if (body.defaultRateLimitPerMinute !== undefined) {
      const rate = Number(body.defaultRateLimitPerMinute);
      if (!Number.isInteger(rate) || rate < 1 || rate > 600) return jsonError("Default rate limit must be between 1 and 600 requests per minute.");
      patch.default_rate_limit_per_minute = rate;
    }
    const db = database();
    const { data, error } = await db.from("integration_control_settings").upsert({ business_id: businessId, ...patch }, { onConflict: "business_id" }).select("api_enabled,pause_reason,require_approval_for_sensitive_actions,default_rate_limit_per_minute,updated_at").single();
    if (error || !data) return jsonError("Could not update API controls.", 500);
    await db.from("integration_audit_logs").insert({ business_id: businessId, integration_name: "Admin control panel", request_id: crypto.randomUUID(), method: "ADMIN", path: "/admin/integrations/control", action: body.enabled === true ? "api.enabled" : body.enabled === false ? "api.paused" : "api.policy.updated", status_code: 200, outcome: "success", details: patch });
    return Response.json({ api: { enabled: data.api_enabled, pauseReason: data.pause_reason, requireApprovalForSensitiveActions: data.require_approval_for_sensitive_actions, defaultRateLimitPerMinute: data.default_rate_limit_per_minute } });
  } catch { return jsonError("Could not update API controls.", 500); }
}
