import { authenticateIntegration } from "@/lib/integration-auth";
import { INTEGRATION_SCOPES } from "@/lib/integration-access.mjs";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const auth = await authenticateIntegration(request);
  if (auth.response) return auth.response;
  return Response.json({
    name: "Brandon RV Integration API",
    version: "1.0.0",
    enabled: true,
    authentication: "Bearer token",
    documentation: "/api/integrations/v1/openapi",
    requestId: auth.context!.requestId,
    resources: [
      { name: "business", operations: ["read"], scope: "business.read" },
      { name: "services", operations: ["read"], scope: "services.read" },
      { name: "service-areas", operations: ["read"], scope: "service_areas.read" },
      { name: "customers", operations: ["read"], scope: "customers.read" },
      { name: "vehicles", operations: ["read"], scope: "vehicles.read" },
      { name: "enquiries", operations: ["read"], scope: "enquiries.read" },
      { name: "quotes", operations: ["read"], scope: "quotes.read" },
      { name: "appointments", operations: ["read"], scope: "appointments.read" },
      { name: "workcards", operations: ["read"], scope: "workcards.read" },
      { name: "work-entries", operations: ["read"], scope: "work_entries.read" },
      { name: "parts", operations: ["read"], scope: "parts.read" },
      { name: "suppliers", operations: ["read"], scope: "suppliers.read" },
      { name: "supplier-orders", operations: ["read"], scope: "supplier_orders.read" },
      { name: "invoices", operations: ["read"], scope: "invoices.read" },
      { name: "expenses", operations: ["read"], scope: "expenses.read" },
      { name: "staff", operations: ["read"], scope: "staff.read" },
      { name: "time-entries", operations: ["read"], scope: "time_entries.read" },
      { name: "leave", operations: ["read"], scope: "leave.read" },
      { name: "payroll", operations: ["read"], scope: "payroll.read" },
      { name: "website", operations: ["read"], scope: "website.read" },
      { name: "business-settings", operations: ["read"], scope: "business.settings.read" },
    ],
    permissionGroups: INTEGRATION_SCOPES,
  }, { headers: { "X-Request-Id": auth.context!.requestId } });
}
