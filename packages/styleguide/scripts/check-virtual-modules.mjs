#!/usr/bin/env node
// Guard for the generated package-root `virtual-modules.d.ts` (run after the
// package build): present, declares both routes-plugin virtual modules, and
// carries the rewritten bare type specifiers.
// Model: zudo-doc's scripts/check-virtual-modules.mjs.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(PKG_ROOT, "virtual-modules.d.ts");

let content;
try {
  content = readFileSync(FILE, "utf8");
} catch {
  console.error(
    "[check-virtual-modules] ERROR: virtual-modules.d.ts is missing — run `pnpm --filter @takazudo/zudo-sg build` first.",
  );
  process.exit(1);
}

const required = [
  'declare module "virtual:zudo-sg-context"',
  'declare module "virtual:zudo-sg-registry"',
  'declare module "virtual:zudo-sg-tokens"',
  "export const sgContext",
  "export const storyModules",
  "export const storyExportOrder",
  'import("@takazudo/zudo-sg/sg-context")',
  'import("@takazudo/zudo-sg/stories")',
];
const missing = required.filter((needle) => !content.includes(needle));
if (/import\s*\(\s*["']\.\.\//.test(content)) missing.push("(no parent-relative import(...) specifiers)");

if (missing.length > 0) {
  console.error("check:virtual-modules FAILED — virtual-modules.d.ts is missing:");
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}
console.log("OK — virtual-modules.d.ts declares virtual:zudo-sg-context, virtual:zudo-sg-registry and virtual:zudo-sg-tokens.");
