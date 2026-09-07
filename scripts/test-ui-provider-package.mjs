// Runs the standalone `@zudo-sg/ui` gate on a copy of the package placed outside the workspace.
//
// Why the copy: pnpm's `verify-deps-before-run` (on by default since pnpm 11) re-installs a
// package's dependencies before any `pnpm run`/`pnpm exec` whose cwd is inside it. Because
// packages/ui carries its own `pnpm-workspace.yaml` (`packages: []`) and `pnpm-lock.yaml`, the
// nearest lockfile is the standalone one, so running the gate in place replaces the workspace
// symlinks under packages/ui/node_modules with a second, self-contained store -- giving the repo
// two Preact module identities. Running the same checks on a copy proves exactly the same thing
// (the package installs and passes from its own frozen lockfile, independent of the root
// workspace) while leaving the developer's tree workspace-linked. See issues #530 / #560 / #569.

import { spawn } from "node:child_process";
import { access, cp, lstat, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourcePath = "packages/ui";
const packageRoot = path.join(root, sourcePath);
const requiredFiles = [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "vitest.config.ts",
  "vitest.setup.ts",
];

function fail(message) {
  throw new Error(`[ui provider package] ${message}`);
}

// stdio is inherited rather than captured: typecheck and vitest output is the point of this gate,
// and it should stream while the run is in progress.
function run(command, commandArgs, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd, env: process.env, stdio: "inherit" });
    child.on("error", (error) => reject(new Error(`[ui provider package] ${command} could not start: ${error.message}`)));
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      reject(new Error(`[ui provider package] ${command} ${commandArgs.join(" ")} failed (${reason})`));
    });
  });
}

// The healthy state is workspace-linked: packages/ui/node_modules/preact is a symlink up into the
// root store and there is no nested .pnpm at all. Probe the filesystem, never pnpm's output --
// `Already up to date` is printed both by the root install that repairs nothing and by the one
// that follows a successful `rm -rf`.
async function contaminationReasons() {
  const modules = path.join(packageRoot, "node_modules");
  const reasons = [];

  let nestedStore = [];
  try {
    nestedStore = await readdir(path.join(modules, ".pnpm"));
  } catch {
    // No nested store directory at all -- the healthy shape.
  }
  // Glob, never an exact version: the real entry carries a peer suffix
  // (`preact@10.29.8_preact-render-to-string@6.7.0`).
  const nestedPreact = nestedStore.filter((entry) => entry.startsWith("preact@"));
  if (nestedPreact.length > 0) {
    reasons.push(`${sourcePath}/node_modules/.pnpm holds a nested Preact store: ${nestedPreact.join(", ")}`);
  }

  try {
    const entry = await lstat(path.join(modules, "preact"));
    if (!entry.isSymbolicLink()) {
      reasons.push(`${sourcePath}/node_modules/preact is a real ${entry.isDirectory() ? "directory" : "file"}; the workspace-linked state is a symlink`);
    }
  } catch {
    // Nothing installed under packages/ui -- not contamination.
  }

  return reasons;
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function assertCopyIsComplete(directory) {
  for (const file of requiredFiles) {
    if (!(await exists(path.join(directory, file)))) {
      fail(`the isolated copy is missing ${file}; the copy step did not pick up everything the package needs`);
    }
  }
  if (await exists(path.join(directory, "node_modules"))) {
    fail("the isolated copy carries node_modules; it must be installed from its own frozen lockfile instead");
  }
}

const contamination = await contaminationReasons();
if (contamination.length > 0) {
  console.error(
    [
      `[ui provider package] ${sourcePath}/node_modules has diverged from the root workspace:`,
      ...contamination.map((reason) => `  - ${reason}`),
      "",
      "Node then resolves two different Preact instances, and the root unit suite fails in ways that",
      "look unrelated. Recover from the repository root:",
      "",
      `  rm -rf ${sourcePath}/node_modules && pnpm install`,
      "",
      "The rm is the load-bearing half -- a plain root install reports `Already up to date` and repairs",
      "nothing. This check will not delete your tree for you.",
    ].join("\n"),
  );
  process.exit(1);
}

const workdir = await mkdtemp(path.join(os.tmpdir(), "zudo-sg-ui-package-"));

try {
  console.log(`Copying ${sourcePath} (without node_modules) to ${workdir}`);
  await cp(packageRoot, workdir, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(packageRoot, source);
      return relative === "" || !relative.split(path.sep).includes("node_modules");
    },
  });
  await assertCopyIsComplete(workdir);

  await run("corepack", ["pnpm", "install", "--frozen-lockfile"], workdir);
  await run("corepack", ["pnpm", "run", "check"], workdir);

  // The point of the copy is that the workspace tree is untouched, so prove it rather than assert
  // it in prose: anything found here means isolation has regressed.
  const leaked = await contaminationReasons();
  if (leaked.length > 0) {
    fail(`the gate contaminated ${sourcePath}/node_modules despite running on a copy:\n${leaked.map((reason) => `  - ${reason}`).join("\n")}`);
  }

  console.log(`Standalone package checks passed on the isolated copy; ${sourcePath}/node_modules left workspace-linked.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await rm(workdir, { recursive: true, force: true });
}
