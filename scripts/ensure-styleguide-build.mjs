#!/usr/bin/env node
// Makes a cold checkout self-healing: builds @takazudo/zudo-sg when its
// compiled output is missing or stale, before a root command that consumes
// it (`zfb build` / `zfb dev` / `zfb check` / vitest). The root host imports
// the engine through its `exports` map, which points at `dist/` even inside
// the workspace (ADR docs/adr/styleguide-engine.md decision 2), and `dist/`
// is gitignored. Model: zudo-doc's scripts/ensure-workspace-build.mjs.
//
// Existence AND freshness: every literal `./dist/**` exports target (JS and
// .d.ts), every `routes-src/` copy of a `src/routes/` entrypoint, and
// `virtual-modules.d.ts` must exist, else the package is rebuilt (all three
// are gitignored build output — the routes plugin injects `routes-src/*.tsx`).
// When every target exists, a content-hash stamp (`dist/.build-stamp`, also
// gitignored) catches source edits that existence checks can't: mtimes are
// unreliable across branch switches, so `buildInputsHash()` hashes the
// contents of `src/**`, `package.json`, `tsconfig*.json` and the build
// pipeline's own scripts (tsup config + its `onSuccess` steps) instead. A
// missing or mismatched stamp triggers a rebuild; a match skips it. After
// editing package sources, run `pnpm --filter @takazudo/zudo-sg build` (or
// `--force` here) — either always rewrites the stamp on success.
//
// Usage:
//   node scripts/ensure-styleguide-build.mjs          # build only if missing/stale
//   node scripts/ensure-styleguide-build.mjs --force  # always rebuild

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE = { name: "@takazudo/zudo-sg", dir: "packages/styleguide" };
const STAMP_REL_PATH = "dist/.build-stamp";

// The build pipeline's own scripts, beyond `src/**`: tsup's config plus the
// `onSuccess` steps it runs after compiling (tsup.config.ts's onSuccess
// line). Declarations come from tsconfig.build.json, already covered by the
// tsconfig* glob below.
const BUILD_SCRIPT_FILES = [
  "tsup.config.ts",
  "scripts/copy-routes-src.mjs",
  "scripts/copy-virtual-modules.mjs",
  "scripts/emit-islands-dts.mjs",
  "scripts/gen-safelist.mjs",
];

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

/** Every file under `dir`, as paths relative to it, sorted for a deterministic hash order. */
function listFilesRecursive(dir) {
  const out = [];
  (function walk(subdir) {
    const absDir = join(dir, subdir);
    const entries = readdirSync(absDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const rel = subdir ? join(subdir, entry.name) : entry.name;
      if (entry.isDirectory()) walk(rel);
      else if (entry.isFile()) out.push(rel);
    }
  })("");
  return out;
}

/** Top-level `tsconfig*.json` files in a package dir (`tsconfig.json`, `tsconfig.build.json`, …). */
function tsconfigFiles(pkgDir) {
  return readdirSync(pkgDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^tsconfig.*\.json$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

/**
 * Content-hash of everything that should trigger a rebuild when it changes:
 * package sources, the manifest, tsconfigs, and the build pipeline's own
 * scripts. Hashes file contents (not mtimes), so branch switches that only
 * touch timestamps don't cause a spurious rebuild — and a real source edit
 * always does, even with an unchanged mtime.
 */
export function buildInputsHash(pkgDir) {
  const srcDir = join(pkgDir, "src");
  const relFiles = [
    "package.json",
    ...tsconfigFiles(pkgDir),
    ...BUILD_SCRIPT_FILES,
    ...(existsSync(srcDir) ? listFilesRecursive(srcDir).map((rel) => join("src", rel)) : []),
  ].sort();

  const hash = createHash("sha256");
  for (const rel of relFiles) {
    const abs = join(pkgDir, rel);
    if (!existsSync(abs)) continue;
    hash.update(rel);
    hash.update(readFileSync(abs));
  }
  return hash.digest("hex");
}

function readBuildStamp(pkgDir) {
  const file = join(pkgDir, STAMP_REL_PATH);
  if (!existsSync(file)) return null;
  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    return null;
  }
}

function writeBuildStamp(pkgDir, hash) {
  const file = join(pkgDir, STAMP_REL_PATH);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${hash}\n`);
}

function defaultRunBuild(root) {
  return spawnSync("pnpm", ["--filter", PACKAGE.name, "build"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

export function ensureStyleguideBuild({
  force = false,
  root = ROOT,
  log = console.log,
  runBuild = defaultRunBuild,
} = {}) {
  const pkgDir = join(root, PACKAGE.dir);
  const currentHash = buildInputsHash(pkgDir);
  let reason = "--force";
  if (!force) {
    const missing = missingDistTargets(pkgDir);
    if (missing.length > 0) {
      const sample = missing.slice(0, 2).join(", ");
      const rest = missing.length > 2 ? `, +${missing.length - 2} more` : "";
      reason = `missing ${missing.length} build output(s): ${sample}${rest}`;
    } else {
      const stamp = readBuildStamp(pkgDir);
      if (stamp === currentHash) return 0;
      reason = stamp ? "stale build (sources changed since the last build)" : "missing build stamp";
    }
  }

  log(`[ensure-styleguide-build] building ${PACKAGE.name} (${reason})`);
  const result = runBuild(root);
  if (result.status !== 0) {
    console.error(`[ensure-styleguide-build] ${PACKAGE.name} build failed (exit ${result.status ?? "signal"})`);
    return result.status || 1;
  }
  writeBuildStamp(pkgDir, currentHash);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(ensureStyleguideBuild({ force: process.argv.includes("--force") }));
}
