import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../src/app/api/auth/register/route.ts",import.meta.url),"utf8");

test("registration email validation accepts normal addresses containing the letter s",()=>{
  assert.match(source,/\/\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$\//);
  const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  assert.equal(validEmail.test("chrisbrandon200@gmail.com"),true);
  assert.equal(validEmail.test("person@example.com"),true);
  assert.equal(validEmail.test("not-an-email"),false);
});

test("registration name splitting and date validation use whitespace and digit regexes",()=>{
  assert.match(source,/legacyName\.split\(\/\\s\+\//);
  assert.match(source,/\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\//);
  assert.deepEqual("Chris Brandon".split(/\s+/),["Chris","Brandon"]);
});
