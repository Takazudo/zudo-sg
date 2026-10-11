// Foreign-install proof for `@takazudo/zudo-sg` (#665, docs/adr/styleguide-engine.md).
//
// Packs the engine with `pnpm pack`, installs the tarball plus exact
// `@takazudo/zfb`/`@takazudo/zudo-doc` pins into a copy of
// `fixtures/engine-host/` OUTSIDE this workspace (realpath under
// `node_modules`, no workspace link, no `packages: []` escape hatch shared
// with this repo). First proves the README's own `pnpm add` command in a
// separate empty project with strict peers and no peer auto-install. Then
// generates the fixture's registry/token manifest, type-checks the consumer,
// builds both the empty and configured /tokens modes, and asserts the
// four injected routes + the standalone preview stylesheet exist under the
// fixture's non-root `base` ("/styleguide/") and the production host CSS
// contains wind-emitted catalog and responsive sidebar selectors. It also
// proves an engine manifest candidate is present without host source or
// safelist coverage. It strips the islands seed
// (`pages/lib/_zudo-sg-islands.ts` + its import) from the temp copy and boots
// `zfb dev` once, asserting
// `ConfiguredPreviewApp` (reached through the
// injected route entrypoint) AND the fixture's `Counter` island (reached only
// through `virtual:zudo-sg-registry`) both register in
// `/styleguide/assets/islands.js`. The dev proof checks a host-source wind
// candidate and confirms the standalone preview CSS refreshes after an
// imported CSS edit and a component source edit. The build phases above run
// on the as-shipped fixture (seed present), so they still prove the seed is
// a harmless no-op.
// Before that dev-only mutation, the browser verifier serves the configured
// packed output and checks the post-swap early-click gap, panel toggles,
// return/direct navigation, and actual rendered story identities in preview
// iframes. It then rebuilds with the bootstrap mounted on host routes too and
// proves a ready persisted-header click across SPA remounts. It repeats clean
// builds for a custom in-namespace collision and an outside-namespace preview
// route.
//
// Model: scripts/__tests__/zudo-sg-no-stub-build.slow.test.ts (build +
// dev boot, free-port + process-group kill).

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PACKED_HOST_SCENARIOS } from "./verify-styleguide-install-browser.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixtureRoot = path.join(root, "fixtures/engine-host");
const fixtureBase = "/styleguide/";
const packageDirRelative = "packages/styleguide";
const tarballName = "zudo-sg-engine.tgz";
const faviconAssetNames = ["/favicon.ico", "/favicon.svg", "/favicon-32x32.png", "/favicon-16x16.png"];
const assetLinkRels = new Set([
  "icon",
  "stylesheet",
  "preload",
  "modulepreload",
  "manifest",
  "apple-touch-icon",
]);
const skippedFixtureEntries = new Set([
  "node_modules",
  "dist",
  ".zfb-build",
  ".zfb",
  ".tarball",
  "pnpm-lock.yaml",
]);
const skippedFixtureFilePatterns = [
  /^\.zfb-esbuild-entry-.*\.tsx$/u,
  /^\.zfb-islands-tsconfig-.*\.json$/u,
  /^\.zfb-virtual-.*\.mjs$/u,
];
const keep = process.argv.includes("--keep") || Boolean(process.env.ZUDO_SG_VERIFY_KEEP);
const readmeInstallOnly = process.argv.includes("--readme-install-only");

export function fail(message) {
  throw new Error(`[verify styleguide install] ${message}`);
}

export function assert(condition, message) {
  if (!condition) fail(message);
}

