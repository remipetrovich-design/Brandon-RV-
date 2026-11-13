import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("Workcard editor loads directly without a dropdown disclosure",async()=>{
 const component=await read("../src/components/admin-workcard-management.tsx");
 assert.doesNotMatch(component,/<details|<summary/);
 assert.match(component,/useEffect/);
});

test("Workcard list links to a dedicated detail page instead of embedding the editor",async()=>{
 const page=await read("../src/app/admin/[section]/page.tsx");
 assert.match(page,/href=\{["']\/admin\/jobs\/["']\+row\.id\}/);
 assert.doesNotMatch(page,/<AdminWorkcardManagement jobId=\{row\.id\}\/>/);
});

test("dedicated Workcard page mounts the complete editor",async()=>{
 const page=await read("../src/app/admin/jobs/[id]/page.tsx");
 assert.match(page,/AdminWorkcardManagement/);
 assert.match(page,/jobs\.manage/);
});
