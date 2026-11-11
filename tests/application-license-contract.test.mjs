import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('all Brandon RV routes are licence-gated except recovery and licence management',()=>{
 const proxy=read('../src/proxy.ts');
 assert.match(proxy,/getApplicationLicenseState/);
 assert.match(proxy,/NextResponse\.redirect\(destination\)/);
 assert.match(proxy,/status:423/);
 assert.match(proxy,/allowedAuthApis/);
 assert.doesNotMatch(proxy,/portal\/register/);
 assert.doesNotMatch(proxy,/api\/auth\/\//);
 for(const path of ['/license','/portal/sign-in','/portal/verify-email','/admin/license','/api/auth/login','/api/admin/license']){
  assert.ok(proxy.includes(path),'missing allowed recovery path '+path);
 }
});
test('licence activation is restricted to owner and website developer accounts',()=>{
 const route=read('../src/app/api/license/route.ts');
 assert.match(route,/currentUser/);
 assert.match(route,/sameOrigin/);
 assert.match(route,/owner.*website_developer/);
 assert.match(route,/installApplicationLicense/);
});
test('the licence key is encrypted server-side and never returned to the browser',()=>{
 const service=read('../src/lib/brandon-license.ts');
 assert.match(service,/createCipheriv\("aes-256-gcm"/);
 assert.match(service,/createDecipheriv\("aes-256-gcm"/);
 assert.match(service,/BRANDON_RV_LICENSE_ENCRYPTION_SECRET/);
 assert.doesNotMatch(service,/NEXT_PUBLIC_/);
 const route=read('../src/app/api/license/route.ts');
 assert.doesNotMatch(route,/encrypted_license_key/);
});
test('the installed product and installation identity are stable and product-specific',()=>{
 const service=read('../src/lib/brandon-license.ts');
 assert.match(service,/PRODUCT_ID="brandon-rv"/);
 assert.match(service,/installation_id/);
 assert.match(service,/randomUUID\(\)/);
});
test('the standalone module has bounded successful caching and per-key cache isolation',()=>{
 const client=read('../standalone-license-module/src/index.js');
 assert.match(client,/cacheValidForMs/);
 assert.match(client,/lastValid\.keyFingerprint/);
 assert.match(read('../standalone-license-module/test/license-client.test.js'),/reuses a recent successful validation only for the same licence key/);
});
test('application licence storage is not accessible to public Supabase roles',()=>{
 const migration=read('../supabase/migrations/20261112090000_application_license.sql');
 assert.match(migration,/enable row level security/i);
 assert.match(migration,/revoke all on public\.application_license from anon, authenticated/i);
});

test('admin licence monitor can be used while the application is otherwise licence-blocked',()=>{
 const proxy=read('../src/proxy.ts');
 assert.match(proxy,/"\/admin\/license"/);
 assert.match(proxy,/"\/api\/admin\/license"/);
 const route=read('../src/app/api/admin/license/route.ts');
 assert.match(route,/userHasPermission/);
 assert.match(route,/forceRecheck:true/);
});
test('successful validation cache is persisted only server-side for configured offline grace',()=>{
 const service=read('../src/lib/brandon-license.ts');
 assert.match(service,/cached_validation/);
 assert.match(service,/cacheValidForMs:forceRecheck\?0:CACHE_MS/);
 assert.match(service,/storage:/);
 const migration=read('../supabase/migrations/20261112100000_application_license_validation_cache.sql');
 assert.match(migration,/add column if not exists cached_validation jsonb/i);
});
test('admin navigation points to the monitor and licence entry remains separate',()=>{
 const layout=read('../src/app/admin/layout.tsx');
 assert.match(layout,/href:"\/admin\/license"/);
 const page=read('../src/app/license/page.tsx');
 assert.match(page,/LicenseManagerPanel/);
});
