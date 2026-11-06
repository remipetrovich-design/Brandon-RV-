export const GLOBAL_ADMIN_ROLES = new Set(["owner", "website_developer", "developer"]);

export function isGlobalAdministrator(role) {
  return GLOBAL_ADMIN_ROLES.has(String(role ?? "").trim().toLowerCase());
}

export function hasEmployeeAccess(user) {
  if (!user?.user_role) return false;
  return isGlobalAdministrator(user.user_role) || user.employment_status === "active";
}
