export const INTEGRATION_SCOPES = [
  { group: "Business configuration", scopes: ["business.read", "business.settings.read", "business.settings.write", "services.read", "services.write", "service_areas.read", "service_areas.write", "website.read", "website.write"] },
  { group: "Customers and vehicles", scopes: ["customers.read", "customers.write", "vehicles.read", "vehicles.write"] },
  { group: "Enquiries and communications", scopes: ["enquiries.read", "enquiries.write", "communications.read", "communications.draft", "communications.send"] },
  { group: "Quotes", scopes: ["quotes.read", "quotes.draft", "quotes.write", "quotes.approve", "quotes.send"] },
  { group: "Bookings and calendar", scopes: ["availability.read", "appointments.read", "appointments.write", "calendar.read", "calendar.write"] },
  { group: "Workcards and work", scopes: ["workcards.read", "workcards.write", "workcards.assign", "workcards.approve", "workcards.complete", "work_entries.read", "work_entries.write", "tasks.read", "tasks.write"] },
  { group: "Parts and suppliers", scopes: ["parts.read", "parts.write", "suppliers.read", "suppliers.write", "supplier_orders.read", "supplier_orders.write"] },
  { group: "Invoices and finance", scopes: ["invoices.read", "invoices.draft", "invoices.issue", "payments.read", "payments.record", "expenses.read", "expenses.write"] },
  { group: "Staff and workforce", scopes: ["staff.read", "staff.write", "time_entries.read", "time_entries.write", "leave.read", "leave.write", "payroll.read", "assets.read", "assets.write", "onboarding.read", "onboarding.write"] },
  { group: "Administration", scopes: ["reports.read", "audit.read", "files.read", "files.write"] },
];

export const ALL_INTEGRATION_SCOPES = INTEGRATION_SCOPES.flatMap((group) => group.scopes);

export function hasIntegrationScope(grantedScopes, requiredScope) {
  if (!requiredScope) return true;
  const scopes = new Set(Array.isArray(grantedScopes) ? grantedScopes : []);
  return scopes.has(requiredScope) || scopes.has("*");
}

export function validateIntegrationScopes(scopes) {
  if (!Array.isArray(scopes)) return { valid: false, invalid: [] };
  const invalid = [...new Set(scopes)].filter((scope) => !ALL_INTEGRATION_SCOPES.includes(scope));
  return { valid: invalid.length === 0, invalid };
}

export function isIntegrationCredentialActive(credential, now = new Date()) {
  if (!credential || credential.revoked_at || credential.is_enabled === false) return false;
  if (credential.expires_at && new Date(credential.expires_at).getTime() <= now.getTime()) return false;
  return true;
}
