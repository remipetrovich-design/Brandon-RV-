export const GLOBAL_ADMIN_ROLES = new Set([
  "ceo_founder",
  "website_development_specialist",
  // Legacy aliases retained so existing sessions/accounts never lose access.
  "owner",
  "website_developer",
]);

export const BUILT_IN_STAFF_ROLES = [
  "trial_apprentice",
  "apprentice",
  "senior_apprentice",
  "team_leader",
  "supervisor",
  "office_admin",
  "office_supervisor",
  "office_manager",
  "manager",
  "senior_manager",
  "administrator",
  "general_manager",
  "worker",
  "technician",
  "accounts",
  "website_development_specialist",
  "ceo_founder",
];

export function isManagerOrAbove(role) {
  return new Set([
    "office_manager",
    "manager",
    "senior_manager",
    "administrator",
    "general_manager",
    "website_development_specialist",
    "ceo_founder",
    "owner",
    "website_developer",
  ]).has(String(role ?? "").trim().toLowerCase());
}

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
