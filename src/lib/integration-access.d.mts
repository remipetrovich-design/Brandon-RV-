export type IntegrationScopeGroup = { group: string; scopes: string[] };
export const INTEGRATION_SCOPES: IntegrationScopeGroup[];
export const ALL_INTEGRATION_SCOPES: string[];
export function hasIntegrationScope(grantedScopes: string[] | null | undefined, requiredScope: string | null | undefined): boolean;
export function validateIntegrationScopes(scopes: unknown): { valid: boolean; invalid: string[] };
export function isIntegrationCredentialActive(credential: { revoked_at?: string | null; expires_at?: string | null } | null | undefined, now?: Date): boolean;
