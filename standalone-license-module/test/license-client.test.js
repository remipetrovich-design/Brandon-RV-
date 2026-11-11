import test from 'node:test';
import assert from 'node:assert/strict';
import { createLicenseClient, LICENSE_AUTHORITIES, LicenseError } from '../src/index.js';
import { requireFeature, withLicense } from '../src/enforcement.js';

const config = mode => ({ protocol: 1, mode, revision: 9, active: { licenseApi: LICENSE_AUTHORITIES[mode] } });
const health = { ok: true, service: 'license-manager', capabilities: { license_validation: true } };
const opts = fetch => ({ product: 'my-app', component: 'my-app', installationId: 'install-123', fetch });

function fakeFetch(mode = 'main', validation = { valid: true, code: 'LICENSE_VALID', runtime_policy: {} }) {
  const calls = [];
  const fetch = async url => {
    calls.push(url);
    if (url.endsWith('/source-configuration')) return new Response(JSON.stringify(config(mode)), { status: 200 });
    if (url.endsWith('/license/health')) return new Response(JSON.stringify(health), { status: 200 });
    if (url.endsWith('/license/validate')) return new Response(JSON.stringify(validation), { status: 200 });
    return new Response('{}', { status: 404 });
  };
  fetch.calls = calls;
  return fetch;
}

test('detects MAIN and validates against MAIN', async () => {
  const fetch = fakeFetch('main');
  const result = await createLicenseClient(opts(fetch)).validate({ licenseKey: 'LIC-TEST' });
  assert.equal(result.authority, 'main');
  assert.ok(fetch.calls.includes(LICENSE_AUTHORITIES.main + '/license/validate'));
});

test('detects FALLBACK and validates against FALLBACK', async () => {
  const fetch = fakeFetch('fallback');
  const result = await createLicenseClient(opts(fetch)).validate({ licenseKey: 'LIC-TEST' });
  assert.equal(result.authority, 'fallback');
  assert.ok(fetch.calls.includes(LICENSE_AUTHORITIES.fallback + '/license/validate'));
});

test('does not promote standby when configured active authority is unhealthy', async () => {
  const fetch = async url => {
    if (url.endsWith('/source-configuration')) return new Response(JSON.stringify(config('main')), { status: 200 });
    if (url.endsWith('/license/health')) return new Response(JSON.stringify({ ok: false }), { status: 503 });
    throw new Error('Standby validation must not be attempted.');
  };
  const client = createLicenseClient(opts(fetch));
  await assert.rejects(() => client.detectAuthority({ force: true }), error => error.code === 'ACTIVE_AUTHORITY_UNAVAILABLE');
});

test('requires a stable installation ID and rejects unsupported actions', async () => {
  assert.throws(() => createLicenseClient({ product: 'app', fetch: fakeFetch() }), /installationId/);
  const client = createLicenseClient(opts(fakeFetch()));
  await assert.rejects(() => client.validate({ licenseKey: 'x', action: 'delete' }), error => error.code === 'INVALID_ACTION');
});

test('enforces feature entitlements and protects wrapped handlers', async () => {
  const validation = { valid: true, product: 'app', component: 'app', components: { reports: { allowed: true } } };
  assert.equal(requireFeature(validation, 'reports'), true);
  assert.throws(() => requireFeature(validation, 'billing'), error => error.code === 'FEATURE_NOT_ENTITLED');
  const wrapped = withLicense({ enforce: async () => validation }, async (_context, license) => license.valid, { feature: 'reports' });
  assert.equal(await wrapped({}), true);
});

test('returns a typed denial for suspended licences', async () => {
  const fetch = fakeFetch('main', { valid: false, code: 'LICENSE_SUSPENDED' });
  await assert.rejects(
    () => createLicenseClient(opts(fetch)).validate({ licenseKey: 'LIC-TEST' }),
    error => error instanceof LicenseError && error.code === 'LICENSE_SUSPENDED'
  );
});

test('uses configured offline grace only after a previous valid response', async () => {
  let offline = false;
  const fetch = async url => {
    if (offline) throw new TypeError('network unavailable');
    if (url.endsWith('/source-configuration')) return new Response(JSON.stringify(config('main')), { status: 200 });
    if (url.endsWith('/license/health')) return new Response(JSON.stringify(health), { status: 200 });
    if (url.endsWith('/license/validate')) return new Response(JSON.stringify({
      valid: true, code: 'LICENSE_VALID',
      runtime_policy: { allow_offline_grace: true, validation_ttl_seconds: 0, offline_grace_seconds: 60 }
    }), { status: 200 });
    return new Response('{}', { status: 404 });
  };
  const client = createLicenseClient(opts(fetch));
  await client.validate({ licenseKey: 'LIC-TEST' });
  offline = true;
  const cached = await client.validate({ licenseKey: 'LIC-TEST' });
  assert.equal(cached.valid, true);
  assert.equal(cached.offlineGrace, true);
});


test('does not reuse offline grace for a different licence key', async () => {
  let offline = false;
  const fetch = async url => {
    if (offline) throw new TypeError('network unavailable');
    if (url.endsWith('/source-configuration')) return new Response(JSON.stringify(config('main')), { status: 200 });
    if (url.endsWith('/license/health')) return new Response(JSON.stringify(health), { status: 200 });
    if (url.endsWith('/license/validate')) return new Response(JSON.stringify({
      valid: true, code: 'LICENSE_VALID',
      runtime_policy: { allow_offline_grace: true, validation_ttl_seconds: 0, offline_grace_seconds: 60 }
    }), { status: 200 });
    return new Response('{}', { status: 404 });
  };
  const client = createLicenseClient(opts(fetch));
  await client.validate({ licenseKey: 'LIC-ONE' });
  offline = true;
  await assert.rejects(() => client.validate({ licenseKey: 'LIC-TWO' }), error => error.code === 'AUTHORITY_DISCOVERY_FAILED');
});

test('does not use offline grace when licensing is deliberately disabled', async () => {
  const fetch = async url => {
    if (url.endsWith('/source-configuration')) return new Response(JSON.stringify(config('main')), { status: 200 });
    if (url.endsWith('/license/health')) return new Response(JSON.stringify({ ok: true, service: 'license-manager', capabilities: { license_validation: false } }), { status: 200 });
    throw new Error('Validation must not run');
  };
  const client = createLicenseClient(opts(fetch));
  await assert.rejects(() => client.validate({ licenseKey: 'LIC-TEST' }), error => error.code === 'LICENSING_AUTHORITY_DISABLED');
});