/** stdio inherited: build/dev output is the point of a failure, and should stream while running. */
export function run(command, commandArgs, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, commandArgs, { cwd, env: process.env, stdio: "inherit" });
    child.on("error", (error) => reject(new Error(`${command} could not start: ${error.message}`)));
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${command} ${commandArgs.join(" ")} failed (${signal ? `signal ${signal}` : `exit code ${code}`})`));
    });
  });
}

/** Like `run`, but also accumulates the streamed output for post-hoc log assertions. */
export function runStreamed(command, commandArgs, cwd) {
  return new Promise((resolvePromise, reject) => {
    let output = "";
    const child = spawn(command, commandArgs, { cwd, env: process.env });
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
      reject(new Error(`${command} ${commandArgs.join(" ")} failed (${signal ? `signal ${signal}` : `exit code ${code}`}):\n${output}`));
    });
  });
}

/** Captures command output for pack filenames and tarball inspection. */
export function runCapture(command, commandArgs, cwd, includeStderr = false) {
  return new Promise((resolvePromise, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, commandArgs, { cwd, env: process.env });
    child.stdout?.on("data", (chunk) => (stdout += String(chunk)));
    child.stderr?.on("data", (chunk) => (stderr += String(chunk)));
    child.on("error", (error) => reject(new Error(`${command} could not start: ${error.message}`)));
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise(includeStderr ? `${stdout}\n${stderr}` : stdout);
        return;
      }
      reject(new Error(`${command} ${commandArgs.join(" ")} failed (exit code ${code}):\n${stdout}\n${stderr}`));
    });
  });
}

export function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolvePort(typeof address === "object" && address ? address.port : 0));
    });
  });
}

export async function waitForOk(url, timeoutMs, child, log) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) fail(`zfb dev exited (${child.exitCode}) before answering ${url}:\n${log()}`);
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  fail(`zfb dev did not answer ${url} within ${timeoutMs}ms:\n${log()}`);
}

async function waitForBody(url, timeoutMs, child, log, predicate) {
  const deadline = Date.now() + timeoutMs;
  let latest = "";
  while (Date.now() < deadline) {
    if (child.exitCode !== null) fail(`zfb dev exited (${child.exitCode}) before ${url} emitted the expected CSS:\n${log()}`);
    try {
      const res = await fetch(url);
      if (res.ok) {
        latest = await res.text();
        if (predicate(latest)) return latest;
      }
    } catch {
      // A dev rebuild may briefly replace its CSS middleware response.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  fail(`zfb dev did not emit the expected CSS from ${url} within ${timeoutMs}ms. Last body:\n${latest}\n${log()}`);
}

export function stopDevServer(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null || child.pid === undefined) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

export async function stopDevServerAndWait(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const closed = new Promise((resolve) => child.once("close", resolve));
  stopDevServer(child);
  const timeout = Symbol("timeout");
  let timer;
  const outcome = await Promise.race([closed, new Promise((resolve) => { timer = setTimeout(() => resolve(timeout), 10_000); })]);
  clearTimeout(timer);
  if (outcome !== timeout) return;
  if (child.pid !== undefined) {
    try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
  }
  let killTimer;
  const killed = await Promise.race([closed.then(() => true), new Promise((resolve) => { killTimer = setTimeout(() => resolve(false), 10_000); })]);
  clearTimeout(killTimer);
  assert(killed, "zfb dev did not exit after SIGKILL before the foreign fixture build");
}

export async function packEngine(destination) {
  await mkdir(destination, { recursive: true });
  // `pnpm --filter @takazudo/zudo-sg pack`: the package has no lockfile of its
  // own (unlike packages/demo-ui), so this runs safely from the repo root — no
  // standalone-tree contamination risk (see CLAUDE.md's packages/demo-ui warning).
  const stdout = await runCapture(
    "corepack",
    ["pnpm", "--filter", "@takazudo/zudo-sg", "pack", "--pack-destination", destination],
    root,
  );
  const printed = stdout.trim().split(/\r?\n/u).pop() ?? "";
  const candidate = printed.endsWith(".tgz") ? printed : path.join(destination, printed);
  if (existsSync(candidate)) return candidate;
  const files = (await readdir(destination)).filter((f) => f.endsWith(".tgz"));
  assert(files.length === 1, `expected one packed tarball in ${destination}, found ${files.length}`);
  return path.join(destination, files[0]);
}

function assertNoWhitelistEscape(files) {
  // ADR decision 11's whitelist: dist, bin, routes-src, virtual-modules.d.ts,
  // styles.css (+ package.json, always included by npm/pnpm), plus
  // CHANGELOG.md / README.md added to `files` by #668 when the package went
  // public.
  const allowedTopLevel = new Set([
    "dist",
    "bin",
    "routes-src",
    "virtual-modules.d.ts",
    "styles.css",
    "package.json",
    "CHANGELOG.md",
    "README.md",
    "LICENSE",
  ]);
  const forbiddenSubstrings = ["doc/", "src/", "apps/", "packages/demo-ui", "fixtures/"];
  for (const file of files) {
    // npm tarball entries are prefixed "package/".
    const relative = file.replace(/^package\//u, "");
    const top = relative.split("/")[0];
    assert(allowedTopLevel.has(top), `packed tarball contains an entry outside the ADR files whitelist: ${file}`);
    for (const forbidden of forbiddenSubstrings) {
      assert(!relative.startsWith(forbidden), `packed tarball leaks a non-package path: ${file}`);
    }
  }
}

export async function assertTarballShape(tarballPath) {
  const listing = await runCapture("tar", ["-tzf", tarballPath], root);
  const files = listing.trim().split(/\r?\n/u).filter(Boolean);
  assert(files.length > 0, `packed tarball ${tarballPath} is empty`);
  assertNoWhitelistEscape(files);
  assert(files.includes("package/LICENSE"), "packed tarball is missing the package-root LICENSE");
  return JSON.parse(await runCapture("tar", ["-xOf", tarballPath, "package/package.json"], root));
}

/** Deliberately fail closed when the documented single-line command/list changes shape. */
export function parseDocumentedInstall(readme, fixtureManifest, packageManifest) {
  const installation = readme.match(/^## Installation\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/mu)?.[1];
  assert(installation, "README is missing its Installation section");
  const commands = [...installation.matchAll(/^pnpm add ([^\r\n]+)$/gmu)];
  assert(commands.length === 1, "README Installation must contain exactly one single-line pnpm add command");
  const specs = commands[0][1].trim().split(/\s+/u);
  const names = specs.map((spec) => {
    const match = spec.match(/^((?:@[a-z0-9._-]+\/)?[a-z0-9._-]+)@([^\s]+)$/u);
    assert(match, `README pnpm add contains an unsupported package specifier: ${spec}`);
    return match[1];
  });
  assert(new Set(names).size === names.length, "README pnpm add contains duplicate packages");
  assert(names.includes(packageManifest.name), `README pnpm add is missing ${packageManifest.name}`);

  const lists = [...installation.matchAll(/The\s+((?:`[^`]+`(?:\s*,\s*|\s*,?\s+and\s+)?)+)\s+entries are prerequisites inherited from zfb\/zudo-doc/gu)];
  assert(lists.length === 1, "README Installation must name one inherited-prerequisite list");
  const prerequisites = [...lists[0][1].matchAll(/`([^`]+)`/gu)].map((match) => match[1]);
  assert(prerequisites.length > 0, "README inherited-prerequisite list is empty");
  for (const name of prerequisites) {
    assert(names.includes(name), `README pnpm add is missing inherited prerequisite ${name}`);
  }
  for (const name of Object.keys(packageManifest.peerDependencies ?? {})) {
    if (packageManifest.peerDependenciesMeta?.[name]?.optional) continue;
    assert(names.includes(name), `README pnpm add is missing packed-package peer ${name}`);
  }
  // The README promises the full fixture dependency set. Compare names only:
  // the fixture pins framework versions, while the README documents ranges.
  for (const name of Object.keys(fixtureManifest.dependencies ?? {})) {
    assert(names.includes(name), `README pnpm add is missing fixture dependency ${name}`);
  }
  return { command: commands[0][0], specs, names, prerequisites };
}

export async function assertForeignPackage(hostDir) {
  const installed = await realpath(path.join(hostDir, "node_modules/@takazudo/zudo-sg"));
  const modules = path.join(await realpath(hostDir), "node_modules") + path.sep;
  assert(installed.startsWith(modules), `installed engine resolves outside the scratch node_modules: ${installed}`);
}

export async function assertSharedPreact(hostDir) {
  const manifest = JSON.parse(await read(hostDir, "package.json"));
  const directDependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.peerDependencies,
  };
  assert(!Object.hasOwn(directDependencies, "preact"), "fixture host declares a direct preact dependency");

  const engineDir = await realpath(path.join(hostDir, "node_modules/@takazudo/zudo-sg"));
  const adapterPath = path.join(engineDir, "dist/token-dashboard/token-dashboard-adapter.js");
  assert(existsSync(adapterPath), "packed engine is missing its Preact dashboard adapter");
  const adapterPreact = await realpath(createRequire(adapterPath).resolve("preact"));
  const hostRequire = createRequire(path.join(hostDir, "package.json"));
  const dashboardEntry = hostRequire.resolve("@takazudo/zdtp/dashboard");
  const dashboardPreact = await realpath(createRequire(dashboardEntry).resolve("preact"));
  assert(
    adapterPreact === dashboardPreact,
    `engine adapter and zdtp resolve different Preact copies: ${adapterPreact} vs ${dashboardPreact}`,
  );

  const lockfile = await read(hostDir, "pnpm-lock.yaml");
  const lockVersions = new Set(
    [...lockfile.matchAll(/^\s{2}preact@([^:\r\n]+):/gmu)].map((match) => match[1]),
  );
  assert(
    lockVersions.size === 1,
    `packed fixture lockfile has ${lockVersions.size} Preact resolutions: ${[...lockVersions].join(", ")}`,
  );
  console.log(`OK — engine adapter and zdtp resolve one Preact package (${adapterPreact}) and the lockfile has one resolution.`);
  return { adapterPath };
}

export async function assertSingleBundledRenderer(hostDir, adapterPath) {
  const probePath = path.join(hostDir, ".f1-preact-renderer-graph.mjs");
  const probeSource = [
    'import { mountDashboard } from "./node_modules/@takazudo/zudo-sg/dist/token-dashboard/token-dashboard-adapter.js";',
    'import { TokenDashboard } from "@takazudo/zdtp/dashboard";',
    "export { mountDashboard, TokenDashboard };",
    "",
  ].join("\n");
  await writeFile(probePath, probeSource);
  try {
    const hostRequire = createRequire(path.join(hostDir, "package.json"));
    const zfbEntry = hostRequire.resolve("@takazudo/zfb");
    const esbuildPath = createRequire(zfbEntry).resolve("esbuild");
    const { build } = await import(pathToFileURL(esbuildPath).href);
    const result = await build({
      absWorkingDir: hostDir,
      entryPoints: [probePath],
      bundle: true,
      write: false,
      metafile: true,
      platform: "browser",
      format: "esm",
      target: "es2022",
    });
    const rendererInputs = Object.keys(result.metafile.inputs).filter((input) => {
      const parts = input.replaceAll("\\", "/").split("/");
      return (
        parts.includes("preact") &&
        parts.at(-2) === "dist" &&
        ["preact.js", "preact.module.js", "preact.mjs"].includes(parts.at(-1))
      );
    });
    assert(
      rendererInputs.length === 1,
      `packed adapter/zdtp bundle contains ${rendererInputs.length} Preact renderer inputs: ${rendererInputs.join(", ")}`,
    );
    const emittedRenderer = await realpath(path.resolve(hostDir, rendererInputs[0]));
    const packageRenderer = await realpath(createRequire(adapterPath).resolve("preact"));
    assert(
      emittedRenderer.startsWith(path.dirname(packageRenderer)),
      `bundled renderer input ${emittedRenderer} is outside the adapter's installed Preact package ${packageRenderer}`,
    );
    console.log(`OK — packed adapter/zdtp bundle emits one Preact renderer input (${rendererInputs[0]}).`);
  } finally {
    await rm(probePath, { force: true });
  }
}

