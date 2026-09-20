#!/usr/bin/env node
// Foreign-install proof for `create-zudo-sg` (#737).
//
// This is deliberately an end-to-end check of the published package shapes:
// build and pack both packages, execute the packed initializer in a temporary
// directory outside this workspace, install the generated project, run the
// commands printed by the initializer, and prove that the generated host can
// build and boot zfb dev. The normal mode replaces the template's registry
// engine range with a locally packed engine tarball because npm may lag main;
// --published-engine leaves that dependency exactly as shipped for the release
// gate.

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageManager = ["corepack", "pnpm"];
const keep = process.argv.includes("--keep") || Boolean(process.env.ZUDO_SG_VERIFY_KEEP);
const publishedEngine = process.argv.includes("--published-engine");
const knownArgs = new Set(["--keep", "--published-engine"]);
const RELEASE_AGE_DEPENDENCY_NAMES = [
  "@takazudo/zfb",
  "@takazudo/zfb-runtime",
  "@takazudo/zfb-md-wasm",
  "@takazudo/zudo-doc",
  "@takazudo/zdtp",
];
const EXACT_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

for (const argument of process.argv.slice(2)) {
  if (!knownArgs.has(argument)) {
    throw new Error(`Unknown argument: ${argument}`);
  }
}

function fail(message) {
  throw new Error(`[verify create-zudo-sg] ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function compareStrings(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Run a command while streaming its output, preserving the useful failure log. */
function run(command, commandArgs, cwd, options = {}) {
  const env = options.env ?? { ...process.env, CI: process.env.CI ?? "true" };
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, commandArgs, {
      cwd,
      env,
      detached: options.detached ?? false,
      stdio: options.stdio ?? "inherit",
    });
    child.on("error", (error) => reject(new Error(`${command} could not start: ${error.message}`)));
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(
        new Error(
          `${command} ${commandArgs.join(" ")} failed (${signal ? `signal ${signal}` : `exit code ${code}`})`,
        ),
      );
    });
  });
}

/** Run a command while streaming and returning stdout/stderr for assertions. */
function runStreamed(command, commandArgs, cwd, options = {}) {
  const env = options.env ?? { ...process.env, CI: process.env.CI ?? "true" };
  return new Promise((resolvePromise, reject) => {
    let output = "";
    const child = spawn(command, commandArgs, {
      cwd,
      env,
      detached: options.detached ?? false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (chunk) => {
      output += String(chunk);
      process.stdout.write(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      output += String(chunk);
      process.stderr.write(chunk);
    });
    child.on("error", (error) => reject(new Error(`${command} could not start: ${error.message}`)));
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolvePromise(output);
        return;
      }
      reject(
        new Error(
          `${command} ${commandArgs.join(" ")} failed (${signal ? `signal ${signal}` : `exit code ${code}`}):\n${output}`,
        ),
      );
    });
  });
}

/** Capture command output for pack filenames without flooding the verifier log. */
function runCapture(command, commandArgs, cwd, options = {}) {
  const env = options.env ?? { ...process.env, CI: process.env.CI ?? "true" };
  return new Promise((resolvePromise, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, commandArgs, { cwd, env });
    child.stdout?.on("data", (chunk) => (stdout += String(chunk)));
    child.stderr?.on("data", (chunk) => (stderr += String(chunk)));
    child.on("error", (error) => reject(new Error(`${command} could not start: ${error.message}`)));
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolvePromise(`${stdout}\n${stderr}`);
        return;
      }
      reject(
        new Error(
          `${command} ${commandArgs.join(" ")} failed (${signal ? `signal ${signal}` : `exit code ${code}`}):\n${stdout}\n${stderr}`,
        ),
      );
    });
  });
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolvePort(typeof address === "object" && address ? address.port : 0));
    });
  });
}

async function waitForOk(url, timeoutMs, child, log) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.spawnError) fail(`zfb dev could not start: ${child.spawnError.message}`);
    if (child.exitCode !== null) fail(`zfb dev exited (${child.exitCode}) before answering ${url}:\n${log()}`);
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // zfb is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  fail(`zfb dev did not answer ${url} within ${timeoutMs}ms:\n${log()}`);
}

function stopDevServer(child) {
  if (!child || child.exitCode !== null || child.pid === undefined) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

async function listFiles(directory) {
  const result = [];
  async function visit(current, prefix) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath, relative);
      } else if (entry.isFile()) {
        result.push(relative);
      } else {
        fail(`unexpected non-file template entry: ${relative}`);
      }
    }
  }
  await visit(directory, "");
  return result.sort();
}

async function packWorkspacePackage(selector, destination) {
  await mkdir(destination, { recursive: true });
  const before = new Set((await readdir(destination)).filter((entry) => entry.endsWith(".tgz")));
  await runCapture(
    packageManager[0],
    [...packageManager.slice(1), "--filter", selector, "pack", "--pack-destination", destination],
    root,
  );
  const after = (await readdir(destination)).filter((entry) => entry.endsWith(".tgz"));
  const created = after.filter((entry) => !before.has(entry));
  assert(created.length === 1, `expected one ${selector} tarball in ${destination}, found ${created.length}`);
  return path.join(destination, created[0]);
}

async function assertInitializerTarball(tarballPath) {
  const listing = await runCapture("tar", ["-tzf", tarballPath], root);
  const files = listing
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^package\//u, ""));
  assert(files.includes("bin/create-zudo-sg.js"), "initializer tarball is missing bin/create-zudo-sg.js");
  assert(files.includes("dist/cli.js"), "initializer tarball is missing dist/cli.js");
  assert(files.includes("templates/default/package.json"), "initializer tarball is missing templates/default");
  return files;
}

async function extractInitializer(tarballPath, destination) {
  await mkdir(destination, { recursive: true });
  await run("tar", ["-xzf", tarballPath, "-C", destination], root);
  const packageRoot = path.join(destination, "package");
  assert(existsSync(path.join(packageRoot, "bin/create-zudo-sg.js")), "failed to extract the packed initializer bin");
  return packageRoot;
}

async function assertScaffoldShape(projectDir, packedTemplateDir) {
  const expected = (await listFiles(packedTemplateDir)).map((file) =>
    file === "_gitignore" ? ".gitignore" : file,
  );
  const actual = await listFiles(projectDir);
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `scaffold file set differs from the packed template:\nexpected: ${expected.join(", ")}\nactual: ${actual.join(", ")}`,
  );
  assert(existsSync(path.join(projectDir, ".gitignore")), "scaffold is missing .gitignore");
  assert(!existsSync(path.join(projectDir, "_gitignore")), "scaffold left the package-safe _gitignore name behind");

  for (const relative of actual) {
    const filePath = path.join(projectDir, relative);
    const content = await readFile(filePath);
    assert(!content.includes("__PROJECT_NAME__"), `scaffold left __PROJECT_NAME__ in ${relative}`);
  }

  const manifest = JSON.parse(await readFile(path.join(projectDir, "package.json"), "utf8"));
  assert(manifest.name === "create-zudo-sg-proof", `scaffold package name is ${manifest.name}, expected create-zudo-sg-proof`);
  assert(manifest.dependencies?.["@takazudo/zudo-sg"], "scaffold package is missing @takazudo/zudo-sg");
  console.log(`OK — packed initializer scaffolded ${actual.length} files with .gitignore and no unresolved token.`);
}

async function assertScaffoldReleaseAgeExcludes(projectDir) {
  const workspacePath = path.join(projectDir, "pnpm-workspace.yaml");
  const workspace = await readFile(workspacePath, "utf8");
  const lines = workspace.split(/\r?\n/u);
  const keyIndex = lines.findIndex((line) => /^minimumReleaseAgeExclude:\s*$/u.test(line));
  assert(keyIndex !== -1, "scaffold workspace is missing minimumReleaseAgeExclude");

  const actual = [];
  for (let index = keyIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "") continue;
    if (!/^[ \t]/u.test(line)) break;
    if (line.trimStart().startsWith("#")) continue;
    const match = line.match(/^\s*-\s*["']([^"']+)["']\s*$/u);
    assert(match, `scaffold release-age entry is malformed: ${line}`);
    actual.push(match[1]);
  }

  for (const entry of actual) {
    const match = entry.match(/^(@takazudo\/[a-z0-9][a-z0-9._-]*)@(.+)$/u);
    assert(
      match !== null && EXACT_SEMVER.test(match[2]),
      `scaffold release-age entry is not an exact @takazudo semver: ${entry}`,
    );
  }

  const fixturePackage = JSON.parse(
    await readFile(path.join(root, "fixtures", "engine-host", "package.json"), "utf8"),
  );
  const styleguidePackage = JSON.parse(
    await readFile(path.join(root, "packages", "styleguide", "package.json"), "utf8"),
  );
  const zfbPackage = JSON.parse(
    await readFile(path.join(root, "node_modules", "@takazudo", "zfb", "package.json"), "utf8"),
  );
  const expected = [
    ...RELEASE_AGE_DEPENDENCY_NAMES.map(
      (name) => `${name}@${fixturePackage.dependencies?.[name]}`,
    ),
    `@takazudo/zudo-sg@${styleguidePackage.version}`,
    ...Object.entries(zfbPackage.optionalDependencies ?? {}).map(
      ([name, version]) => `${name}@${version}`,
    ),
  ].sort(compareStrings);

  assert(new Set(actual).size === actual.length, "scaffold release-age entries contain duplicates");
  assert(
    actual.every((entry, index) => index === 0 || compareStrings(actual[index - 1], entry) <= 0),
    "scaffold release-age entries are not sorted",
  );
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `scaffold release-age entries differ from the shipped pins:\nexpected: ${expected.join(", ")}\nactual: ${actual.join(", ")}`,
  );
  console.log(`OK — scaffold release-age exemptions contain ${actual.length} exact shipped pins.`);
}

async function gitCheckIgnore(projectDir, relativePath) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      "git",
      ["check-ignore", "--no-index", "--quiet", "--", relativePath],
      { cwd: projectDir },
    );
    child.on("error", (error) => reject(new Error(`git check-ignore could not start: ${error.message}`)));
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolvePromise(true);
        return;
      }
      if (code === 1) {
        resolvePromise(false);
        return;
      }
      reject(new Error(`git check-ignore ${relativePath} failed (${signal ? `signal ${signal}` : `exit code ${code}`})`));
    });
  });
}

async function assertScaffoldGitignore(projectDir) {
  await run("git", ["init", "--quiet"], projectDir);
  const ignoredPaths = [
    ".zfb/graph.bin",
    ".zfb-esbuild-entry-x.tsx",
    ".zfb-islands-tsconfig-x.json",
    ".zfb-virtual-x.mjs",
  ];
  await mkdir(path.join(projectDir, ".zfb"), { recursive: true });
  await writeFile(path.join(projectDir, ".zfb/graph.bin"), "artifact\n");
  for (const relativePath of ignoredPaths.slice(1)) {
    await writeFile(path.join(projectDir, relativePath), "artifact\n");
  }

  assert(
    !(await gitCheckIgnore(projectDir, "pnpm-lock.yaml")),
    "scaffold .gitignore unexpectedly ignores pnpm-lock.yaml",
  );
  for (const relativePath of ignoredPaths) {
    assert(
      await gitCheckIgnore(projectDir, relativePath),
      `scaffold .gitignore does not ignore ${relativePath}`,
    );
  }
  console.log("OK — scaffold .gitignore tracks pnpm-lock.yaml and ignores zfb artifacts.");
}

async function assertForeignPackage(hostDir) {
  const installed = await realpath(path.join(hostDir, "node_modules/@takazudo/zudo-sg"));
  const modules = `${await realpath(path.join(hostDir, "node_modules"))}${path.sep}`;
  assert(installed.startsWith(modules), `installed engine resolves outside the scratch node_modules: ${installed}`);
}

async function installLocalEngine(hostDir, engineTarball) {
  const tarballDir = path.join(hostDir, ".tarball");
  await mkdir(tarballDir, { recursive: true });
  const tarballName = path.basename(engineTarball);
  await cp(engineTarball, path.join(tarballDir, tarballName));

  const manifestPath = path.join(hostDir, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const original = manifest.dependencies?.["@takazudo/zudo-sg"];
  assert(typeof original === "string" && !original.startsWith("file:"), `template engine dependency is not a published range: ${original}`);
  manifest.dependencies["@takazudo/zudo-sg"] = `file:.tarball/${tarballName}`;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  assert(manifest.dependencies["@takazudo/zudo-sg"] === `file:.tarball/${tarballName}`, "failed to override the template engine dependency with the packed tarball");
  console.log(`Using locally packed @takazudo/zudo-sg instead of ${original}.`);
}

async function assertGeneratedRegistry(hostDir) {
  const registryPath = path.join(hostDir, "src/styleguide/sg-registry.ts");
  const registry = await readFile(registryPath, "utf8");
  const keys = [...registry.matchAll(/^\s*["'](\.\/[^"'\n]+\.stories\.tsx)["']\s*:/gmu)].map((match) => match[1]);
  const uniqueKeys = new Set(keys);
  assert(uniqueKeys.size === 3, `generated registry contains ${uniqueKeys.size} stories, expected 3 (${[...uniqueKeys].join(", ")})`);
  assert(!registry.includes("storyModules: Record<string, StoryModule> = {};"), "generated registry still contains the empty seed");
  console.log(`OK — generated registry contains 3 stories (${[...uniqueKeys].join(", ")}).`);
}

async function assertGeneratedTokenManifest(hostDir) {
  const manifestPath = path.join(hostDir, "src/styleguide/token-manifest.ts");
  assert(existsSync(manifestPath), "gen-token-manifest did not create src/styleguide/token-manifest.ts");
  const manifest = await readFile(manifestPath, "utf8");
  assert(manifest.length > 0, "generated token manifest is empty");
  assert(manifest.includes("--spacing-hsp-md"), "generated token manifest lacks --spacing-hsp-md");
  assert(manifest.includes('name: "neutral-0"'), "generated token manifest lacks palette tokens");
  console.log("OK — generated token manifest is populated with spacing and palette tokens.");
}

async function assertBuildRoutes(hostDir) {
  const distDir = path.join(hostDir, "dist");
  const routeFiles = [
    "components/index.html",
    "components/preview/index.html",
    "tokens/index.html",
    "_zudo-sg/preview.css",
  ];
  for (const relative of routeFiles) {
    assert(existsSync(path.join(distDir, relative)), `missing built route or asset under base "/": dist/${relative}`);
  }

  const componentEntries = await readdir(path.join(distDir, "components"), { withFileTypes: true });
  const slugs = componentEntries
    .filter((entry) => entry.isDirectory() && entry.name !== "preview")
    .map((entry) => entry.name)
    .sort();
  assert(slugs.length === 3, `expected 3 component detail routes, found ${slugs.length} (${slugs.join(", ")})`);
  for (const slug of slugs) {
    assert(existsSync(path.join(distDir, "components", slug, "index.html")), `missing /components/${slug}`);
  }

  const preview = await readFile(path.join(distDir, "components/preview/index.html"), "utf8");
  assert(
    /href=(?:"|')?\/_zudo-sg\/preview\.css(?:"|')?/u.test(preview),
    "preview route does not link the base-/ standalone /_zudo-sg/preview.css",
  );
  assert(!preview.includes("/styleguide/"), 'preview route contains a stale /styleguide/ link under base "/"');
  console.log(`OK — built /components, 3 component details, /components/preview, /tokens, and /_zudo-sg/preview.css.`);
}

async function assertInternalLinks(hostDir) {
  // Reuse the repository checker with an absolute temp dist path. Its path
  // resolver treats /components/foo as dist/components/foo and therefore
  // catches stale /styleguide/... links that route-existence checks miss.
  await run(
    process.execPath,
    [path.join(root, "scripts/check-links.mjs"), `--dist=${path.join(hostDir, "dist")}`],
    hostDir,
  );
  console.log("OK — built dist has no broken internal links.");
}

async function bootDev(hostDir) {
  const port = await freePort();
  let log = "";
  let spawnError;
  const devServer = spawn(
    packageManager[0],
    [...packageManager.slice(1), "exec", "zfb", "dev", "--port", String(port)],
    {
      cwd: hostDir,
      env: { ...process.env, CI: process.env.CI ?? "true", NO_COLOR: "1" },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  devServer.once("error", (error) => {
    spawnError = error;
    devServer.spawnError = error;
    log += `\n${error.message}`;
  });
  devServer.stdout?.on("data", (chunk) => {
    log += String(chunk);
  });
  devServer.stderr?.on("data", (chunk) => {
    log += String(chunk);
  });

  try {
    const origin = `http://127.0.0.1:${port}`;
    if (spawnError) fail(`zfb dev could not start: ${spawnError.message}`);
    await waitForOk(`${origin}/components`, 300_000, devServer, () => log);
    await waitForOk(`${origin}/components/preview`, 300_000, devServer, () => log);
    assert(devServer.exitCode === null, `zfb dev exited unexpectedly after serving routes (${devServer.exitCode}):\n${log}`);
    console.log("OK — zfb dev booted once and served the injected routes under base \"/\".");
  } finally {
    stopDevServer(devServer);
  }
}

