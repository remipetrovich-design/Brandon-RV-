/** Portable, opt-in License Manager client. No V1 Base imports or side effects. */
export const LICENSE_AUTHORITIES = Object.freeze({
  main: 'https://incendiarynetworks.cc/api/v1',
  fallback: 'https://lm.incendiarynetworks.cc/api/v1'
});

export class LicenseError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'LicenseError';
    this.code = options.code || 'LICENSE_ERROR';
    this.status = options.status || 403;
    this.details = options.details || null;
  }
}

const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const policyOf = result => object(result && (result.runtime_policy || result.runtimePolicy));
const transient = error => {
  if (error.code === 'LICENSING_AUTHORITY_DISABLED' || error.code === 'SOURCE_MODE_STANDBY') return false;
  return !error.status || [408, 425, 429].includes(error.status) || error.status >= 500;
};
const fingerprintKey = async key => {
  if (!globalThis.crypto || !globalThis.crypto.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

export function createLicenseClient(options = {}) {
  const fetcher = options.fetch || globalThis.fetch;
  if (typeof fetcher !== 'function') throw new TypeError('A Fetch-compatible implementation is required.');
  const product = String(options.product || '').trim().toLowerCase();
  const component = String(options.component || product).trim().toLowerCase();
  const installationId = String(options.installationId || '').trim();
  if (!product) throw new TypeError('A product identifier is required.');
  if (!installationId) throw new TypeError('A stable installationId is required.');
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || 7000));
  const storage = options.storage || null;
  const cacheKey = 'license-manager-client:' + product + ':' + installationId;
  const sourceUrls = [
    LICENSE_AUTHORITIES.main + '/source-configuration',
    LICENSE_AUTHORITIES.fallback + '/source-configuration'
  ];
  let currentAuthority = null;
  let lastValid = null;

  async function request(url, init = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(url, {
        ...init,
        cache: 'no-store',
        signal: controller.signal,
        headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.headers || {}) }
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new LicenseError(body.error || body.code || ('License Manager HTTP ' + response.status), {
        code: body.code || 'LICENSE_MANAGER_HTTP_ERROR', status: response.status, details: body
      });
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  async function detectAuthority({ force = false } = {}) {
    if (!force && currentAuthority && Date.now() - currentAuthority.checkedAt < 5000) return currentAuthority;
    let lastError = null;
    for (const sourceUrl of sourceUrls) {
      let authoritativeConfigFound = false;
      try {
        const config = await request(sourceUrl);
        const mode = String(config.mode || '').toLowerCase();
        if (config.protocol !== 1 || !['main', 'fallback'].includes(mode)) continue;
        const baseUrl = LICENSE_AUTHORITIES[mode];
        if (!config.active || config.active.licenseApi !== baseUrl) continue;
        authoritativeConfigFound = true;
        let health;
        try {
          health = await request(baseUrl + '/license/health');
        } catch (error) {
          throw new LicenseError('The configured active License Manager is unavailable.', {
            code: 'ACTIVE_AUTHORITY_UNAVAILABLE', status: 503, details: { mode, cause: error.code || error.message }
          });
        }
        if (health.ok !== true || health.service !== 'license-manager') {
          throw new LicenseError('The configured active License Manager is unhealthy.', {
            code: 'ACTIVE_AUTHORITY_UNAVAILABLE', status: 503, details: { mode, health }
          });
        }
        if (!health.capabilities || health.capabilities.license_validation !== true) {
          throw new LicenseError('Licensing is disabled on the active authority.', {
            code: 'LICENSING_AUTHORITY_DISABLED', status: 503, details: { mode, health }
          });
        }
        currentAuthority = { mode, baseUrl, revision: config.revision || null, checkedAt: Date.now(), health };
        return currentAuthority;
      } catch (error) {
        lastError = error;
        // Never promote the standby if authoritative config names an unhealthy manager.
        if (authoritativeConfigFound || error.code === 'ACTIVE_AUTHORITY_UNAVAILABLE' || error.code === 'LICENSING_AUTHORITY_DISABLED') throw error;
      }
    }
    throw new LicenseError('Could not determine the active License Manager.', {
      code: 'AUTHORITY_DISCOVERY_FAILED', status: 503,
      details: lastError ? { code: lastError.code || null, message: lastError.message } : null
    });
  }

  async function readCache() {
    if (storage && typeof storage.get === 'function') return (await storage.get(cacheKey)) || lastValid;
    return lastValid;
  }
  async function writeCache(value) {
    lastValid = value;
    if (storage && typeof storage.set === 'function') await storage.set(cacheKey, value);
  }

  async function validate(input = {}) {
    const key = String(input.licenseKey || '').trim();
    const cacheMs = Math.max(0, Number(options.cacheValidForMs || 0));
    if (cacheMs > 0 && lastValid && lastValid.valid === true && lastValid.licenseKeyFingerprint &&
        Date.now() - Number(lastValid.checkedAt || 0) < cacheMs) {
      const requestedFingerprint = await fingerprintKey(key);
      if (requestedFingerprint && requestedFingerprint === lastValid.keyFingerprint) return lastValid;
    }
    const action = input.action || 'validate';
    if (!key || key.length > 256) throw new LicenseError('A licence key is required.', { code: 'LICENSE_KEY_REQUIRED', status: 400 });
    if (!['validate', 'activate', 'check_in'].includes(action)) throw new LicenseError('Unsupported validation action.', { code: 'INVALID_ACTION', status: 400 });
    const keyFingerprint = await fingerprintKey(key);
    const payload = {
      license_key: key, product, component, installation_id: installationId,
      product_version: input.productVersion || null, action,
      metadata: object(input.metadata), telemetry: object(input.telemetry)
    };
    try {
      let selected = await detectAuthority({ force: true });
      let result;
      try {
        result = await request(selected.baseUrl + '/license/validate', { method: 'POST', body: JSON.stringify(payload) });
      } catch (error) {
        if (error.code !== 'SOURCE_MODE_STANDBY') throw error;
        selected = await detectAuthority({ force: true });
        result = await request(selected.baseUrl + '/license/validate', { method: 'POST', body: JSON.stringify(payload) });
      }
      const normalized = { ...result, checkedAt: Date.now(), authority: selected.mode, installationId, product, keyFingerprint };
      if (result.valid !== true) throw new LicenseError(result.code || 'LICENSE_INVALID', {
        code: result.code || 'LICENSE_INVALID', status: 403, details: normalized
      });
      await writeCache(normalized);
      return normalized;
    } catch (error) {
      if (!transient(error)) throw error;
      const cached = await readCache();
      if (!cached || cached.valid !== true || !keyFingerprint || cached.keyFingerprint !== keyFingerprint) throw error;
      const policy = policyOf(cached);
      const allowed = policy.allow_offline_grace === true || policy.allowOfflineGrace === true;
      const grace = Number(policy.offline_grace_seconds || policy.offlineGraceSeconds || 0);
      const ttl = Number(policy.validation_ttl_seconds || policy.validationTtlSeconds || 0);
      const age = Math.max(0, (Date.now() - Number(cached.checkedAt || 0)) / 1000);
      const limit = ttl + grace;
      if (!allowed || grace <= 0 || age > limit) throw error;
      return { ...cached, offlineGrace: true, offlineGraceRemainingSeconds: Math.max(0, limit - age) };
    }
  }

  return Object.freeze({
    product, component, installationId, detectAuthority,
    validate,
    activate: input => validate({ ...input, action: 'activate' }),
    checkIn: input => validate({ ...input, action: 'check_in' }),
    async enforce(input) {
      const result = await validate(input);
      if (result.valid !== true) throw new LicenseError(result.code || 'LICENSE_INVALID', { code: result.code || 'LICENSE_INVALID', status: 403, details: result });
      return result;
    }
  });
}