async function verifyDocumentedInstall(tarballPath, packageManifest) {
  const fixtureManifest = JSON.parse(await readFile(path.join(fixtureRoot, "package.json"), "utf8"));
  const documented = parseDocumentedInstall(
    await readFile(path.join(root, packageDirRelative, "README.md"), "utf8"),
    fixtureManifest,
    packageManifest,
  );
  const scratch = await mkdtemp(path.join(os.tmpdir(), "zudo-sg-readme-install-"));
  try {
    // No dependency fields, lockfile, or workspace links can seed this install.
    await writeFile(path.join(scratch, "package.json"), JSON.stringify({
      name: "zudo-sg-readme-install-proof",
      private: true,
      type: "module",
      packageManager: fixtureManifest.packageManager,
    }, null, 2) + "\n");
    await cp(path.join(fixtureRoot, "pnpm-workspace.yaml"), path.join(scratch, "pnpm-workspace.yaml"));
    console.log(`README install command: ${documented.command}`);
    console.log(`README inherited prerequisites: ${documented.prerequisites.join(", ")}`);
    console.log(`Installing in ${scratch} (replace only ${packageManifest.name} with the packed tarball; strict peers, no auto-install)`);
    const specs = documented.specs.map((spec, index) => documented.names[index] === packageManifest.name ? tarballPath : spec);
    const output = await runCapture("corepack", ["pnpm", "add", ...specs, "--strict-peer-dependencies", "--config.auto-install-peers=false"], scratch, true);
    console.log(output.trim());
    // `pnpm add` can downgrade peer issues to warnings despite the strict flag.
    // Check both streams as well as its exit code before calling this clean.
    assert(!/issues with peer dependencies|unmet peer|missing peer|ERR_PNPM_PEER_DEP_ISSUES/iu.test(output),
      "README pnpm add reported unmet peer dependencies");
    await assertForeignPackage(scratch);
    console.log("OK — README pnpm add and inherited prerequisites install without unmet peers.");
  } finally {
    if (keep) console.log(`--keep: left ${scratch} on disk.`);
    else await rm(scratch, { recursive: true, force: true });
  }
}

/**
 * Copies a fixture directory (`fixtures/engine-host`, or a sibling like
 * `fixtures/descriptor-host`) to a scratch destination, skipping build
 * output and zfb's transient dotfiles. Exported so a sibling verify script
 * (e.g. verify-descriptor-host-install.mjs) reuses the same copy contract
 * instead of re-implementing it.
 */
export async function copyFixtureDir(sourceRoot, destination) {
  await cp(sourceRoot, destination, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(sourceRoot, source);
      if (relative === "") return true;
      const segments = relative.split(path.sep);
      return (
        !segments.some((segment) => skippedFixtureEntries.has(segment)) &&
        !skippedFixtureFilePatterns.some((pattern) => pattern.test(segments.at(-1)))
      );
    },
  });
}

async function copyFixture(destination) {
  await copyFixtureDir(fixtureRoot, destination);
}

export function read(hostDir, rel) {
  return readFile(path.join(hostDir, rel), "utf8");
}

export async function collectHtmlFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectHtmlFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(entryPath);
    }
  }
  return files.sort();
}

function relTokens(element) {
  return new Set((element.getAttribute("rel") ?? "").split(/\s+/u).filter(Boolean).map((token) => token.toLowerCase()));
}

function pageUrlPath(distDir, htmlPath, base) {
  const relative = path.relative(distDir, htmlPath).split(path.sep).join("/");
  return `${base}${relative}`;
}

function resolveLocalAsset(rawUrl, pagePath, distDir, base) {
  const trimmed = rawUrl.trim();
  if (
    trimmed === "" ||
    trimmed.startsWith("//") ||
    /^(?:data:|https?:|[a-z][a-z\d+.-]*:)/iu.test(trimmed)
  ) {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(trimmed, `https://fixture.invalid${pagePath}`);
  } catch {
    return null;
  }
  const pathname = decodeURIComponent(parsed.pathname);
  const relative = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\/+/u, "");
  const distRoot = path.resolve(distDir);
  const target = path.resolve(distRoot, relative);
  assert(
    target === distRoot || target.startsWith(`${distRoot}${path.sep}`),
    `head asset URL escapes the build output: ${rawUrl}`,
  );
  return target;
}

