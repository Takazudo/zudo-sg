// #980 / #963: diagnose a valid retained consumer lock through the actual
// packed browser host, then prove consumer-owned deduplication repairs it.
// This is deliberately a negative diagnostic, not a universal dependency fix.
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { assert, assertForeignPackage, assertTarballShape, copyFixtureDir, packEngine, runCapture } from "./verify-styleguide-install.mjs";
import { BASE, launchChromium, startBuiltHost } from "./verify-styleguide-install-browser.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const hash = source => createHash("sha256").update(source).digest("hex");
const oldCommon = "1.5.2";
const sharedCommon = "1.5.3";

export function isExpectedHighlightFailure(error) {
  // Production minification renames the unminified `tags` identifier (the
  // packed proof reports `s`). Require the exact plugin/type failure and the
  // complete highlighter path, rather than accepting any iterable exception.
  return error.type === "console"
    && /^CodeMirror plugin crashed: TypeError: [A-Za-z_$][\w$]* is not iterable\n/u.test(error.text)
    && ["HighlightStyle.style", "highlightTags", "HighlightBuilder.highlightRange", "highlightTree", "TreeHighlighter.buildDeco"]
      .every(frame => error.text.includes(`\n    at ${frame} (`));
}

// Modify only a dependency edge permitted by the published parent range.
// Fail on graph drift rather than silently manufacturing a different probe.
export function seedRetainedLock(source, integrity) {
  assert(/^sha512-[A-Za-z0-9+/=]+$/u.test(integrity), "invalid published common integrity");
  assert(!source.includes(`'@lezer/common@${oldCommon}':`), "clean control already contains old common");
  const marker = "\nsnapshots:\n";
  assert(source.split(marker).length === 2, "expected one pnpm snapshots section");
  const [packages, snapshots] = source.split(marker);
  const commonKey = `  '@lezer/common@${sharedCommon}':`;
  assert(packages.split(commonKey).length === 2, "expected one shared common package record");
  assert(snapshots.split(commonKey).length === 2, "expected one shared common snapshot");
  const highlightBlocks = [...snapshots.matchAll(/^  '@lezer\/highlight@[^'\n]+':\n(?: {4}[^\n]*\n|\n)*/gmu)];
  assert(highlightBlocks.length === 1, `expected one highlight snapshot, found ${highlightBlocks.length}`);
  const block = highlightBlocks[0][0];
  const edge = `      '@lezer/common': ${sharedCommon}`;
  assert(block.split(edge).length === 2, "highlight does not resolve the expected shared common");
  const seededPackages = packages.replace(commonKey, `  '@lezer/common@${oldCommon}':\n    resolution: {integrity: ${integrity}}\n\n${commonKey}`);
  const seededSnapshots = snapshots.replace(block, block.replace(edge, `      '@lezer/common': ${oldCommon}`))
    .replace(commonKey, `  '@lezer/common@${oldCommon}': {}\n\n${commonKey}`);
  return `${seededPackages}${marker}${seededSnapshots}`;
}

async function resolutionGraphInProcess(host) {
  const engine = await realpath(path.join(host, "node_modules/@takazudo/zudo-sg/dist/code-panel/editor-setup.js"));
  const from = async (specifier, base) => await realpath(createRequire(base).resolve(specifier));
  const language = await from("@codemirror/language", engine);
  const langCss = await from("@codemirror/lang-css", engine);
  const langJs = await from("@codemirror/lang-javascript", engine);
  const css = await from("@lezer/css", langCss);
  const javascript = await from("@lezer/javascript", langJs);
  const highlight = await from("@lezer/highlight", engine);
  const consumers = {
    language, langCss, langJs, css, javascript, highlight,
    commands: await from("@codemirror/commands", engine),
    autocomplete: await from("@codemirror/autocomplete", langCss),
    lr: await from("@lezer/lr", language),
  };
  const common = Object.fromEntries(await Promise.all(Object.entries(consumers).map(async ([name, base]) => [name, await from("@lezer/common", base)])));
  const identities = {
    "@lezer/common": Object.values(common),
    "@lezer/highlight": await Promise.all([engine, language, css, javascript].map(base => from("@lezer/highlight", base))),
    "@codemirror/language": await Promise.all([engine, langCss, langJs, consumers.commands].map(base => from("@codemirror/language", base))),
    "@codemirror/state": await Promise.all([engine, language, langCss, langJs, await from("@codemirror/view", engine)].map(base => from("@codemirror/state", base))),
  };
  return { engine, common, identities };
}

export async function resolutionGraph(host) {
  // Node caches require.resolve's symlink targets for the process lifetime.
  // Each install/dedupe can replace the same pnpm paths with different links,
  // so inspect every stage in a fresh process with an empty resolution cache.
  const resultFile = path.join(host, ".retained-lezer-graph.json");
  const probe = `
    import { realpath, writeFile } from "node:fs/promises";
    import { createRequire } from "node:module";
    import path from "node:path";
    const inspect = ${resolutionGraphInProcess.toString()};
    await writeFile(process.argv[2], JSON.stringify(await inspect(process.argv[1])));
  `;
  await rm(resultFile, { force: true });
  await runCapture(process.execPath, ["--input-type=module", "-e", probe, host, resultFile], host);
  return JSON.parse(await readFile(resultFile, "utf8"));
}

function assertGraph(graph, split) {
  for (const [name, paths] of Object.entries(graph.identities)) {
    assert(new Set(paths).size === (split && name === "@lezer/common" ? 2 : 1), `unexpected ${name} identities: ${JSON.stringify(paths)}`);
  }
  assert(graph.common.highlight.includes(`@lezer+common@${split ? oldCommon : sharedCommon}/`), "highlight common identity differs from diagnostic target");
  for (const [consumer, resolved] of Object.entries(graph.common)) {
    if (consumer !== "highlight") assert(resolved.includes(`@lezer+common@${sharedCommon}/`), `${consumer} did not retain shared common ${sharedCommon}`);
  }
}

export async function browserProof(browser, host, split, evidenceFile) {
  const server = await startBuiltHost(path.join(host, "dist"));
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.setDefaultTimeout(20_000);
  const errors = [], failedRequests = [];
  const observed = { expectedSplit: split, status: "running", syntax: null, errors, failedRequests,
    liveCssApplied: false, liveCssCleared: false, hostIsolated: false };
  page.on("pageerror", error => errors.push({ type: "pageerror", text: error.message }));
  page.on("console", message => { if (message.type() === "error") errors.push({ type: "console", text: message.text() }); });
  page.on("response", response => { if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`); });
  page.on("requestfailed", request => failedRequests.push(`${request.failure()?.errorText} ${request.url()}`));
  try {
    await page.goto(`${server.origin}${BASE}components/button`, { waitUntil: "domcontentloaded" });
    const panel = page.locator("#sg-code-panel");
    const source = panel.locator('[data-sg-code-region="source"] .cm-content').first();
    const css = panel.getByRole("textbox", { name: /^Live CSS for / });
    await source.waitFor();
    await css.waitFor();
    assert((await source.textContent()).includes("Button"), "packed TSX source was not displayed");
    const iframe = page.locator('iframe[src*="/components/preview"]').first();
    await iframe.scrollIntoViewIfNeeded();
    await iframe.waitFor();
    const frame = await (await iframe.elementHandle()).contentFrame();
    assert(frame, "packed preview frame is missing");
    await frame.locator("[data-ui-button]").waitFor({ state: "visible" });
    const before = await frame.locator("body").evaluate(body => getComputedStyle(body).outlineWidth);
    const hostBefore = await page.locator("body").evaluate(body => getComputedStyle(body).outlineWidth);
    // Keyboard editing exercises CodeMirror's input path even when its syntax
    // plugin has failed; construction/edit success alone was the #963 gap.
    await css.click();
    await css.press("ControlOrMeta+a");
    await page.keyboard.insertText("body { outline: 3px solid rgb(1, 2, 3); }");
    await frame.waitForFunction(() => getComputedStyle(document.body).outlineWidth === "3px");
    observed.liveCssApplied = true;
    if (!split) {
      await source.locator(".cm-line span[class]").first().waitFor({ state: "attached" });
      await css.locator(".cm-line span[class]").first().waitFor({ state: "attached" });
    }
    const syntax = {
      source: await source.locator(".cm-line span[class]").allTextContents(),
      css: await css.locator(".cm-line span[class]").allTextContents(),
    };
    observed.syntax = syntax;
    if (split) {
      assert(syntax.source.length === 0 && syntax.css.length === 0, `seeded split unexpectedly highlights: ${JSON.stringify(syntax)}`);
      assert(errors.filter(isExpectedHighlightFailure).length >= 2,
        `seeded split did not reproduce both syntax plugin failures; observed errors: ${JSON.stringify(errors)}`);
      assert(errors.every(isExpectedHighlightFailure), `unexpected negative-control browser errors: ${JSON.stringify(errors)}`);
    } else {
      assert(syntax.source.join("").includes("Button"), "packed TSX syntax tokens are absent");
      assert(syntax.css.join("").includes("outline"), "edited CSS syntax tokens are absent");
      assert(errors.length === 0, `browser errors: ${JSON.stringify(errors)}`);
    }
    assert(await page.locator("body").evaluate(body => getComputedStyle(body).outlineWidth) === hostBefore, "Live CSS leaked into host chrome");
    observed.hostIsolated = true;
    await css.press("ControlOrMeta+a");
    await css.press("Backspace");
    await frame.waitForFunction(previous => getComputedStyle(document.body).outlineWidth === previous, before);
    observed.liveCssCleared = true;
    assert(await page.locator("body").evaluate(body => getComputedStyle(body).outlineWidth) === hostBefore, "clearing CSS changed host chrome");
    assert(failedRequests.length === 0, `failed browser requests: ${JSON.stringify(failedRequests)}`);
    assert(split ? errors.every(isExpectedHighlightFailure) : errors.length === 0,
      `unexpected browser errors after clearing CSS: ${JSON.stringify(errors)}`);
    observed.status = "passed";
    return observed;
  } catch (error) {
    observed.status = "failed";
    observed.failure = String(error);
    throw error;
  } finally {
    if (evidenceFile) await writeFile(evidenceFile, `${JSON.stringify(observed, null, 2)}\n`);
    await page.close();
    await server.close();
  }
}

async function main() {
  const keep = process.argv.includes("--keep");
  assert(process.argv.slice(2).every(arg => arg === "--keep"), "usage: node scripts/verify-retained-lezer-lock.mjs [--keep]");
  const scratch = await mkdtemp(path.join(os.tmpdir(), "zudo-sg-retained-lezer-"));
  const host = path.join(scratch, "host");
  const evidence = path.join(scratch, "evidence");
  await mkdir(evidence, { recursive: true });
  const report = { purpose: "retained-lock diagnostic, not a universal fix", scratch, runtime: { node: process.version }, stages: [] };
  let browser;
  const save = async (name, value) => await writeFile(path.join(evidence, name), typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
  const stage = async (name, action) => {
    const entry = { name, status: "running" };
    report.stages.push(entry);
    await save("report.json", report);
    console.log(`[retained lock] ${name}`);
    try { await action(); entry.status = "passed"; }
    catch (error) { entry.status = "failed"; entry.error = String(error); throw error; }
    finally { await save("report.json", report); }
  };
  const pnpm = async (args, name, expectedFailure = false) => {
    const result = await new Promise((resolve, reject) => {
      const child = spawn("corepack", ["pnpm", ...args], { cwd: host, env: process.env });
      let stdout = "", stderr = "";
      child.stdout.on("data", chunk => { stdout += chunk; process.stdout.write(chunk); });
      child.stderr.on("data", chunk => { stderr += chunk; process.stderr.write(chunk); });
      child.on("error", reject);
      child.on("close", (code, signal) => resolve({ args, code, signal, stdout, stderr }));
    });
    await save(`${name}.json`, result);
    assert(result.signal === null && result.code === (expectedFailure ? 1 : 0), `${args.join(" ")} returned ${result.signal ?? result.code}, expected ${expectedFailure ? 1 : 0}`);
    return result;
  };
  const build = async name => {
    for (const directory of ["dist", ".zfb-build"]) await rm(path.join(host, directory), { recursive: true, force: true });
    await pnpm(["exec", "zfb", "build"], `${name}-build`);
  };
  const graph = async (name, split) => {
    const value = await resolutionGraph(host);
    await save(`${name}-graph.json`, value);
    assertGraph(value, split);
  };
  const lock = () => readFile(path.join(host, "pnpm-lock.yaml"), "utf8");
  try {
    await stage("pack and install clean foreign control", async () => {
      const tarball = await packEngine(path.join(scratch, "packed"));
      report.package = await assertTarballShape(tarball);
      await copyFixtureDir(path.join(root, "fixtures/engine-host"), host);
      await mkdir(path.join(host, ".tarball"), { recursive: true });
      await cp(tarball, path.join(host, ".tarball/zudo-sg-engine.tgz"));
      report.runtime.pnpm = (await runCapture("corepack", ["pnpm", "--version"], host)).trim();
      assert(report.runtime.pnpm === "11.5.2", "diagnostic requires pnpm 11.5.2");
      await pnpm(["install", "--no-frozen-lockfile"], "control-install");
      await assertForeignPackage(host);
      await graph("control", false);
      await save("control-lock.yaml", await lock());
      browser = await launchChromium(chromium);
      report.runtime.browser = browser.version();
      await build("control");
      await browserProof(browser, host, false, path.join(evidence, "control-browser.json"));
    });
    let seeded;
    await stage("seed valid retained common split", async () => {
      const integrity = JSON.parse(await runCapture("corepack", ["pnpm", "view", `@lezer/common@${oldCommon}`, "dist.integrity", "--json"], host));
      seeded = seedRetainedLock(await lock(), integrity);
      await writeFile(path.join(host, "pnpm-lock.yaml"), seeded);
      await save("seeded-lock.yaml", seeded);
      report.seededLockSha256 = hash(seeded);
      await rm(path.join(host, "node_modules"), { recursive: true, force: true });
    });
    for (const [name, args] of [["frozen", ["install", "--frozen-lockfile"]], ["normal", ["install", "--no-frozen-lockfile"]]]) {
      await stage(`${name} install preserves retained split`, async () => {
        await pnpm(args, `${name}-install`);
        const installedLock = await lock();
        await save(`${name}-lock.yaml`, installedLock);
        assert(hash(installedLock) === hash(seeded), `${name} install changed the seeded valid lock`);
        await assertForeignPackage(host);
        await graph(name, true);
      });
    }
    await stage("packed browser reproduces retained-lock failure", async () => {
      await build("retained");
      await browserProof(browser, host, true, path.join(evidence, "retained-browser.json"));
    });
    await stage("dedupe check diagnoses without changing the lock", async () => {
      const result = await pnpm(["dedupe", "--check"], "dedupe-check-before", true);
      assert(/@lezer\/common/u.test(result.stdout + result.stderr), "dedupe diagnostic did not identify common");
      assert(hash(await lock()) === hash(seeded), "dedupe --check mutated retained lock");
      await graph("dedupe-check", true);
    });
    await stage("consumer deduplication recovers shared identity", async () => {
      await pnpm(["dedupe", "--ignore-scripts"], "dedupe-recovery");
      await save("recovered-lock.yaml", await lock());
      await graph("recovered", false);
      await pnpm(["install", "--frozen-lockfile"], "recovered-frozen-install");
      await graph("recovered-frozen", false);
      await pnpm(["dedupe", "--check"], "dedupe-check-after");
      await build("recovered");
      await browserProof(browser, host, false, path.join(evidence, "recovered-browser.json"));
    });
    console.log("PASS: packed clean control, retained-lock failure diagnostic, and consumer dedupe recovery; #963 remains a shared-identity compatibility obligation.");
  } finally {
    await browser?.close();
    await save("report.json", report);
    if (keep) console.log(`Retained diagnostic evidence: ${evidence}`);
    else await rm(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error instanceof Error ? error.stack : String(error)); process.exitCode = 1; });
}
