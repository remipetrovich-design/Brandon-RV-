import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../src/app/api/auth/register/route.ts",import.meta.url),"utf8");

test("registration accepts any non-empty email text without format validation",()=>{
  assert.match(source,/if\(!email\|\|email\.length>254\)return jsonError\("Enter an email address\."\)/);
  assert.doesNotMatch(source,/valid email address|validEmail/);
  assert.equal("chrisbrandon200@gmail.com".trim().toLowerCase().length>0,true);
  assert.equal("not-an-email".trim().toLowerCase().length>0,true);
});

test("registration name splitting and date validation use whitespace and digit regexes",()=>{
  assert.match(source,/legacyName\.split\(\/\\s\+\//);
  assert.match(source,/\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\//);
  assert.deepEqual("Chris Brandon".split(/\s+/),["Chris","Brandon"]);
});
