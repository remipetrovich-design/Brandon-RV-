export const GLOBAL_ADMIN_ROLES = new Set(["owner", "website_developer"]);

export function isGlobalAdministrator(role) {
  return GLOBAL_ADMIN_ROLES.has(String(role ?? "").trim().toLowerCase());
}

export function hasEmployeeAccess(user) {
  if (!user?.user_role) return false;
  return isGlobalAdministrator(user.user_role) || user.employment_status === "active";
}

export function isHireableCustomer(user) {
  return Boolean(
    user &&
    user.primary_group === "customer" &&
    user.status === "active" &&
    !user.user_role &&
    (user.employment_status == null || user.employment_status === "terminated")
  );
}
