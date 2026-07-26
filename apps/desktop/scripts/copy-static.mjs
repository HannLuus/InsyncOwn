import { cpSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "..", "static");
const dest = join(root, "..", "dist", "static");
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
copyFileSync(
  join(root, "..", "src", "preload.cjs"),
  join(root, "..", "dist", "preload.cjs"),
);
console.log("Copied static UI assets and preload.cjs");
