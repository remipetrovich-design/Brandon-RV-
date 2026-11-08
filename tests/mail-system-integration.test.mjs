import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const emailClient = await readFile(new URL("../src/lib/email.ts", import.meta.url), "utf8");
const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");
const productionSetup = await readFile(new URL("../docs/PRODUCTION_SETUP.md", import.meta.url), "utf8");
const registrationRoute = await readFile(new URL("../src/app/api/auth/register/route.ts", import.meta.url), "utf8");
const passwordRoute = await readFile(new URL("../src/app/api/auth/forgot-password/route.ts", import.meta.url), "utf8");

test("Brandon RV selects an authorised sender identity for each email", () => {
  assert.match(emailClient, /ORBITFS_MAIL_URL/);
  assert.match(emailClient, /BRANDONSRV_MAIL_API_KEY/);
  assert.match(emailClient, /noreply@incendiarynetworks\.cc/);
  assert.match(emailClient, /system@incendiarynetworks\.cc/);
  assert.match(emailClient, /brandonrv@incendiarynetworks\.cc/);
  assert.match(emailClient, /from_address/);
  assert.match(emailClient, /Authorization.*Bearer/);
  assert.doesNotMatch(emailClient, /BRANDON_RV_MAIL_FROM/);
  assert.doesNotMatch(emailClient, /api\.resend\.com/);
  assert.doesNotMatch(emailClient, /RESEND_API_KEY/);
  assert.match(registrationRoute, /sendTemplateEmail/);
  assert.match(registrationRoute, /key:"account_verification"/);
  assert.match(passwordRoute, /sendTemplateEmail/);
  assert.match(passwordRoute, /key:"password_reset"/);
});

test("Brandon RV documents the central mail integration and mailbox responsibilities", () => {
  assert.match(envExample, /ORBITFS_MAIL_URL=/);
  assert.match(envExample, /BRANDONSRV_MAIL_API_KEY=/);
  assert.doesNotMatch(envExample, /BRANDON_RV_MAIL_FROM=/);
  assert.doesNotMatch(envExample, /RESEND_API_KEY=/);
  assert.match(productionSetup, /noreply@incendiarynetworks\.cc/);
  assert.match(productionSetup, /system@incendiarynetworks\.cc/);
  assert.match(productionSetup, /brandonrv@incendiarynetworks\.cc/);
  assert.match(productionSetup, /External systems/);
  assert.match(productionSetup, /send-only/);
});
