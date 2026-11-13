import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const migrationsDir = join(root, "supabase/migrations");
const migrations = (await readdir(migrationsDir))
  .filter((name) => name.endsWith(".sql"))
  .sort();

const errors = [];
const versions = new Map();

for (const file of migrations) {
  const match = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(file);
  if (!match) {
    errors.push(`Invalid migration filename: ${file}. Expected YYYYMMDDHHMMSS_description.sql`);
    continue;
  }
  const version = match[1];
  if (versions.has(version)) {
    errors.push(`Duplicate migration version ${version}: ${versions.get(version)} and ${file}`);
  } else {
    versions.set(version, file);
  }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

const testsDir = join(root, "tests");
if (existsSync(testsDir)) {
  for (const file of await walk(testsDir)) {
    if (!/\.(?:mjs|cjs|js|ts)$/.test(file)) continue;
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/supabase\/migrations\/([^"'\x60\s)]+\.sql)/g)) {
      const referenced = join(migrationsDir, match[1]);
      if (!existsSync(referenced)) {
        errors.push(`Stale migration reference in ${relative(root, file)}: ${match[1]}`);
      }
    }
  }
}

if (errors.length) {
  console.error("Migration integrity check failed:");
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`Migration integrity check passed: ${migrations.length} migration files, unique versions, and all test references resolve.`);