function usesZudoDocHead(document) {
  if (document.documentElement.hasAttribute("data-sg-preview-doc")) return false;
  return [...document.head.querySelectorAll("style")].some((style) => style.textContent?.includes("--zd-") ?? false);
}

/** Check every built page's local head assets and zudo-doc favicon contract. */
export async function assertHeadAssets(hostDir) {
  const distDir = path.join(hostDir, "dist");
  const htmlFiles = await collectHtmlFiles(distDir);
  assert(htmlFiles.length > 0, "fixture build emitted no HTML pages");
  const { JSDOM } = await import("jsdom");
  let zudoDocHeadPages = 0;

  for (const htmlPath of htmlFiles) {
    const relativePage = path.relative(distDir, htmlPath).split(path.sep).join("/");
    const html = await readFile(htmlPath, "utf8");
    for (const forbidden of faviconAssetNames) {
      assert(!html.includes(forbidden), `${relativePage} still references the default favicon asset ${forbidden}`);
    }

    const dom = new JSDOM(html);
    const document = dom.window.document;
    const pagePath = pageUrlPath(distDir, htmlPath, fixtureBase);
    const references = [];
    for (const link of document.head.querySelectorAll("link")) {
      if ([...relTokens(link)].some((token) => assetLinkRels.has(token))) {
        const href = link.getAttribute("href");
        if (href !== null) references.push(href);
      }
    }
    for (const script of document.head.querySelectorAll("script[src]")) {
      const src = script.getAttribute("src");
      if (src !== null) references.push(src);
    }
    for (const rawUrl of references) {
      const target = resolveLocalAsset(rawUrl, pagePath, distDir, fixtureBase);
      if (target === null) continue;
      assert(existsSync(target) && statSync(target).isFile(), `${relativePage} references missing head asset ${rawUrl}`);
    }

    if (usesZudoDocHead(document)) {
      zudoDocHeadPages += 1;
      const icons = [...document.head.querySelectorAll("link")].filter((link) => relTokens(link).has("icon"));
      assert(icons.length === 1, `${relativePage} has ${icons.length} zudo-doc favicon links; expected exactly one`);
      const href = icons[0].getAttribute("href") ?? "";
      assert(href.startsWith("data:image/svg+xml"), `${relativePage} zudo-doc favicon is not an inline data:image/svg+xml URL`);
    }
    dom.window.close();
  }
  assert(zudoDocHeadPages > 0, "fixture build has no pages recognized as using the zudo-doc head");
  console.log(
    `OK — every fixture HTML page has existing local head assets (${htmlFiles.length} pages checked; ${zudoDocHeadPages} zudo-doc heads).`,
  );
}

// D1: packed HTML proves the server boundary and serialized declared data;
// the opaque Preact widget is mounted only after client activation.
export function assertDashboardFallbacks(document) {
  const shells = [...document.querySelectorAll('[data-zfb-island-skip-ssr="TokenDashboardMount"]')];
  assert(shells.length === 3, "configured /tokens must render three TokenDashboardMount loading shells");
  assert(!document.querySelector(".zdtp-dashboard, [data-css-var], [data-sg-token-dashboard]"), "server /tokens fabricated client dashboard markup");
  const definitions = [
    { id: "ui-defaults-light", mode: "light", chrome: "light", include: "mode-dependent", title: "UI tokens — mode-dependent defaults (light)" },
    { id: "ui-defaults-dark", mode: "dark", chrome: "dark", include: "mode-dependent", title: "UI tokens — mode-dependent defaults (dark)" },
    { id: "ui-defaults-shared", chrome: "host", include: "mode-independent", title: "UI tokens — shared defaults (mode-independent)" },
  ];
  return shells.map((shell, index) => {
    const expected = definitions[index];
    assert(shell.getAttribute("data-when") === "load", `${expected.id} does not activate on load`);
    assert(shell.querySelector("h2")?.textContent === expected.title, `${expected.id} lacks its truthful fallback heading`);
    assert(shell.querySelector("p")?.textContent === "Loading declared defaults…", `${expected.id} lacks loading text`);
    const props = JSON.parse(shell.getAttribute("data-props") ?? "null");
    assert(props && Array.isArray(props.tabs) && props.manifest, `${expected.id} lacks serialized token data`);
    for (const key of ["id", "mode", "chrome", "include", "title"]) {
      assert(props[key] === expected[key], `${expected.id} changed its serialized ${key}`);
    }
    return props;
  });
}

async function assertTokensRoute(hostDir, empty) {
  // Parse rendered elements, not CSS/JS strings; zfb may minify attribute quotes.
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("");
  // An inert template parses the HTML without evaluating its large stylesheets.
  const template = dom.window.document.createElement("template");
  template.innerHTML = await read(hostDir, "dist/tokens/index.html");
  const document = template.content;
  dom.window.close();
  const emptyState = document.querySelector("[data-zudo-sg-tokens-empty]");
  if (empty) {
    assert(emptyState, "dist/tokens/index.html lacks the no-manifest empty state");
    assert(!document.querySelector('.zdtp-dashboard, [data-zfb-island-skip-ssr="TokenDashboardMount"]'), "empty /tokens mode unexpectedly rendered a dashboard boundary");
    console.log("OK — /tokens empty state: [data-zudo-sg-tokens-empty].");
    return;
  }
  assert(!emptyState, "configured /tokens unexpectedly rendered the empty state");
  const dashboards = assertDashboardFallbacks(document);
  const shared = dashboards[2];
  const token = shared.tabs.flatMap((tab) => tab.tiers.flatMap((tier) => tier.items))
    .find((item) => item.cssVar === "--spacing-hsp-md");
  assert(token?.default === "1rem", "shared dashboard payload lacks the fixture's declared spacing value");
  console.log("OK — /tokens renders three truthful dashboard loading shells and serializes the declared spacing value 1rem.");
}

