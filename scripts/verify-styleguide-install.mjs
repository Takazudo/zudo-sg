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
// contains the catalog and responsive sidebar selectors. Then strips the
// islands seed (`pages/lib/_zudo-sg-islands.ts` + its import) and engine CSS
// safelist from the temp copy and boots `zfb dev` once, asserting
// `ConfiguredPreviewApp` (reached through the
// injected route entrypoint) AND the fixture's `Counter` island (reached only
// through `virtual:zudo-sg-registry`) both register in
// `/styleguide/assets/islands.js`, and that the dev CSS content globs seeded
// from the injected routes reach `/styleguide/assets/styles.css` — the
// regression guard for zfb 2.18.0's dev-scanner and CSS-glob seeding (ADR
// finding 4 amendment). The build phases above run on the as-shipped fixture
// (seed present), so they still prove the seed is a harmless no-op.
//
// Model: scripts/__tests__/zudo-sg-no-stub-build.slow.test.ts (build +
// dev boot, free-port + process-group kill).

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

function fail(message) {
  throw new Error(`[verify styleguide install] ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

/** stdio inherited: build/dev output is the point of a failure, and should stream while running. */
function run(command, commandArgs, cwd) {
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
function runStreamed(command, commandArgs, cwd) {
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
function runCapture(command, commandArgs, cwd, includeStderr = false) {
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

function stopDevServer(child) {
  if (!child || child.exitCode !== null || child.pid === undefined) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

async function packEngine(destination) {
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

async function assertTarballShape(tarballPath) {
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

async function assertForeignPackage(hostDir) {
  const installed = await realpath(path.join(hostDir, "node_modules/@takazudo/zudo-sg"));
  const modules = path.join(await realpath(hostDir), "node_modules") + path.sep;
  assert(installed.startsWith(modules), `installed engine resolves outside the scratch node_modules: ${installed}`);
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

async function copyFixture(destination) {
  await cp(fixtureRoot, destination, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(fixtureRoot, source);
      if (relative === "") return true;
      const segments = relative.split(path.sep);
      return (
        !segments.some((segment) => skippedFixtureEntries.has(segment)) &&
        !skippedFixtureFilePatterns.some((pattern) => pattern.test(segments.at(-1)))
      );
    },
  });
}

function read(hostDir, rel) {
  return readFile(path.join(hostDir, rel), "utf8");
}

async function collectHtmlFiles(directory) {
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
      const icons = [...document.head.querySelectorAll("link")].filter((link) => relTokens(link).has("icon"));
      assert(icons.length === 1, `${relativePage} has ${icons.length} zudo-doc favicon links; expected exactly one`);
      const href = icons[0].getAttribute("href") ?? "";
      assert(href.startsWith("data:image/svg+xml"), `${relativePage} zudo-doc favicon is not an inline data:image/svg+xml URL`);
    }
    dom.window.close();
  }
  console.log(`OK — every fixture HTML page has existing local head assets (${htmlFiles.length} pages checked).`);
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
    assert(!document.querySelector(".zdtp-dashboard"), "empty /tokens mode unexpectedly rendered a dashboard");
    console.log("OK — /tokens empty state: [data-zudo-sg-tokens-empty].");
    return;
  }
  assert(!emptyState, "configured /tokens unexpectedly rendered the empty state");
  const dashboard = document.querySelector("#ui-defaults-shared.zdtp-dashboard");
  assert(dashboard, "dist/tokens/index.html lacks #ui-defaults-shared.zdtp-dashboard");
  const token = dashboard.querySelector('.zdtp-dashboard__token[data-css-var="--spacing-hsp-md"]');
  assert(token, 'shared dashboard lacks .zdtp-dashboard__token[data-css-var="--spacing-hsp-md"]');
  assert(token.querySelector(".zdtp-dashboard__value")?.textContent === "1rem", "shared dashboard lacks the fixture's declared spacing value");
  console.log('OK — /tokens renders #ui-defaults-shared.zdtp-dashboard .zdtp-dashboard__token[data-css-var="--spacing-hsp-md"] with value 1rem.');
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
  // Match whole selectors: .lg\:flex-1 must not stand in for .lg\:flex.
  for (const selector of [".sg-grid", ".sticky", ".lg\\:hidden", ".lg\\:flex"]) {
    assert(selectors.has(selector), `dist/assets/styles-*.css is missing ${selector}`);
  }
  console.log("OK — production host CSS contains the catalog grid, sticky sidebar, and responsive visibility selectors.");
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
    assert(slugDirs.length === 3, `expected 3 component detail routes, found ${slugDirs.length} (${slugDirs.join(", ")})`);
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

    assert(existsSync(path.join(hostDir, "dist/tokens/index.html")), "missing dist/tokens/index.html");
    await assertTokensRoute(hostDir, false);
    assert(existsSync(path.join(hostDir, "dist/_zudo-sg/preview.css")), "missing dist/_zudo-sg/preview.css (base-unnested, ADR decision 4)");
    await assertHeadAssets(hostDir);

    await assertProductionCss(hostDir);

    const buildIslandsManifestFiles = (await readdir(path.join(hostDir, "dist/assets"))).filter((f) => /^islands-.*\.js$/.test(f));
    assert(buildIslandsManifestFiles.length > 0, "no dist/assets/islands-*.js manifest found");
    const buildIslandsBundle = (
      await Promise.all(buildIslandsManifestFiles.map((f) => read(hostDir, `dist/assets/${f}`)))
    ).join("\n");
    assert(buildIslandsBundle.includes("Counter"), "dist/assets/islands-*.js does not contain Counter (half b, build side)");

    console.log("Stripping the islands seed from the temp copy (ADR finding 4 amendment regression guard)");
    await rm(path.join(hostDir, "pages/lib/_zudo-sg-islands.ts"), { force: true });
    const seedImportLine = 'import "./lib/_zudo-sg-islands";';
    const indexSource = await read(hostDir, "pages/index.tsx");
    assert(indexSource.includes(seedImportLine), `expected \`${seedImportLine}\` in pages/index.tsx — shim wiring moved`);
    await writeFile(
      path.join(hostDir, "pages/index.tsx"),
      indexSource.split("\n").filter((line) => line.trim() !== seedImportLine).join("\n"),
    );

    // Production above uses the shipped safelist. Remove only its import in
    // this scratch dev run so it cannot mask broken injected-route CSS scans.
    const globalCssSource = await read(hostDir, "src/styles/global.css");
    const engineSafelistImport = '@import "@takazudo/zudo-sg/safelist.css";';
    assert(globalCssSource.includes(engineSafelistImport), "expected engine safelist import in src/styles/global.css");
    await writeFile(path.join(hostDir, "src/styles/global.css"), globalCssSource.replace(engineSafelistImport, ""));

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

    // A utility class used only by the injected components-index.tsx /
    // tokens.tsx headers (`max-w-[56rem]`): the scratch host has no engine
    // safelist or `@source`, so it reaches the dev stylesheet only through the
    // injected-route content globs zfb 2.18.0 seeds (absent on 2.17.0).
    const cssRes = await waitForOk(`${origin}/styleguide/assets/styles.css`, 300_000, devServer, () => log);
    const cssBody = await cssRes.text();
    assert(cssBody.includes(".max-w-\\[56rem\\]"), "/styleguide/assets/styles.css is missing .max-w-\\[56rem\\] (dev CSS content-glob seeding, ADR finding 4 amendment)");

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
