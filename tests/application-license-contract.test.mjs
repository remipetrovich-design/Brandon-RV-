import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('all Brandon RV routes are licence-gated except recovery and licence management',()=>{
 const proxy=read('../src/proxy.ts');
 assert.match(proxy,/getApplicationLicenseState/);
 assert.match(proxy,/NextResponse\.redirect\(destination\)/);
 assert.match(proxy,/status:423/);
 for(const path of ['/license','/portal/sign-in','/portal/register','/portal/verify-email','/api/auth/']){
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
