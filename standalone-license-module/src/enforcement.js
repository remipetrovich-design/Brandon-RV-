import { LicenseError } from './index.js';

export function requireFeature(validation, feature) {
  if (!validation || validation.valid !== true) throw new LicenseError('An active licence is required.', { code: 'LICENSE_REQUIRED', status: 403 });
  const components = validation.components && typeof validation.components === 'object' ? validation.components : {};
  const entitlements = validation.entitlements && typeof validation.entitlements === 'object' ? validation.entitlements : {};
  if (components[feature] && components[feature].allowed === true) return true;
  if (entitlements[feature] === true || (entitlements[feature] && entitlements[feature].allowed === true)) return true;
  if (feature === validation.component || feature === validation.product) return true;
  throw new LicenseError('This licence does not include feature: ' + feature, {
    code: 'FEATURE_NOT_ENTITLED', status: 403, details: { feature }
  });
}

export function withLicense(client, handler, options = {}) {
  if (!client || typeof client.enforce !== 'function') throw new TypeError('A license client is required.');
  if (typeof handler !== 'function') throw new TypeError('A handler function is required.');
  return async function licensedHandler(context) {
    const input = typeof options.getLicenseInput === 'function'
      ? await options.getLicenseInput(context)
      : context && context.license;
    const validation = await client.enforce(input || {});
    if (options.feature) requireFeature(validation, options.feature);
    return handler(context, validation);
  };
}

export function licenseMiddleware(client, options = {}) {
  return async function licenseManagerMiddleware(req, res, next) {
    try {
      const input = typeof options.getLicenseInput === 'function'
        ? await options.getLicenseInput(req)
        : req && req.body && req.body.license;
      const validation = await client.enforce(input || {});
      if (options.feature) requireFeature(validation, options.feature);
      req.license = validation;
      return next();
    } catch (error) {
      const status = Number(error.status || 403);
      return res.status(status).json({
        valid: false,
        code: error.code || 'LICENSE_REQUIRED',
        error: error.message || 'Licence enforcement failed'
      });
    }
  };
}