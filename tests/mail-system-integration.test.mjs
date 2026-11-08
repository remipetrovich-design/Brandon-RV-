import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const emailClient = await readFile(new URL("../src/lib/email.ts", import.meta.url), "utf8");
const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");
const productionSetup = await readFile(new URL("../docs/PRODUCTION_SETUP.md", import.meta.url), "utf8");
const registrationRoute = await readFile(new URL("../src/app/api/auth/register/route.ts", import.meta.url), "utf8");
const passwordRoute = await readFile(new URL("../src/app/api/auth/forgot-password/route.ts", import.meta.url), "utf8");

test("Brandon RV resolves assigned sender addresses from the existing External System", () => {
  assert.match(emailClient, /ORBITFS_MAIL_URL/);
  assert.match(emailClient, /BRANDONSRV_MAIL_API_KEY/);
  assert.match(emailClient, /\/api\/mail\/senders/);
  assert.match(emailClient, /from_address:\s*fromAddress/);
  assert.match(emailClient, /item\.address\.split\("@"\)\[0\]===input\.sender/);
  assert.match(emailClient, /data\.sender/);
  assert.match(emailClient, /Authorization.*Bearer/);
  assert.doesNotMatch(emailClient, /noreply@incendiarynetworks\.cc/);
  assert.doesNotMatch(emailClient, /system@incendiarynetworks\.cc/);
  assert.doesNotMatch(emailClient, /brandonrv@incendiarynetworks\.cc/);
  assert.doesNotMatch(emailClient, /BRANDON_RV_MAIL_FROM/);
  assert.doesNotMatch(emailClient, /api\.resend\.com/);
  assert.doesNotMatch(emailClient, /RESEND_API_KEY/);
  assert.match(registrationRoute, /sender:"noreply"/);
  assert.match(passwordRoute, /sender:"noreply"/);
});

test("Brandon RV documents the central mail integration without duplicating sender addresses", () => {
  assert.match(envExample, /ORBITFS_MAIL_URL=/);
  assert.match(envExample, /BRANDONSRV_MAIL_API_KEY=/);
  assert.doesNotMatch(envExample, /BRANDON_RV_MAIL_FROM=/);
  assert.doesNotMatch(envExample, /RESEND_API_KEY=/);
  assert.match(productionSetup, /External systems/);
  assert.match(productionSetup, /send-only/);
  assert.match(productionSetup, /sender address/);
  assert.doesNotMatch(productionSetup, /noreply@incendiarynetworks\.cc/);
  assert.doesNotMatch(productionSetup, /system@incendiarynetworks\.cc/);
  assert.doesNotMatch(productionSetup, /brandonrv@incendiarynetworks\.cc/);
});

const verificationRoute = await readFile(new URL("../src/app/api/auth/verify-email/route.ts", import.meta.url), "utf8");
const resetCompletionRoute = await readFile(new URL("../src/app/api/auth/reset-password/route.ts", import.meta.url), "utf8");
const templates = await readFile(new URL("../src/lib/email/templates.mjs", import.meta.url), "utf8");

test("registration sends the branded mandatory email verification template", () => {
  assert.match(registrationRoute, /sendBrandonRvTemplateEmail/);
  assert.match(registrationRoute, /verification_url:link/);
  assert.match(registrationRoute, /sender:"noreply"/);
  assert.match(registrationRoute, /status:verificationEnabled\?"pending":"active"/);
  assert.match(templates, /verify_account:/);
});

test("password recovery sends the branded reset template and security confirmation", () => {
  assert.match(passwordRoute, /sendBrandonRvTemplateEmail/);
  assert.match(passwordRoute, /reset_url:link/);
  assert.match(resetCompletionRoute, /sendBrandonRvTemplateEmail/);
  assert.match(resetCompletionRoute, /sender:"noreply"/);
  assert.match(templates, /forgot_password:/);
  assert.match(templates, /password_changed:/);
});

test("verified customers automatically receive the welcome email", () => {
  assert.match(verificationRoute, /sendBrandonRvTemplateEmail/);
  assert.match(verificationRoute, /sender:"noreply"/);
  assert.match(verificationRoute, /await createSession/);
  assert.match(templates, /welcome:/);
});