export async function assertProductionCss(hostDir) {
  // Inspect the host bundle, not the standalone iframe preview stylesheet:
  // the catalog grid and responsive sidebar must be styled on host routes.
  const buildCssFiles = (await readdir(path.join(hostDir, "dist/assets"))).filter((f) => /^styles-.*\.css$/.test(f));
  assert(buildCssFiles.length > 0, "no dist/assets/styles-*.css host stylesheet found");
  const buildCss = (
    await Promise.all(buildCssFiles.map((f) => read(hostDir, `dist/assets/${f}`)))
  ).join("\n");
  const { default: postcss } = await import("postcss");
  const selectors = new Set();
  postcss.parse(buildCss).walkRules((rule) => {
    for (const selector of rule.selectors) selectors.add(selector);
  });
  // Match whole wind selectors: responsive candidates must not be inferred
  // from a similarly named selector or a generated safelist.
  for (const selector of [".grid", ".sticky", ".lg\\:hidden", ".lg\\:flex"]) {
    assert(selectors.has(selector), `dist/assets/styles-*.css is missing ${selector}`);
  }
  const engineManifest = JSON.parse(await read(hostDir, "node_modules/@takazudo/zudo-sg/dist/wind.json"));
  const engineCandidate = "text-sg-muted";
  assert(
    engineManifest.schemaVersion === 1 &&
      engineManifest.producer === "zudo-sg" &&
      engineManifest.candidates.includes(engineCandidate),
    `packed wind.json does not provide ${engineCandidate}`,
  );
  const fixtureSource = await readFixtureSourceText(hostDir);
  assert(!fixtureSource.includes(engineCandidate), `fixture source accidentally covers manifest candidate ${engineCandidate}`);
  const hostConfig = await read(hostDir, "zfb.config.ts");
  assert(!/safelist/iu.test(hostConfig), "fixture zfb.config.ts contains a safelist");
  assert(!/safelist/iu.test(fixtureSource), "fixture source contains a safelist import or declaration");
  assert(!/@source\b/u.test(fixtureSource), "fixture CSS or source contains an @source directive");
  assert(selectors.has(`.${engineCandidate}`), `production CSS is missing engine-manifest candidate .${engineCandidate}`);
  console.log("OK — production host CSS contains wind catalog selectors and text-sg-muted from the packed engine manifest.");
}

async function readFixtureSourceText(hostDir) {
  const chunks = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(filePath);
      } else if (/\.(?:css|md|mdx|mjs|js|ts|tsx|jsx)$/u.test(entry.name)) {
        chunks.push(await readFile(filePath, "utf8"));
      }
    }
  }
  for (const directory of ["pages", "src", "ui"]) {
    const sourceRoot = path.join(hostDir, directory);
    if (existsSync(sourceRoot)) await visit(sourceRoot);
  }
  return chunks.join("\n");
}

export async function assertBuiltPreviewCss(hostDir, previewHtml) {
  const css = await read(hostDir, "dist/_zudo-sg/preview.css");
  const { default: postcss } = await import("postcss");
  const selectors = new Set();
  let scopedAccentToken = false;
  postcss.parse(css).walkRules((rule) => {
    for (const selector of rule.selectors) selectors.add(selector);
    if (rule.selectors.includes(":root[data-sg-preview-doc]")) {
      scopedAccentToken ||= rule.nodes.some(
        (node) => node.type === "decl" && node.prop === "--color-accent",
      );
    }
  });
  assert(selectors.has(":root[data-sg-preview-doc]"), "dist/_zudo-sg/preview.css has no scoped preview token root");
  assert(scopedAccentToken, "dist/_zudo-sg/preview.css has no scoped host accent token");
  assert(selectors.has(".bg-accent"), "dist/_zudo-sg/preview.css is missing the fixture's bg-accent wind candidate");
  const { JSDOM } = await import("jsdom");
  const previewDom = new JSDOM(previewHtml);
  const previewLinks = [...previewDom.window.document.querySelectorAll('link[href*="_zudo-sg/preview.css"]')]
    .map((link) => link.getAttribute("href") ?? "");
  previewDom.window.close();
  assert(
    previewLinks.length === 1 && new URL(previewLinks[0], "https://fixture.invalid").pathname === "/styleguide/_zudo-sg/preview.css",
    `preview CSS URL is not base-prefixed exactly once: ${previewLinks.join(", ") || "no link"}`,
  );
  console.log("OK — standalone preview CSS has scoped host tokens, a real utility, and one /styleguide/ URL prefix.");
}

/** Assert the actual files emitted by a route scenario, including each detail page's iframe target. */
async function assertPackedStoryRoutes(hostDir, scenarioName) {
  const scenario = PACKED_HOST_SCENARIOS[scenarioName];
  assert(scenario, `unknown packed-host route scenario ${scenarioName}`);
  const { JSDOM } = await import("jsdom");
  const previewFile = `dist/${scenario.previewPath.replace(/^\/+|\/+$/gu, "")}/index.html`;
  assert(existsSync(path.join(hostDir, previewFile)), `missing built preview endpoint ${previewFile}`);
  const previewDom = new JSDOM(await read(hostDir, previewFile));
  assert(previewDom.window.document.documentElement.hasAttribute("data-sg-preview-doc"), `${previewFile} is not the engine preview document`);
  previewDom.window.close();

  const basePrefix = fixtureBase.replace(/\/$/u, "");
  for (const story of scenario.stories) {
    const detailFile = `dist/components/${story.slug}/index.html`;
    assert(existsSync(path.join(hostDir, detailFile)), `missing built ${story.title} detail route ${detailFile}`);
    const dom = new JSDOM(await read(hostDir, detailFile));
    const document = dom.window.document;
    assert(document.querySelector("main h1")?.textContent?.trim() === story.title,
      `${detailFile} does not render the ${story.title} story identity in its heading`);
    const iframe = document.querySelector("main iframe");
    assert(iframe, `${detailFile} does not emit its preview iframe`);
    const iframeUrl = new URL(iframe.getAttribute("src") ?? "", "https://fixture.invalid");
    assert(iframeUrl.pathname === `${basePrefix}${scenario.previewPath}`,
      `${detailFile} iframe points to ${iframeUrl.pathname}, expected ${scenario.previewPath} under base ${fixtureBase}`);
    assert(iframeUrl.searchParams.get("slug") === story.slug,
      `${detailFile} iframe query selects ${iframeUrl.searchParams.get("slug")}, expected ${story.slug}`);
    assert(iframeUrl.searchParams.get("variant") === "Default",
      `${detailFile} iframe query does not select the Default story`);
    assert(iframeUrl.pathname !== `${basePrefix}/components/${story.slug}`,
      `${story.title} detail and iframe endpoints resolve to the same URL`);
    dom.window.close();
  }
  console.log(`OK — ${scenarioName} build emits separate detail and preview routes for ${scenario.stories.map((story) => story.title).join(", ")}.`);
}

function addScenarioRoutes(configSource, scenarioName) {
  const scenario = PACKED_HOST_SCENARIOS[scenarioName];
  assert(scenario, `unknown packed-host route scenario ${scenarioName}`);
  if (Object.keys(scenario.routes).length === 0) return configSource;
  const exportStart = "export default {";
  assert(configSource.includes(exportStart), "fixture config no longer has the expected default export insertion point");
  return configSource.replace(exportStart, `${exportStart}\n  routes: ${JSON.stringify(scenario.routes)},`);
}

