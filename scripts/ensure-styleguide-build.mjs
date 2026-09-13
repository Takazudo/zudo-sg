#!/usr/bin/env node
// Makes a cold checkout self-healing: builds @takazudo/zudo-sg when its
// compiled output is missing, before a root command that consumes it
// (`zfb build` / `zfb dev` / `zfb check` / vitest). The root host imports the
// engine through its `exports` map, which points at `dist/` even inside the
// workspace (ADR docs/adr/styleguide-engine.md decision 2), and `dist/` is
// gitignored. Model: zudo-doc's scripts/ensure-workspace-build.mjs.
//
// Existence, not freshness: every literal `./dist/**` exports target (JS and
// .d.ts), every `routes-src/` copy of a `src/routes/` entrypoint, and
// `virtual-modules.d.ts` must exist, else the package is rebuilt (all three
// are gitignored build output — the routes plugin injects `routes-src/*.tsx`). After editing package
// sources, run `pnpm --filter @takazudo/zudo-sg build` (or `--force` here).
//
// Usage:
//   node scripts/ensure-styleguide-build.mjs          # build only if incomplete
//   node scripts/ensure-styleguide-build.mjs --force  # always rebuild

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE = { name: "@takazudo/zudo-sg", dir: "packages/styleguide" };

/** Every literal `./dist/**` path the package's exports map declares. */
export function declaredDistTargets(exportsMap) {
  const targets = new Set();
  (function walk(node) {
    if (typeof node === "string") {
      if (node.startsWith("./dist/") && !node.includes("*")) targets.add(node);
      return;
    }
    if (node && typeof node === "object") Object.values(node).forEach(walk);
  })(exportsMap);
  return [...targets];
}

/** `routes-src/` files the build generates: one per `src/routes/*.{ts,tsx}` (no .d.ts / tests), plus `virtual-modules.d.ts`. */
export function generatedRouteTargets(pkgDir) {
  const srcRoutes = join(pkgDir, "src/routes");
  if (!existsSync(srcRoutes)) return [];
  const routes = readdirSync(srcRoutes, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name) && !e.name.endsWith(".d.ts") && !/\.test\.tsx?$/.test(e.name))
    .map((e) => `./routes-src/${e.name}`);
  return [...routes, "./virtual-modules.d.ts"];
}

/** Returns the missing build outputs of a package dir (empty when complete). */
export function missingDistTargets(pkgDir) {
  const manifest = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  return [...declaredDistTargets(manifest.exports), ...generatedRouteTargets(pkgDir)].filter(
    (file) => !existsSync(join(pkgDir, file)),
  );
}

export function ensureStyleguideBuild({ force = false, root = ROOT, log = console.log } = {}) {
  const pkgDir = join(root, PACKAGE.dir);
  let reason = "--force";
  if (!force) {
    const missing = missingDistTargets(pkgDir);
    if (missing.length === 0) return 0;
    const sample = missing.slice(0, 2).join(", ");
    const rest = missing.length > 2 ? `, +${missing.length - 2} more` : "";
    reason = `missing ${missing.length} build output(s): ${sample}${rest}`;
  }

  log(`[ensure-styleguide-build] building ${PACKAGE.name} (${reason})`);
  const result = spawnSync("pnpm", ["--filter", PACKAGE.name, "build"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(`[ensure-styleguide-build] ${PACKAGE.name} build failed (exit ${result.status ?? "signal"})`);
    return result.status || 1;
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(ensureStyleguideBuild({ force: process.argv.includes("--force") }));
}
