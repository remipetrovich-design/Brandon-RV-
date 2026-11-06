export declare const GLOBAL_ADMIN_ROLES: Set<string>;
export declare function isGlobalAdministrator(role: unknown): boolean;
export declare function hasEmployeeAccess(user: {user_role?: string|null; employment_status?: string|null}|null|undefined): boolean;
export declare function isHireableCustomer(user: {primary_group?: string|null; status?: string|null; user_role?: string|null; employment_status?: string|null}|null|undefined): boolean;
