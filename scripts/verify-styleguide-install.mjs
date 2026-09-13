// Foreign-install proof for `@takazudo/zudo-sg` (#665, docs/adr/styleguide-engine.md).
//
// Packs the engine with `pnpm pack`, installs the tarball plus exact
// `@takazudo/zfb`/`@takazudo/zudo-doc` pins into a copy of
// `fixtures/engine-host/` OUTSIDE this workspace (realpath under
// `node_modules`, no workspace link, no `packages: []` escape hatch shared
// with this repo), runs the generated-registry CLI, builds, and asserts the
// four injected routes + the standalone preview stylesheet exist under the
// fixture's non-root `base` ("/styleguide/"). Then boots `zfb dev` once and
// asserts the dev-hydration seed (ADR finding 4) puts `ConfiguredPreviewApp`
// into `/styleguide/assets/islands.js` — dev scans host `pages/` only, so
// without `pages/lib/_zudo-sg-islands.ts` this would 404 / omit the marker.
//
// Model: scripts/test-ui-provider-package.mjs (isolated copy + frozen
// install) and scripts/__tests__/zudo-sg-no-stub-build.slow.test.ts (build +
// dev boot, free-port + process-group kill).

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixtureRoot = path.join(root, "fixtures/engine-host");
const packageDirRelative = "packages/styleguide";
const tarballName = "zudo-sg-engine.tgz";
const keep = process.argv.includes("--keep") || Boolean(process.env.ZUDO_SG_VERIFY_KEEP);

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

/** Captures stdout instead of streaming it — used only for `pnpm pack`'s printed tarball filename. */
function runCapture(command, commandArgs, cwd) {
  return new Promise((resolvePromise, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, commandArgs, { cwd, env: process.env });
    child.stdout?.on("data", (chunk) => (stdout += String(chunk)));
    child.stderr?.on("data", (chunk) => (stderr += String(chunk)));
    child.on("error", (error) => reject(new Error(`${command} could not start: ${error.message}`)));
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise(stdout);
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
  // own (unlike packages/ui), so this runs safely from the repo root — no
  // standalone-tree contamination risk (see CLAUDE.md's packages/ui warning).
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
  // styles.css (+ package.json, always included by npm/pnpm). CHANGELOG.md /
  // README.md are #668's — the package's own `files` array may still omit
  // them, and that is not this script's concern.
  const allowedTopLevel = new Set(["dist", "bin", "routes-src", "virtual-modules.d.ts", "styles.css", "package.json"]);
  const forbiddenSubstrings = ["doc/", "src/", "apps/", "packages/ui", "fixtures/"];
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
}

async function copyFixture(destination) {
  await cp(fixtureRoot, destination, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(fixtureRoot, source);
      if (relative === "") return true;
      const segments = relative.split(path.sep);
      return !["node_modules", "dist", ".zfb-build", ".tarball", "pnpm-lock.yaml"].includes(segments[0]);
    },
  });
}

function read(hostDir, rel) {
  return readFile(path.join(hostDir, rel), "utf8");
}

async function main() {
  const artifacts = await mkdtemp(path.join(os.tmpdir(), "zudo-sg-engine-pack-"));
  const hostDir = await mkdtemp(path.join(os.tmpdir(), "zudo-sg-engine-host-"));
  let devServer;

  try {
    console.log(`Packing @takazudo/zudo-sg (${packageDirRelative}) -> ${artifacts}`);
    const tarballPath = await packEngine(artifacts);
    await assertTarballShape(tarballPath);

    console.log(`Copying fixtures/engine-host -> ${hostDir}`);
    await copyFixture(hostDir);
    await mkdir(path.join(hostDir, ".tarball"), { recursive: true });
    await cp(tarballPath, path.join(hostDir, ".tarball", tarballName));

    console.log("Installing (tarball + exact @takazudo/zfb / @takazudo/zudo-doc pins)");
    await run("corepack", ["pnpm", "install"], hostDir);

    console.log("zudo-sg gen-registry");
    await run("corepack", ["pnpm", "exec", "zudo-sg", "gen-registry"], hostDir);

    console.log("zfb build");
    await run("corepack", ["pnpm", "exec", "zfb", "build"], hostDir);

    const catalogIndex = await read(hostDir, "dist/components/index.html");
    assert(catalogIndex.includes("Button") && catalogIndex.includes("Card"), "catalog index is missing a registered story title");

    const slugDirs = (await readdir(path.join(hostDir, "dist/components"), { withFileTypes: true }))
      .filter((e) => e.isDirectory() && e.name !== "preview")
      .map((e) => e.name);
    assert(slugDirs.length === 2, `expected 2 component detail routes, found ${slugDirs.length} (${slugDirs.join(", ")})`);
    for (const slug of slugDirs) {
      const detailPath = `dist/components/${slug}/index.html`;
      assert(existsSync(path.join(hostDir, detailPath)), `missing ${detailPath}`);
      const detail = await read(hostDir, detailPath);
      assert(/<h1[^>]*>[^<]+<\/h1>/.test(detail), `${detailPath} has no story title heading`);
    }

    const previewHtml = await read(hostDir, "dist/components/preview/index.html");
    assert(
      previewHtml.includes('href="/styleguide/_zudo-sg/preview.css"') || previewHtml.includes("href=/styleguide/_zudo-sg/preview.css"),
      "preview document does not link /styleguide/_zudo-sg/preview.css",
    );

    assert(existsSync(path.join(hostDir, "dist/tokens/index.html")), "missing dist/tokens/index.html");
    assert(existsSync(path.join(hostDir, "dist/_zudo-sg/preview.css")), "missing dist/_zudo-sg/preview.css (base-unnested, ADR decision 4)");

    console.log("zfb dev (dev-hydration seed, ADR finding 4)");
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
