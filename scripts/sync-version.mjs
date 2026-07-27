#!/usr/bin/env node
/**
 * Keep one version everywhere: root package.json is the source of truth.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;

const packagePaths = [
  "package.json",
  "packages/shared/package.json",
  "packages/daemon/package.json",
  "apps/desktop/package.json",
];

for (const rel of packagePaths) {
  const path = join(root, rel);
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  pkg.version = version;
  if (pkg.dependencies?.["@insyncown/shared"]) {
    pkg.dependencies["@insyncown/shared"] = version;
  }
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

const sharedSrc = join(root, "packages/shared/src/index.ts");
const sharedText = readFileSync(sharedSrc, "utf8");
const nextShared = sharedText.replace(
  /export const APP_VERSION = "[^"]+";/,
  `export const APP_VERSION = "${version}";`,
);
if (nextShared === sharedText) {
  console.error("sync-version: APP_VERSION line not found in shared/src/index.ts");
  process.exit(1);
}
writeFileSync(sharedSrc, nextShared, "utf8");

console.log(`Synced version ${version}`);