async function verifyPackedHostBrowser(hostDir, scenarioName, mode = "default") {
  const args = [
    path.join(root, "scripts/verify-styleguide-install-browser.mjs"),
    "--host", hostDir,
    "--scenario", scenarioName,
  ];
  if (mode === "early-click") args.push("--early-click");
  if (mode === "ready-host-bootstrap") args.push("--ready-host-bootstrap");
  await run("node", args, root);
}

async function main() {
  const artifacts = await mkdtemp(path.join(os.tmpdir(), "zudo-sg-engine-pack-"));
  const hostDir = await mkdtemp(path.join(os.tmpdir(), "zudo-sg-engine-host-"));
  let devServer;

  try {
    const tarballIndex = process.argv.indexOf("--tarball");
    assert(tarballIndex === -1 || (readmeInstallOnly && process.argv[tarballIndex + 1]), "--tarball requires a path and --readme-install-only");
    if (tarballIndex === -1) console.log(`Packing @takazudo/zudo-sg (${packageDirRelative}) -> ${artifacts}`);
    const tarballPath = tarballIndex === -1 ? await packEngine(artifacts) : path.resolve(process.argv[tarballIndex + 1]);
    const packageManifest = await assertTarballShape(tarballPath);
    await verifyDocumentedInstall(tarballPath, packageManifest);
    if (readmeInstallOnly) return;

    console.log(`Copying fixtures/engine-host -> ${hostDir}`);
    await copyFixture(hostDir);
    await mkdir(path.join(hostDir, ".tarball"), { recursive: true });
    await cp(tarballPath, path.join(hostDir, ".tarball", tarballName));

    console.log("Installing (tarball + exact @takazudo/zfb / @takazudo/zudo-doc pins)");
    await run("corepack", ["pnpm", "install"], hostDir);
    await assertForeignPackage(hostDir);
    const preactProof = await assertSharedPreact(hostDir);

    console.log("Removing the fixture registry before zudo-sg gen-registry (bootstrap proof)");
    await rm(path.join(hostDir, "src/styleguide/sg-registry.ts"), { force: true });
    assert(!existsSync(path.join(hostDir, "src/styleguide/sg-registry.ts")), "failed to remove fixture registry before bootstrap");
    console.log("zudo-sg gen-registry (missing-output bootstrap)");
    await run("corepack", ["pnpm", "exec", "zudo-sg", "gen-registry"], hostDir);
    assert(existsSync(path.join(hostDir, "src/styleguide/sg-registry.ts")), "gen-registry did not recreate the missing fixture registry");

    console.log("zudo-sg gen-token-manifest (fixture CSS -> packed CLI -> consumer manifest)");
    await run("corepack", ["pnpm", "exec", "zudo-sg", "gen-token-manifest"], hostDir);
    const tokenManifest = await read(hostDir, "src/styleguide/token-manifest.ts");
    const tokenManifestHeader = tokenManifest.match(/^\/\*\*[\s\S]*?\*\//u)?.[0] ?? "";
    assert(tokenManifestHeader.includes("src/styles/ui-tokens.css"), "generated token manifest header lacks the fixture CSS path");
    assert(!tokenManifestHeader.includes("demo-ui"), "generated token manifest header contains demo-ui provenance");
    assert(!tokenManifestHeader.includes("pnpm gen:"), "generated token manifest header contains the old pnpm gen command");
    await run("corepack", ["pnpm", "exec", "zudo-sg", "gen-token-manifest", "--check"], hostDir);

    console.log("Type-checking the consumer against packed declarations: tsc --noEmit -p tsconfig.json");
    await run("corepack", ["pnpm", "exec", "tsc", "--noEmit", "-p", "tsconfig.json"], hostDir);

    // Exercise the real injected route without `tokens`, then restore the
    // configured host. Separate clean builds prevent stale HTML from passing.
    const configSource = await read(hostDir, "zudo-sg.config.mjs");
    await writeFile(path.join(hostDir, "zudo-sg.with-tokens.config.mjs"), configSource);
    await writeFile(path.join(hostDir, "zudo-sg.config.mjs"), [
      'import config from "./zudo-sg.with-tokens.config.mjs";',
      "const { tokens, ...withoutTokens } = config;",
      "export default withoutTokens;",
      "",
    ].join("\n"));
    console.log("zfb build (/tokens empty-state mode)");
    await run("corepack", ["pnpm", "exec", "zfb", "build"], hostDir);
    await assertTokensRoute(hostDir, true);
    await assertHeadAssets(hostDir);
    await writeFile(path.join(hostDir, "zudo-sg.config.mjs"), configSource);
    await rm(path.join(hostDir, "zudo-sg.with-tokens.config.mjs"));
    for (const output of ["dist", ".zfb-build"]) {
      await rm(path.join(hostDir, output), { recursive: true, force: true });
    }

    console.log("zfb build (/tokens dashboard mode)");
    const buildLog = await runStreamed("corepack", ["pnpm", "exec", "zfb", "build"], hostDir);
    assert(!/has no matching registry entry/u.test(buildLog), "zfb build logged an unregistered island marker");

    const catalogIndex = await read(hostDir, "dist/components/index.html");
    for (const [href, label] of [
      ["/styleguide/components", "Components"],
      ["/styleguide/tokens", "Design Tokens"],
    ]) {
      assert(
        (catalogIndex.includes(`href="${href}"`) || catalogIndex.includes(`href=${href}`)) &&
          catalogIndex.includes(`>${label}<`),
        `dist/components/index.html lacks the minimal-host ${label} header navigation`,
      );
    }
    assert(
      catalogIndex.includes("data-open-search"),
      "dist/components/index.html lacks the minimal-host search control",
    );
    assert(
      catalogIndex.includes("Button") && catalogIndex.includes("Card") && catalogIndex.includes("Counter"),
      "catalog index is missing a registered story title",
    );

    const slugDirs = (await readdir(path.join(hostDir, "dist/components"), { withFileTypes: true }))
      .filter((e) => e.isDirectory() && e.name !== "preview")
      .map((e) => e.name);
    const defaultProbeSlugs = PACKED_HOST_SCENARIOS.default.stories.map((story) => story.slug);
    assert(slugDirs.length === 6, `expected 6 component detail routes, found ${slugDirs.length} (${slugDirs.join(", ")})`);
    for (const slug of [...defaultProbeSlugs, "button", "card", "counter"]) {
      assert(slugDirs.includes(slug), `missing expected component detail route ${slug} (${slugDirs.join(", ")})`);
    }
    for (const slug of slugDirs) {
      const detailPath = `dist/components/${slug}/index.html`;
      assert(existsSync(path.join(hostDir, detailPath)), `missing ${detailPath}`);
      const detail = await read(hostDir, detailPath);
      assert(/<h1[^>]*>[^<]+<\/h1>/.test(detail), `${detailPath} has no story title heading`);
    }

    // Component MDX docs resolve from the components root the story key belongs
    // to — here a non-`ui/src` root (`dir: "ui"`), #670.
    const buttonSlug = slugDirs.find((slug) => slug.includes("button"));
    assert(buttonSlug, `no button detail route among ${slugDirs.join(", ")}`);
    const buttonDetail = await read(hostDir, `dist/components/${buttonSlug}/index.html`);
    assert(
      buttonDetail.includes("Button usage notes") && buttonDetail.includes("co-located component doc"),
      `dist/components/${buttonSlug}/index.html does not render ui/button/button.mdx`,
    );
    const cardSlug = slugDirs.find((slug) => slug.includes("card"));
    assert(
      cardSlug && !(await read(hostDir, `dist/components/${cardSlug}/index.html`)).includes("Button usage notes"),
      "the Button component doc leaked onto the Card detail page",
    );

    const previewHtml = await read(hostDir, "dist/components/preview/index.html");
    assert(
      previewHtml.includes('href="/styleguide/_zudo-sg/preview.css"') || previewHtml.includes("href=/styleguide/_zudo-sg/preview.css"),
      "preview document does not link /styleguide/_zudo-sg/preview.css",
    );
    await assertPackedStoryRoutes(hostDir, "default");

    assert(existsSync(path.join(hostDir, "dist/tokens/index.html")), "missing dist/tokens/index.html");
    await assertTokensRoute(hostDir, false);
    assert(existsSync(path.join(hostDir, "dist/_zudo-sg/preview.css")), "missing dist/_zudo-sg/preview.css (base-unnested, ADR decision 4)");
    await assertBuiltPreviewCss(hostDir, previewHtml);
    await assertHeadAssets(hostDir);

    await assertProductionCss(hostDir);
    await assertSingleBundledRenderer(hostDir, preactProof.adapterPath);

    const buildIslandsManifestFiles = (await readdir(path.join(hostDir, "dist/assets"))).filter((f) => /^islands-.*\.js$/.test(f));
    assert(buildIslandsManifestFiles.length > 0, "no dist/assets/islands-*.js manifest found");
    const buildIslandsBundle = (
      await Promise.all(buildIslandsManifestFiles.map((f) => read(hostDir, `dist/assets/${f}`)))
    ).join("\n");
    assert(buildIslandsBundle.includes("Counter"), "dist/assets/islands-*.js does not contain Counter (half b, build side)");

    await verifyPackedHostBrowser(hostDir, "default", "early-click");

    // The ordinary starter mounts the panel only on engine routes to prove
    // pre-hydration capture. Rebuild a separate packed consumer with the
    // reported public topology: the same island mounts on host and engine.
    const wrapperPath = path.join(hostDir, "pages/lib/_engine-route-preview-token-panel-bootstrap.tsx");
    const wrapperSource = await readFile(wrapperPath, "utf8");
    const engineOnlyGuard = 'if (typeof document === "undefined" || !document.querySelector("[data-sg-engine-route]")) return null;';
    assert(wrapperSource.includes(engineOnlyGuard), "fixture engine-only bootstrap guard moved");
    await writeFile(wrapperPath, wrapperSource.replace(engineOnlyGuard, 'if (typeof document === "undefined") return null;'));
    for (const output of ["dist", ".zfb-build"]) {
      await rm(path.join(hostDir, output), { recursive: true, force: true });
    }
    console.log("zfb build (packed host + engine preview bootstrap)");
    const readyHostBuildLog = await runStreamed("corepack", ["pnpm", "exec", "zfb", "build"], hostDir);
    assert(!/has no matching registry entry/u.test(readyHostBuildLog), "ready-host build logged an unregistered island marker");
    await verifyPackedHostBrowser(hostDir, "default", "ready-host-bootstrap");
    await writeFile(wrapperPath, wrapperSource);
    for (const output of ["dist", ".zfb-build"]) {
      await rm(path.join(hostDir, output), { recursive: true, force: true });
    }

    // Repeat clean packed-consumer builds with a preview endpoint that
    // collides with a story detail path, then one outside that namespace.
    // The route probes above share the same installed tarball and pinned peers.
    for (const scenarioName of ["custom-collision", "outside-namespace"]) {
      await writeFile(path.join(hostDir, "zudo-sg.config.mjs"), addScenarioRoutes(configSource, scenarioName));
      for (const output of ["dist", ".zfb-build"]) {
        await rm(path.join(hostDir, output), { recursive: true, force: true });
      }
      console.log(`zfb build (packed route scenario: ${scenarioName})`);
      const scenarioBuildLog = await runStreamed("corepack", ["pnpm", "exec", "zfb", "build"], hostDir);
      assert(!/has no matching registry entry/u.test(scenarioBuildLog), `${scenarioName} build logged an unregistered island marker`);
      await assertPackedStoryRoutes(hostDir, scenarioName);
      await verifyPackedHostBrowser(hostDir, scenarioName);
    }
    await writeFile(path.join(hostDir, "zudo-sg.config.mjs"), configSource);
    for (const output of ["dist", ".zfb-build"]) {
      await rm(path.join(hostDir, output), { recursive: true, force: true });
    }

    console.log("Stripping the islands seed from the temp copy (ADR finding 4 amendment regression guard)");
    await rm(path.join(hostDir, "pages/lib/_zudo-sg-islands.ts"), { force: true });
    const seedImportLine = 'import "./lib/_zudo-sg-islands";';
    const indexSource = await read(hostDir, "pages/index.tsx");
    assert(indexSource.includes(seedImportLine), `expected \`${seedImportLine}\` in pages/index.tsx — shim wiring moved`);
    await writeFile(
      path.join(hostDir, "pages/index.tsx"),
      indexSource.split("\n").filter((line) => line.trim() !== seedImportLine).join("\n"),
    );

    console.log("zfb dev (seedless: injected routes + virtual registry islands, dev CSS globs — ADR finding 4 amendment)");
    const port = await freePort();
    let log = "";
    devServer = spawn("corepack", ["pnpm", "exec", "zfb", "dev", "--port", String(port)], {
      cwd: hostDir,
      env: { ...process.env, NO_COLOR: "1" },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    devServer.stdout?.on("data", (chunk) => (log += String(chunk)));
    devServer.stderr?.on("data", (chunk) => (log += String(chunk)));

    const origin = `http://127.0.0.1:${port}`;
    const islandsRes = await waitForOk(`${origin}/styleguide/assets/islands.js`, 300_000, devServer, () => log);
    const islandsBundle = await islandsRes.text();
    assert(islandsBundle.includes("ConfiguredPreviewApp"), "/styleguide/assets/islands.js does not contain ConfiguredPreviewApp");
    // Half (b): Counter is reached only through `virtual:zudo-sg-registry` —
    // the fixture host's pages/ imports nothing else, which is the isolation.
    assert(
      /__zfb_register\([^)]*"Counter",\s*"[^"]*\/ui\/counter\/counter\.tsx"\)/u.test(islandsBundle),
      "/styleguide/assets/islands.js does not register Counter from ui/counter/counter.tsx (half b, virtual registry)",
    );
    assert(!/has no matching registry entry/u.test(log), "zfb dev logged an unregistered island marker");
    assert(!/no "use client" islands found/u.test(log), 'zfb dev logged no "use client" islands found');

    // A wind-valid arbitrary width candidate used by this fixture's homepage
    // must appear in dev CSS from the host source roots.
    const cssRes = await waitForOk(`${origin}/styleguide/assets/styles.css`, 300_000, devServer, () => log);
    const cssBody = await cssRes.text();
    assert(cssBody.includes(".max-w-\\[48rem\\]"), "/styleguide/assets/styles.css is missing the fixture's .max-w-\\[48rem\\] candidate");

    const previewCssUrl = `${origin}/styleguide/_zudo-sg/preview.css`;
    const firstPreviewResponse = await waitForOk(previewCssUrl, 300_000, devServer, () => log);
    const firstPreviewCss = await firstPreviewResponse.text();
    assert(firstPreviewCss.includes(":root[data-sg-preview-doc]"), "dev preview CSS is missing scoped preview roots");
    assert(firstPreviewCss.includes(".bg-accent"), "dev preview CSS is missing the fixture's bg-accent candidate");

    const componentsCssPath = path.join(hostDir, "src/styles/components.css");
    const componentsCssBefore = await readFile(componentsCssPath, "utf8");
    await writeFile(
      componentsCssPath,
      `${componentsCssBefore}\n.zc-preview-import-proof { --f1-import-proof: imported; }\n`,
    );
    const importedPreviewCss = await waitForBody(
      previewCssUrl,
      60_000,
      devServer,
      () => log,
      (body) => body.includes(".zc-preview-import-proof"),
    );
    assert(importedPreviewCss.includes(".zc-preview-import-proof"), "preview CSS did not recompile after an imported stylesheet edit");

    const cardPath = path.join(hostDir, "ui/card/card.tsx");
    const cardBefore = await readFile(cardPath, "utf8");
    const cardAfter = cardBefore.replace(
      'class="zc-fixture-card border',
      'class="zc-fixture-card max-w-[37rem] border',
    );
    assert(cardAfter !== cardBefore, "failed to add the preview source-edit candidate to Card");
    await writeFile(cardPath, cardAfter);
    const sourceEditedPreviewCss = await waitForBody(
      previewCssUrl,
      60_000,
      devServer,
      () => log,
      (body) => body.includes(".max-w-\\[37rem\\]"),
    );
    assert(sourceEditedPreviewCss.includes(".max-w-\\[37rem\\]"), "preview CSS did not recompile after a component source edit");

    {
      await stopDevServerAndWait(devServer);
      devServer = undefined;
      const variantRoot = path.join(root, "fixtures/foreign-tokens");
      await cp(path.join(fixtureRoot, "pages/lib/_zudo-sg-islands.ts"), path.join(hostDir, "pages/lib/_zudo-sg-islands.ts"));
      await cp(path.join(fixtureRoot, "pages/index.tsx"), path.join(hostDir, "pages/index.tsx"));
      await cp(path.join(fixtureRoot, "src/styles/global.css"), path.join(hostDir, "src/styles/global.css"));
      await writeFile(path.join(hostDir, "zudo-sg.default.config.mjs"), configSource);
      await cp(path.join(variantRoot, "zudo-sg.config.mjs"), path.join(hostDir, "zudo-sg.config.mjs"));
      await cp(path.join(variantRoot, "ui-tokens.css"), path.join(hostDir, "src/styles/ui-tokens.css"));
      await cp(path.join(variantRoot, "probe.mjs"), path.join(hostDir, "probe.mjs"));
      for (const output of ["dist", ".zfb-build"]) await rm(path.join(hostDir, output), { recursive: true, force: true });
      console.log("zudo-sg gen-token-manifest (foreign vocabulary)");
      await run("corepack", ["pnpm", "exec", "zudo-sg", "gen-token-manifest"], hostDir);
      await run("corepack", ["pnpm", "exec", "zudo-sg", "gen-token-manifest", "--check"], hostDir);
      await run("corepack", ["pnpm", "exec", "tsc", "--noEmit", "-p", "tsconfig.json"], hostDir);
      await run("node", ["probe.mjs"], hostDir);
      await runStreamed("corepack", ["pnpm", "exec", "zfb", "build"], hostDir);
      const { JSDOM } = await import("jsdom");
      const dom = new JSDOM(await read(hostDir, "dist/tokens/index.html"));
      const page = dom.window.document;
      const dashboards = assertDashboardFallbacks(page);
      const rows = dashboards[2].tabs.flatMap((tab) => tab.tiers.flatMap((tier) => tier.items));
      const names = new Set(rows.map((item) => item.cssVar));
      for (const name of ["--brand-100", "--brand-500", "--signal-calm", "--status-alert", "--space-inline", "--type-body", "--type-leading", "--type-weight", "--corner-card", "--surface-canvas"]) {
        assert(names.has(name), `foreign dashboard payload lost ${name}`);
      }
      assert(![...names].some((name) => name.startsWith("--palette-")), "foreign dashboard payload introduced demo palette variables");
      assert(rows.find((item) => item.cssVar === "--surface-canvas")?.default === "light-dark(var(--brand-100), var(--brand-500))", "foreign dashboard payload lost its declared light-dark value");
      dom.window.close();
      console.log("OK — packed foreign host typechecks and serializes every category behind truthful /tokens loading shells.");
    }

    console.log("OK — packed @takazudo/zudo-sg installs and builds outside the workspace, under base \"/styleguide/\".");
  } finally {
    stopDevServer(devServer);
    if (!keep) {
      await rm(artifacts, { recursive: true, force: true });
      await rm(hostDir, { recursive: true, force: true });
    } else {
      console.log(`--keep: left ${artifacts} and ${hostDir} on disk.`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
