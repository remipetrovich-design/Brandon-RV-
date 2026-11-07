import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const emailClient = await readFile(new URL("../src/lib/email.ts", import.meta.url), "utf8");
const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");
const productionSetup = await readFile(new URL("../docs/PRODUCTION_SETUP.md", import.meta.url), "utf8");

test("Brandon RV sends template content to the central Mail System API", () => {
  assert.match(emailClient, /ORBITFS_MAIL_URL/);
  assert.match(emailClient, /BRANDONSRV_MAIL_API_KEY/);
  assert.match(emailClient, /BRANDON_RV_MAIL_FROM/);
  assert.match(emailClient, /\/api\/mail/);
  assert.match(emailClient, /from_address/);
  assert.match(emailClient, /Authorization.*Bearer/);
  assert.doesNotMatch(emailClient, /api\.resend\.com/);
  assert.doesNotMatch(emailClient, /RESEND_API_KEY/);
});

test("Brandon RV documents only the central mail integration credentials", () => {
  assert.match(envExample, /ORBITFS_MAIL_URL=/);
  assert.match(envExample, /BRANDONSRV_MAIL_API_KEY=/);
  assert.match(envExample, /BRANDON_RV_MAIL_FROM=/);
  assert.doesNotMatch(envExample, /RESEND_API_KEY=/);
  assert.doesNotMatch(envExample, /EMAIL_FROM=/);
  assert.match(productionSetup, /Mail System/);
  assert.match(productionSetup, /BRANDONSRV_MAIL_API_KEY/);
});
