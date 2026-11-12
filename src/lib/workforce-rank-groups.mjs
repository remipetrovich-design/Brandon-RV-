export const WORKFORCE_RANK_GROUPS = [
  { key: "customers", label: "Customers", roles: ["customer"] },
  { key: "base_workers", label: "Base Workers", roles: ["trial_apprentice", "apprentice"] },
  { key: "senior_staff", label: "Senior Staff", roles: ["senior_apprentice", "team_leader"] },
  { key: "supervision_team", label: "Supervision Team", roles: ["supervisor", "office_admin", "office_supervisor"] },
  { key: "management", label: "Management", roles: ["office_manager", "manager", "senior_manager"] },
  { key: "executive", label: "Executive", roles: ["general_manager", "website_development_specialist", "ceo_founder", "owner", "website_developer"] },
];

const GROUP_BY_ROLE = new Map(
  WORKFORCE_RANK_GROUPS.flatMap((group) => group.roles.map((role) => [role, group])),
);

export function getWorkforceRankGroup(role) {
  const key = String(role ?? "").trim().toLowerCase();
  return GROUP_BY_ROLE.get(key) ?? { key: "unassigned", label: "Unclassified", roles: [] };
}

export function groupWorkforceMembers(members) {
  return WORKFORCE_RANK_GROUPS.map((group) => ({
    ...group,
    members: members.filter((member) => group.roles.includes(String(member.user_role ?? "").trim().toLowerCase())),
  }));
}