async function main() {
  const artifacts = await mkdtemp(path.join(os.tmpdir(), "create-zudo-sg-pack-"));
  const extraction = await mkdtemp(path.join(os.tmpdir(), "create-zudo-sg-extract-"));
  const scratch = await mkdtemp(path.join(os.tmpdir(), "create-zudo-sg-host-"));
  let hostDir;

  try {
    console.log("Building create-zudo-sg and @takazudo/zudo-sg.");
    await run(packageManager[0], [...packageManager.slice(1), "--filter", "create-zudo-sg", "build"], root);
    await run(packageManager[0], [...packageManager.slice(1), "--filter", "@takazudo/zudo-sg", "build"], root);

    console.log(`Packing create-zudo-sg and @takazudo/zudo-sg -> ${artifacts}`);
    const initializerTarball = await packWorkspacePackage("create-zudo-sg", artifacts);
    const engineTarball = await packWorkspacePackage("@takazudo/zudo-sg", artifacts);
    await assertInitializerTarball(initializerTarball);
    const packedInitializer = await extractInitializer(initializerTarball, extraction);

    hostDir = path.join(scratch, "create-zudo-sg-proof");
    console.log(`Running packed initializer in ${scratch}: ${path.relative(scratch, hostDir)}`);
    await run(
      process.execPath,
      [path.join(packedInitializer, "bin/create-zudo-sg.js"), hostDir, "--yes", "--no-install"],
      scratch,
    );
    await assertScaffoldShape(hostDir, path.join(packedInitializer, "templates/default"));
    await assertScaffoldReleaseAgeExcludes(hostDir);
    await assertScaffoldGitignore(hostDir);

    if (publishedEngine) {
      console.log("--published-engine: installing the template's shipped @takazudo/zudo-sg range.");
    } else {
      await installLocalEngine(hostDir, engineTarball);
    }

    console.log("pnpm install (the initializer's printed next step)");
    await run(packageManager[0], [...packageManager.slice(1), "install"], hostDir);
    await assertForeignPackage(hostDir);

    console.log("pnpm gen-registry (the initializer's printed next step)");
    await run(packageManager[0], [...packageManager.slice(1), "gen-registry"], hostDir);
    await assertGeneratedRegistry(hostDir);

    console.log("pnpm gen-token-manifest (the initializer's printed next step)");
    await run(packageManager[0], [...packageManager.slice(1), "gen-token-manifest"], hostDir);
    await assertGeneratedTokenManifest(hostDir);

    console.log("tsc --noEmit -p tsconfig.json");
    await run(packageManager[0], [...packageManager.slice(1), "exec", "tsc", "--noEmit", "-p", "tsconfig.json"], hostDir);

    console.log("zfb build");
    const buildLog = await runStreamed(
      packageManager[0],
      [...packageManager.slice(1), "exec", "zfb", "build"],
      hostDir,
    );
    assert(!/has no matching registry entry/u.test(buildLog), "zfb build logged an unregistered island marker");

    await assertBuildRoutes(hostDir);
    await assertInternalLinks(hostDir);
    await bootDev(hostDir);

    console.log(`OK — packed create-zudo-sg generated and booted a foreign host${publishedEngine ? " with the published engine range" : " with the local engine tarball"}.`);
  } finally {
    if (keep) {
      console.log(`--keep: left artifacts at ${artifacts}, extraction at ${extraction}, and host at ${hostDir ?? scratch}.`);
    } else {
      await rm(artifacts, { recursive: true, force: true });
      await rm(extraction, { recursive: true, force: true });
      await rm(scratch, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
