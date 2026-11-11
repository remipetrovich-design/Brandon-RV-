# Standalone License Manager Client

A portable, opt-in integration for independent applications. This folder has no OrbitFS runtime, product, customer, billing, or database dependency. It is deliberately not imported by V1 Base routes, startup, build, or existing licence flows. Copy it into another application when that application chooses to connect to the central License Manager.


For reusable Next.js setup (server-only activation, encrypted storage, whole-app page/API guard, recovery routes and product-install checklist), see [`integrations/nextjs/README.md`](./integrations/nextjs/README.md). The client supports an optional `cacheValidForMs` setting for short-lived successful validation caching, capped by the central License Manager validation TTL. Cache entries are isolated by licence-key fingerprint. An application-supplied storage adapter can persist the last successful validation so the configured offline grace can work across serverless instances.

## Central authority

- MAIN API: https://incendiarynetworks.cc/api/v1
- FALLBACK API: https://lm.incendiarynetworks.cc/api/v1

The client reads `/source-configuration` from both fixed endpoints, follows the manager's active `licenseApi`, checks `/license/health`, and refuses to promote a standby manager when the active authority is unhealthy. It sends customer licence keys to `POST /license/validate`; administrative API credentials are never required or embedded in the customer application.

## Register and connect a product

1. In the central License Manager Products page, register the independent application's name and unique Product API ID.
2. Configure the product's maximum installations, feature entitlements, allowed domains, supported version range, and optional offline grace.
3. Issue customer keys for that product through License Manager. Product status, key status, expiry, suspension, revocation, installation bindings, and entitlements remain centrally controlled.
4. Copy this folder into the independent application and configure its registered product ID and a stable installation ID.

```js
import { createLicenseClient } from './standalone-license-module/src/index.js';
import { requireFeature, withLicense } from './standalone-license-module/src/enforcement.js';

const licenseClient = createLicenseClient({
  product: 'your-registered-product-id',
  installationId: 'stable-installation-id'
});

const license = await licenseClient.activate({ licenseKey: submittedKey });
requireFeature(license, 'reports');

const protectedHandler = withLicense(
  licenseClient,
  async (request, validation) => ({ data: 'protected result', entitlements: validation.entitlements }),
  { feature: 'reports' }
);
```

The product identifier must match the Product API ID registered in License Manager. Keep the installation ID stable across restarts. The module uses Node.js 18+ Fetch APIs and has no runtime dependencies.

## Enforcement returned by License Manager

- Invalid, expired, suspended, revoked, disabled-product, and authority-disabled decisions.
- Per-product feature entitlements.
- Maximum active installations and installation binding.
- Allowed host domains and minimum/maximum product versions.
- Configured validation TTL and optional offline grace.
- MAIN/FALLBACK active authority discovery and routing.

Use `requireFeature(validation, 'feature_id')` for entitlement checks, `withLicense(client, handler)` for framework-neutral protected handlers, or `licenseMiddleware(client)` for Express/Connect-style middleware. Enforcement must run on the trusted server for paid or sensitive functionality; frontend-only checks can be bypassed.

## Independent now, commerce-ready later

This module intentionally does not depend on OrbitFS Billing Store or any OrbitFS customer/order model. A future commerce integration can associate an external order or subscription reference with the product and request licence issuance through the License Manager's authenticated integration API. The commerce system must not become the licensing authority: it can initiate a sale or request issuance, while License Manager owns product eligibility, key creation, expiry, suspension, revocation, entitlements, and enforcement. No billing integration is activated by this module.

## Security and storage

Never embed a License Manager administrative API token in a customer application. Runtime validation uses the customer's licence key. Keep keys out of logs, telemetry, URLs, and error messages. Optional offline cache requires an application-supplied async storage adapter; cached validation is bound to a SHA-256 fingerprint of the same licence key. Offline grace is only allowed when both global and product policy permit it.

## Tests

Run `npm test` from this folder. The module has no side effects until an application explicitly imports and configures it. The repository's **Package standalone licence module** GitHub Actions workflow runs these tests and publishes a versioned ZIP artifact whenever this folder changes; download it from the workflow run's Artifacts section.