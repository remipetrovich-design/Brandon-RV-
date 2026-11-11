# Next.js integration kit

This is the repeatable installation path for any independent Next.js product. Copy the complete `standalone-license-module` folder into the new repository, then add the small server adapter and route guard below. Do not copy Brandon RV-specific database names, product IDs, auth logic, or encryption keys.

## Required application-specific settings

- `LICENSE_PRODUCT_ID`: exact Product API ID registered in License Manager (for Brandon RV this is `brandon-rv`).
- `LICENSE_INSTALLATION_ID`: stable UUID generated once per installed business instance and persisted server-side. Do not use a user ID, session ID, browser fingerprint, or per-employee ID.
- `LICENSE_KEY_ENCRYPTION_SECRET`: random secret of at least 32 characters. Server-only; never use a `NEXT_PUBLIC_` prefix.
- `LICENSE_KEY`: do not place the customer's key in source code or a public environment variable. Accept it through an owner-only server endpoint and encrypt it at rest.

## Recommended request flow

1. Owner signs in using the application's existing authentication system.
2. An owner-only licence page submits the customer key to a same-origin server endpoint.
3. The endpoint validates against the active Main/Fallback authority using `createLicenseClient`.
4. Only after a valid response, encrypt the key with AES-256-GCM and persist ciphertext, IV, authentication tag and the stable installation ID.
5. A server-side Next.js proxy checks the licence before allowing protected page and API requests. Exempt only the licence page/API, sign-in, registration and account-recovery routes needed to restore access.
6. Return HTTP 423 for blocked API calls and redirect blocked page requests to the licence page.
7. Keep the positive validation cache short (default recommendation: 60 seconds). Cache by key fingerprint; never cache denials as valid. Offline grace is only accepted when the central product policy allows it.

## Minimal server-side client

```ts
import "server-only";
import {createLicenseClient} from "./standalone-license-module/src/index.js";

export const licenseClient = createLicenseClient({
  product: process.env.LICENSE_PRODUCT_ID!,
  component: process.env.LICENSE_PRODUCT_ID!,
  installationId: await loadStableInstallationIdFromServerDatabase(),
  cacheValidForMs: 60_000,
  timeoutMs: 7_000
});
```

The database and `loadStableInstallationIdFromServerDatabase` are intentionally application-specific. Keep the licence key server-side and pass it to `licenseClient.enforce({licenseKey, productVersion})` from the server adapter.

## Enforcement boundaries

- Apply the guard to both website pages and API routes. Hiding navigation or showing a React overlay alone is not enforcement.
- Never trust a licence status submitted by the browser.
- Do not gate the licence page or owner sign-in behind the licence itself.
- Do not bypass a suspended, revoked, expired, invalid or deliberately disabled licence with offline cache.
- Never fail open if the License Manager cannot be reached. A previously validated licence may use only its explicitly configured offline grace.
- Keep each product's customer accounts and database unchanged. One licence represents the business installation, not each employee/customer login.

## Product installation checklist

- [ ] Register product and Product API ID in License Manager.
- [ ] Set installation limit, version range, allowed domains, entitlements and offline grace policy.
- [ ] Add the migration for encrypted licence storage and revoke public database access.
- [ ] Add the server-only licence adapter and owner-only activation endpoint.
- [ ] Add the licence page and whole-app page/API guard.
- [ ] Add the encryption secret to the server deployment environment.
- [ ] Install a test key and verify valid, invalid, expired, suspended, revoked and service-unavailable cases.
- [ ] Verify login and licence recovery remain reachable when access is blocked.
- [ ] Run unit tests, typecheck, production build and a live staging validation.
