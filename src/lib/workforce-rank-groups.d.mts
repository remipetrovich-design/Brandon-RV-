export type WorkforceRankGroupKey =
  | "customers"
  | "base_workers"
  | "senior_staff"
  | "supervision_team"
  | "management"
  | "executive"
  | "unassigned";

export type WorkforceRankGroup = {
  key: WorkforceRankGroupKey;
  label: string;
  roles: string[];
};

export type WorkforceMember = {
  id?: string;
  user_role?: string | null;
  [key: string]: unknown;
};

export const WORKFORCE_RANK_GROUPS: WorkforceRankGroup[];

export function getWorkforceRankGroup(role: string | null | undefined): WorkforceRankGroup;

export function groupWorkforceMembers<T extends WorkforceMember>(
  members: T[],
): Array<WorkforceRankGroup & { members: T[] }>;
