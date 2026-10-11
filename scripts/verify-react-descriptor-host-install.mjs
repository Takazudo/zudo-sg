// Real, foreign, packed React consumer. No engine source aliases or workspace dependencies.
import { cp, mkdir, mkdtemp, readFile, writeFile, realpath, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { assert, assertForeignPackage, assertTarballShape, copyFixtureDir, packEngine, run } from "./verify-styleguide-install.mjs";
import { launchChromium, startBuiltHost } from "./verify-styleguide-install-browser.mjs";
import { assertReactDescriptorHostContracts } from "./verify-react-descriptor-host-contracts.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const keep = process.argv.includes("--keep");
const existing = process.argv.indexOf("--host");
const host = existing >= 0 ? path.resolve(process.argv[existing + 1]) : await mkdtemp(path.join(os.tmpdir(), "react-descriptor-host-"));
const pnpm = args => run("corepack", ["pnpm", ...args], host);
const json = async name => JSON.parse(await readFile(path.join(host, name), "utf8"));
async function audit() {
  const result = await new Promise((resolve, reject) => {
    const child = spawn("corepack", ["pnpm", "audit", "--json"], { cwd: host, env: process.env });
    let stdout = "", stderr = "";
    child.stdout.on("data", chunk => stdout += chunk); child.stderr.on("data", chunk => stderr += chunk);
    child.on("error", reject); child.on("close", code => resolve({ code, stdout, stderr }));
  });
  await writeFile(path.join(host, "artifacts/audit-full.json"), result.stdout);
  const report = JSON.parse(result.stdout);
  assert(report.metadata?.vulnerabilities, `Audit unavailable: ${result.stderr}`);
  const levels = report.metadata.vulnerabilities;
  assert(!levels.critical && !levels.high && !levels.moderate, `Unexpected audit finding: ${JSON.stringify(levels)}`);
  const allowedLow = new Set(["GHSA-238p-pmpm-9mq7", "GHSA-g7r4-m6w7-qqqr"]);
  for (const advisory of Object.values(report.advisories ?? {})) {
    assert(advisory.severity === "low" && allowedLow.has(advisory.github_advisory_id), `Unreviewed advisory: ${advisory.github_advisory_id}`);
  }
  await pnpm(["audit", "--prod", "--audit-level", "high"]);
  console.log("Foreign installed audit:", levels);
}
async function waitReady(frame) {
  for (let attempt = 0; attempt < 10; attempt++) {
    await frame.waitForFunction(() => window.fixture?.runtime.getSnapshot().ready && (window.parent === window || !window.fixture.runtime.getSnapshot().identity.sessionId.startsWith("standalone-")));
    try {
      return await frame.evaluate(() => Promise.race([window.fixture.runtime.whenStable(), new Promise((_, reject) => setTimeout(() => reject(new Error("Fixture stability timed out")), 15000))]));
    } catch (error) {
      if (!String(error).includes("External fixture changed while waiting for stability")) throw error;
    }
  }
  throw new Error("Fixture did not reach a stable current revision");
}

async function browserProof(browser, base) {
  const server = await startBuiltHost(path.join(host, "dist"), base);
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(20_000);
  const errors = [], responses = [], workers = [], closedWorkers = [];
  const expectedFailures = new Set();
  page.on("pageerror", error => errors.push({ text: error.message, url: "" }));
  page.on("console", message => { if (message.type() === "error") errors.push({ text: message.text(), url: message.location().url, expected: expectedFailures.has(message.location().url) }); });
  page.on("response", response => {
    let mainFrame = false;
    try { mainFrame = response.request().frame() === page.mainFrame(); } catch { /* Worker requests have no frame. */ }
    responses.push({ url: response.url(), status: response.status(), expected: expectedFailures.has(response.url()), mainFrame, type: response.request().resourceType() });
  });
  page.on("requestfailed", request => errors.push({ text: `request failed ${request.failure()?.errorText}`, url: request.url(), expected: expectedFailures.has(request.url()) }));
  page.on("worker", worker => { workers.push(worker.url()); worker.on("close", () => closedWorkers.push(worker.url())); });
  try {
    await page.goto(`${server.origin}${base}components/react-laboratory`);
    const iframe = page.locator('iframe[title="react-laboratory — Default"]');
    await iframe.waitFor();
    let frame = await (await iframe.elementHandle()).contentFrame();
    await waitReady(frame);
    const clean = await frame.evaluate(() => window.fixture.sanitize('<b>safe</b><img src="x" onerror="evil()"><a href="javascript:evil()">bad</a>'));
    assert(clean.includes('<b>safe</b>') && !/onerror|javascript:/.test(clean), "Actual patched Monaco sanitizer failed");
    const sourcePanel = page.locator('[data-sg-code-region="source"] .cm-content').first();
    await sourcePanel.waitFor();
    assert((await sourcePanel.textContent()).includes("export function Laboratory"), "Actual descriptor source panel missing canonical source");
    const first = await frame.evaluate(() => ({ ...window.fixture.resources }));
    assert(first.workers === 1 && first.mounts === 1, "Initial real worker/root missing");
    await frame.locator("[data-counter]").click();
    await frame.locator("[data-open-portal]").click();
    assert(await frame.locator("[data-close-portal]").evaluate(node => document.activeElement === node), "Portal did not focus React ref");
    const section = iframe.locator("xpath=ancestor::section[1]");
    const controlsToggle = section.getByRole("button", { name: "Controls", exact: true });
    if (await controlsToggle.getAttribute("aria-expanded") === "false") await controlsToggle.click();
    const label = section.getByLabel("Label", { exact: true });
    await label.evaluate(node => { node.value = "Updated label"; node.dispatchEvent(new Event("input", { bubbles: true })); });
    await frame.locator("[data-fixture-label]").filter({ hasText: "Updated label" }).waitFor();
    assert(await frame.locator("[data-close-portal]").evaluate(node => document.activeElement === node), "Prop update stole portal focus");
    await frame.locator("[data-close-portal]").click();
    assert(await frame.locator("[data-open-portal]").evaluate(node => document.activeElement === node), "Portal close did not return focus");
    const invalid = await frame.evaluate(() => window.fixture.editor.setValue('{"broken": }'));
    assert(invalid > 0, "Real JSON worker did not validate invalid model");
    await frame.evaluate(() => window.fixture.editor.select());
    const beforeSelection = await frame.evaluate(() => window.fixture.editor.selection);
    await label.evaluate(node => { node.value = "Preserved editor"; node.dispatchEvent(new Event("input", { bubbles: true })); });
    await frame.locator("[data-fixture-label]").filter({ hasText: "Preserved editor" }).waitFor();
    assert(await frame.evaluate(() => window.fixture.editor.focused), "Prop edit stole editor focus");
    assert(JSON.stringify(beforeSelection) === JSON.stringify(await frame.evaluate(() => window.fixture.editor.selection)), "Prop edit changed selection");
    await section.getByRole("button", { name: "Reset", exact: true }).evaluate(node => node.click());
    await frame.locator("[data-fixture-label]").filter({ hasText: "React laboratory" }).waitFor();
    assert(await frame.locator("[data-counter]").textContent() === "Count: 1", "Ordinary reset lost hook state");
    assert(await frame.evaluate(() => window.fixture.editor.value) === '{"broken": }', "Ordinary reset lost editor document");
    assert(await frame.evaluate(() => window.fixture.resources.mounts) === 1, "Ordinary reset remounted React");
    assert(await frame.evaluate(() => window.fixture.editor.focused), "Ordinary reset stole editor focus");
    assert(JSON.stringify(beforeSelection) === JSON.stringify(await frame.evaluate(() => window.fixture.editor.selection)), "Ordinary reset changed selection");
    await label.fill("Retained after full reset");
    await page.getByRole("group", { name: "Preview theme", exact: true }).getByRole("button", { name: "Dark", exact: true }).click();
    const liveCss = page.locator('[data-sg-code-region="live-css"] .cm-content');
    await liveCss.fill('h1 { border-top: 7px solid rgb(101, 23, 42); }');
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('h1')).borderTopWidth === '7px');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("toggle-preview-token-panel")));
    const panel = page.locator(".tokenpanel-shell").first();
    await panel.waitFor({ state: "visible" });
    await panel.getByRole("tab", { name: /^Size/ }).click();
    await panel.getByLabel("--radius-md value").fill("2");
    await panel.getByLabel("--radius-md value").dispatchEvent("input");
    await frame.waitForFunction(() => document.documentElement.style.getPropertyValue('--radius-md') !== '');
    const retainedToken = await frame.evaluate(() => document.documentElement.style.getPropertyValue('--radius-md'));
    assert(await page.evaluate(() => document.documentElement.style.getPropertyValue('--radius-md')) === "", "Preview token escaped into host chrome");
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("toggle-preview-token-panel")));
    assert(await page.locator('h1').first().evaluate(node => getComputedStyle(node).borderTopWidth) !== '7px', "Preview CSS escaped into host chrome");
    const identity = await frame.evaluate(() => window.fixture.runtime.getSnapshot().identity);
    await section.getByRole("button", { name: "Reset fixture react-laboratory", exact: true }).click();
    await frame.waitForFunction(generation => window.fixture.runtime.getSnapshot().ready && window.fixture.runtime.getSnapshot().identity.generation > generation, identity.generation);
    await waitReady(frame);
    assert(await frame.locator("[data-counter]").textContent() === "Count: 0", "Full reset did not reset hooks");
    assert(await frame.evaluate(() => window.fixture.editor.value) === '{"hello": true}', "Full reset did not recreate initial editor document");
    assert(await frame.locator("[data-fixture-label]").textContent() === "Retained after full reset", "Full reset lost host props");
    assert(await frame.evaluate(() => document.documentElement.dataset.theme) === "dark", "Full reset lost preview theme");
    assert(await frame.evaluate(() => document.documentElement.style.getPropertyValue('--radius-md')) === retainedToken, "Full reset lost token replay");
    assert(await frame.locator('h1').evaluate(node => getComputedStyle(node).borderTopWidth) === '7px', "Full reset lost live CSS replay");
    assert(closedWorkers.length >= 1, "Full reset did not terminate native worker");
    const after = await frame.evaluate(() => ({ ...window.fixture.resources }));
    assert(after.mounts === 2 && after.disposals === 1 && after.workers === 1 && after.listeners === 1 && after.observers === 1 && after.portals === 1, `Full reset resource leak: ${JSON.stringify(after)}`);
    assert(await frame.evaluate(() => window.fixture.editor.setValue('{"again": }')) > 0, "Replacement worker unusable after reset");
    assert(await frame.evaluate(() => window.fixture.editor.setValue('{"again": true}')) === 0, "Replacement worker did not validate corrected JSON");
    // Duplicate readiness and forged messages must neither remount nor override current state.
    await page.evaluate(identity => {
      const target = document.querySelector('iframe').contentWindow;
      const challenge = { type: "sg:requestReady", v: 1, runtimeVersion: 1, slug: identity.slug, variant: identity.variant, sessionId: identity.sessionId };
      target.postMessage(challenge, location.origin); target.postMessage(challenge, location.origin);
      target.postMessage({ ...identity, v: 1, runtimeVersion: 1, type: "sg:updateProps", sequence: 99999, documentId: "stale-document", props: { label: "FORGED" } }, location.origin);
    }, await frame.evaluate(() => window.fixture.runtime.getSnapshot().identity));
    await frame.evaluate(identity => window.postMessage({ ...identity, v: 1, runtimeVersion: 1, type: "sg:updateProps", sequence: 99999, props: { label: "FORGED SELF" } }, location.origin), await frame.evaluate(() => window.fixture.runtime.getSnapshot().identity));
    await waitReady(frame);
    assert(await frame.locator('[data-fixture-label]').textContent() === 'Retained after full reset', "Stale identity or wrong source applied props");
    assert(await frame.evaluate(() => window.fixture.resources.mounts) === 2, "Repeated ready remounted root");
    assert(await frame.locator('style[id^="sg-injected-"]').count() === 1, "Repeated ready duplicated injected styles");
    // Real React error boundary routes render failures to visible runtime errors.
    await section.getByLabel(/^Failure/).selectOption("render");
    await section.getByRole("alert").filter({ hasText: "Deliberate React render failure" }).waitFor();
    await section.getByLabel(/^Failure/).selectOption("none");
    await waitReady(frame);
    await frame.locator("[data-counter]").click();
    assert(await frame.locator("[data-counter]").textContent() === "Count: 1", "Error recovery did not mount working React");
    // A missing native worker asset reports a public asset error and recovers with a new usable worker.
    const workerUrl = `${server.origin}${base}preview-assets/json.worker.js`;
    expectedFailures.add(workerUrl);
    await page.route(workerUrl, route => route.fulfill({ status: 404, contentType: 'text/javascript', body: '' }), { times: 1 });
    await section.getByRole('button', { name: 'Reset fixture react-laboratory', exact: true }).click();
    await section.getByRole('alert').filter({ hasText: 'JSON worker asset failed to load' }).waitFor();
    // Use a distinct value so VariantFrame cannot deduplicate this update.
    await label.fill('Edited while worker is unavailable');
    await frame.locator('[data-fixture-label]').filter({ hasText: /^Edited while worker is unavailable$/ }).waitFor();
    await section.getByRole('alert').filter({ hasText: 'JSON worker asset failed to load' }).waitFor();
    const brokenWorker = await frame.evaluate(() => window.fixture.runtime.getSnapshot());
    assert(!brokenWorker.ready && brokenWorker.error?.code === 'asset', 'Consumed prop update hid broken worker');
    await label.fill('Retained after full reset');
    await frame.locator('[data-fixture-label]').filter({ hasText: /^Retained after full reset$/ }).waitFor();
    await section.getByRole('button', { name: 'Reset fixture react-laboratory', exact: true }).click();
    await waitReady(frame);
    assert(await frame.evaluate(() => window.fixture.editor.setValue('{"assetRecovered": }')) > 0, 'Worker asset recovery did not execute actual JSON validation');
    expectedFailures.delete(workerUrl);
    // A real failed dynamic import is visible and correcting props retries the initial mount.
    const missingImport = `${server.origin}${base}preview-assets/deliberately-missing.js`;
    expectedFailures.add(missingImport);
    await section.getByLabel(/^Failure/).selectOption("import");
    await section.getByRole("button", { name: "Reset fixture react-laboratory", exact: true }).click();
    await section.getByRole("alert").filter({ hasText: "Deliberate fixture import failure" }).waitFor();
    await section.getByLabel(/^Failure/).selectOption("none");
    await waitReady(frame);
    assert(await frame.evaluate(() => window.fixture.editor.setValue('{"recovered": }')) > 0, "Import recovery has no functioning worker");
    assert((await frame.evaluate(() => window.fixture.runtime.getSnapshot())).error === null, "Stale import error overwrote recovered fixture");
    expectedFailures.delete(missingImport);
    // Two resets during async mount cancel the older attempt; only the final root may commit.
    const beforeRapid = await frame.evaluate(() => ({ identity: window.fixture.runtime.getSnapshot().identity, mounts: window.fixture.resources.mounts }));
    await section.getByRole('button', { name: 'Reset fixture react-laboratory', exact: true }).evaluate(node => { node.click(); node.click(); });
    await frame.waitForFunction(generation => window.fixture.runtime.getSnapshot().identity.generation === generation + 2 && window.fixture.runtime.getSnapshot().ready, beforeRapid.identity.generation);
    await waitReady(frame);
    await frame.evaluate(() => new Promise(resolve => setTimeout(resolve, 250)));
    assert(await frame.evaluate(() => window.fixture.resources.mounts) === beforeRapid.mounts + 1, 'Cancelled async mount committed a late root');
    assert(await frame.evaluate(() => window.fixture.editor.setValue('{"afterRapidReset": true}')) === 0, 'Latest rapid reset has no real worker');
    // Public dispose promise must clear real resources, not merely mark a snapshot.
    await frame.evaluate(() => window.fixture.runtime.dispose());
    const disposed = await frame.evaluate(() => ({ ...window.fixture.resources }));
    await frame.evaluate(async () => { window.dispatchEvent(new Event('resize')); await new Promise(resolve => setTimeout(resolve, 150)); });
    assert(await frame.evaluate(() => window.fixture.resources.resizeCalls) === disposed.resizeCalls, 'Disposed resize listener/observer still ran');
    assert(await frame.locator('.monaco-editor, [data-fixture-portal]').count() === 0, 'Disposed editor or portal DOM remains');
    assert(closedWorkers.length >= disposed.disposals, 'Disposed native worker remains alive');
    assert(disposed.workers === 0 && disposed.listeners === 0 && disposed.observers === 0 && disposed.portals === 0 && disposed.mounts === disposed.disposals, `Disposal leak: ${JSON.stringify(disposed)}`);
    await iframe.evaluate(node => { node.src = node.src; });
    frame = await (await iframe.elementHandle()).contentFrame();
    await waitReady(frame);
    assert(await frame.locator('[data-fixture-label]').textContent() === 'Retained after full reset', "Reload lost props replay");
    assert(await frame.evaluate(() => document.documentElement.style.getPropertyValue('--radius-md')) === retainedToken, "Reload lost tokens");
    assert(await frame.locator('h1').evaluate(node => getComputedStyle(node).borderTopWidth) === '7px', "Reload lost live CSS");
    // Edit while the next document's mount is pending: the latest complete snapshot wins.
    await iframe.evaluate(node => { const url = new URL(node.src); url.searchParams.set('delay', '5000'); node.src = url.href; });
    frame = await (await iframe.elementHandle()).contentFrame();
    await frame.waitForFunction(() => window.fixture && !window.fixture.runtime.getSnapshot().ready);
    await label.fill('Queued before ready');
    await page.getByRole('group', { name: 'Preview theme', exact: true }).getByRole('button', { name: 'Light', exact: true }).click();
    await liveCss.fill('h1 { border-top: 9px solid rgb(101, 23, 42); }');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('toggle-preview-token-panel')));
    await panel.waitFor({ state: 'visible' });
    await panel.getByRole('tab', { name: /^Size/ }).click();
    assert(!(await frame.evaluate(() => window.fixture.runtime.getSnapshot().ready)), 'Pre-ready test did not edit tokens before mount');
    await panel.getByLabel('--radius-md value').fill('3');
    await panel.getByLabel('--radius-md value').dispatchEvent('input');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('toggle-preview-token-panel')));
    await waitReady(frame);
    assert(await frame.evaluate(() => document.documentElement.style.getPropertyValue('--radius-md')) !== retainedToken, 'Pre-ready token update was replaced by an older snapshot');
    await frame.locator('[data-fixture-label]').filter({ hasText: 'Queued before ready' }).waitFor();
    assert(await frame.evaluate(() => document.documentElement.dataset.theme) === 'light', "Pre-ready theme snapshot lost");
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('h1')).borderTopWidth === '9px');
    assert((await frame.evaluate(() => window.fixture.runtime.getSnapshot().identity.documentId)) !== identity.documentId, "Reload reused document identity");
    // Clear through the actual preview panel reset; both current and later documents lose the override.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('toggle-preview-token-panel')));
    await panel.waitFor({ state: 'visible' });
    const directReset = panel.locator('.tokenpanel-header > .tokenpanel-action-link').filter({ hasText: /^Reset$/ });
    if (await directReset.isVisible()) await directReset.click();
    else { await panel.locator('.tokenpanel-actions-menu-btn').click(); await panel.locator('.tokenpanel-actions-popover .tokenpanel-action-link').filter({ hasText: /^Reset$/ }).click(); }
    await frame.waitForFunction(() => document.documentElement.style.getPropertyValue('--radius-md') === '');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('toggle-preview-token-panel')));
    await liveCss.fill('');
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('h1')).borderTopWidth !== '9px');
    assert(await frame.locator('style[id^="sg-injected-"]').count() === 0, 'Clear left an owned injected style');
    // Existing all-variants catalog renders Alternate as an independent actual document.
    const alternate = page.locator('iframe[title="react-laboratory — Alternate"]');
    await alternate.scrollIntoViewIfNeeded();
    const alternateFrame = await (await alternate.elementHandle()).contentFrame();
    await waitReady(alternateFrame);
    assert(await alternateFrame.locator('[data-variant]').textContent() === 'Alternate', 'Wrong variant loaded');
    assert((await alternateFrame.evaluate(() => window.fixture.runtime.getSnapshot().identity.documentId)) !== (await frame.evaluate(() => window.fixture.runtime.getSnapshot().identity.documentId)), 'Variants shared document identity');
    assert(await alternateFrame.evaluate(() => document.documentElement.style.getPropertyValue('--radius-md')) === '', 'Cleared token replayed on variant navigation');
    const unknownPage = await browser.newPage();
    unknownPage.setDefaultTimeout(20000);
    unknownPage.on('pageerror', error => errors.push({ text: error.message, url: '' }));
    unknownPage.on('console', message => { if (message.type() === 'error') errors.push({ text: message.text(), url: message.location().url }); });
    unknownPage.on('requestfailed', request => errors.push({ text: `request failed ${request.failure()?.errorText}`, url: request.url() }));
    try {
      // Hold the actual generated dynamic fixture chunk, dispose its pending mount, then release it.
      let releaseImport;
      let sawImport;
      const importGate = new Promise(resolve => { releaseImport = resolve; });
      const importStarted = new Promise(resolve => { sawImport = resolve; });
      const fixtureChunk = /\/Laboratory-[^/]+\.js$/;
      await unknownPage.route(fixtureChunk, async route => { sawImport(); await importGate; await route.continue(); }, { times: 1 });
      await unknownPage.goto(`${server.origin}${base}frame/?slug=react-laboratory&variant=Default`);
      await Promise.race([importStarted, new Promise((_, reject) => setTimeout(() => reject(new Error('Dynamic fixture chunk was not requested')), 10000))]);
      await unknownPage.evaluate(() => window.fixture.runtime.dispose());
      releaseImport();
      await unknownPage.waitForFunction(() => window.fixture.resources.importsResolved === 1);
      assert(await unknownPage.evaluate(() => window.fixture.resources.mounts) === 0, 'Disposed outstanding import mounted a late React root');
      assert(await unknownPage.locator('[data-react-fixture], .monaco-editor').count() === 0, 'Late import left fixture DOM');
      await unknownPage.goto(`${server.origin}${base}frame/?slug=missing-fixture&variant=Default`);
      await unknownPage.getByRole('alert').filter({ hasText: 'Unknown fixture' }).waitFor();
      await unknownPage.goto(`${server.origin}${base}frame/?slug=react-laboratory&variant=Alternate`);
      await waitReady(unknownPage);
      assert(await unknownPage.locator('[data-variant]').textContent() === 'Alternate', 'Unknown fixture navigation did not recover');
    } finally { await unknownPage.close(); }
    await page.goto(`${server.origin}${base}components`);
    const image = page.locator('img[src$="/captures/Default.png"]');
    await image.waitFor();
    assert(await image.evaluate(node => node.complete && node.naturalWidth === 640), "Actual captured catalog thumbnail missing");
    assert(workers.filter(url => url === `${server.origin}${base}preview-assets/json.worker.js`).length >= 3, `Real same-origin workers absent: ${workers}`);
    const assets = responses.filter(response => /(?:json\.worker\.js|\.ttf|captures\/Default\.png)$/.test(response.url));
    for (const suffix of ["json.worker.js", ".ttf", "captures/Default.png"]) assert(assets.some(item => item.url.endsWith(suffix) && item.status === 200 && item.url.startsWith(`${server.origin}${base}`)), `Missing same-origin asset ${suffix}`);
    assert(responses.every(item => item.url.startsWith(`${server.origin}/`)), "Preview or host fetched an external asset");
    assert(!responses.some(item => item.mainFrame && item.type === 'script' && item.url.includes('/preview-assets/')), "Host document loaded the external React graph");
    assert(!responses.some(item => item.status >= 400 && !item.expected), `Unexpected failed response: ${JSON.stringify(responses.filter(item => item.status >= 400))}`);
    const unexpected = errors.filter(error => !(error.expected && /Failed to load resource|request failed/.test(error.text)));
    assert(unexpected.length === 0, `Browser errors: ${JSON.stringify(unexpected)}`);
    await writeFile(path.join(host, `artifacts/browser-${base === "/" ? "root" : "nonroot"}.json`), JSON.stringify({ assets, workers, closedWorkers, first, after, disposed }, null, 2));
    console.log(`React lifecycle, real worker, captures and assets passed at ${base}`);
  } catch (error) { await page.screenshot({ path: path.join(host, "artifacts/browser-failure.png") }).catch(() => {}); console.error("Browser diagnostics", JSON.stringify({ errors, responses: responses.filter(row => row.status >= 400), workers })); throw error; } finally { await page.close(); await server.close(); }
}
let browser;
try {
  console.log(`Foreign React fixture: ${host}`);
  if (process.argv.includes("--browser-only")) {
    assert(existing >= 0, "--browser-only requires an existing --host");
    const base = (await readFile(path.join(host, "zfb.config.ts"), "utf8")).match(/base: "([^"]+)"/)[1];
    browser = await launchChromium(chromium);
    await assertReactDescriptorHostContracts({ hostDir: host, base, captures: await json("artifacts/captures.json") });
    await browserProof(browser, base);
  } else {
  if (existing < 0) {
    await copyFixtureDir(path.join(root, "fixtures/react-descriptor-host"), host);
    const tarball = await packEngine(path.join(host, ".packed"));
    await assertTarballShape(tarball);
    await mkdir(path.join(host, ".tarball"), { recursive: true });
    await cp(tarball, path.join(host, ".tarball/zudo-sg-engine.tgz"));
    await pnpm(["install", "--no-frozen-lockfile"]);
  }
  await assertForeignPackage(host);
  await mkdir(path.join(host, "artifacts"), { recursive: true });
  const require = createRequire(path.join(host, "package.json"));
  const versions = {};
  const fixturePackage = await json("package.json");
  const declared = { ...fixturePackage.dependencies, ...fixturePackage.devDependencies };
  for (const name of Object.keys(declared)) {
    const filename = path.join(host, "node_modules", name, "package.json");
    assert((await realpath(filename)).startsWith(`${host}/node_modules/`), `${name} escaped foreign node_modules`);
    versions[name] = JSON.parse(await readFile(filename, "utf8")).version;
    assert(declared[name].startsWith("file:") || versions[name] === declared[name], `${name} differs from the exact fixture pin`);
  }
  await writeFile(path.join(host, "artifacts/versions.json"), JSON.stringify(versions, null, 2));
  console.log("Foreign versions:", versions);
  await audit();
  await pnpm(["run", "preview:build"]);
  await pnpm(["exec", "zudo-sg", "gen-token-manifest"]);
  await pnpm(["run", "check"]);
  const helper = await import(pathToFileURL(require.resolve("@takazudo/zudo-sg/registry/external-catalog-node")));
  const outputs = await json("artifacts/catalog.json");
  browser = await launchChromium(chromium);
  const captureServer = await startBuiltHost(path.join(host, "public"), "/styleguide/");
  const capturePage = await browser.newPage();
  capturePage.setDefaultTimeout(20_000);
  const captureErrors = [];
  capturePage.on('pageerror', error => captureErrors.push(error.message));
  capturePage.on('console', message => { if (message.type() === 'error') captureErrors.push(message.text()); });
  capturePage.on('requestfailed', request => captureErrors.push(`Capture request failed: ${request.url()}: ${request.failure()?.errorText}`));
  capturePage.on('response', response => { if (response.status() >= 400) captureErrors.push(`Capture HTTP ${response.status()}: ${response.url()}`); });
  let captures;
  try {
    captures = await helper.captureExternalCatalogImages({ manifest: outputs.manifest, projectRoot: host, assetRoot: path.join(host, "public"), origin: captureServer.origin, base: "/styleguide/", previewUrl: "/frame/", page: {
      goto: url => capturePage.goto(url), setViewportSize: size => capturePage.setViewportSize(size),
      whenStable: async () => { await capturePage.waitForFunction(() => window.fixture?.runtime.getSnapshot().ready); return capturePage.evaluate(() => window.fixture.runtime.whenStable()); },
      getSnapshot: () => capturePage.evaluate(() => window.fixture.runtime.getSnapshot()), screenshot: options => capturePage.screenshot(options),
    } });
  } finally { await capturePage.close(); await captureServer.close(); }
  assert(captureErrors.length === 0, `Capture browser errors: ${captureErrors.join("; ")}`);
  await writeFile(path.join(host, "artifacts/captures.json"), JSON.stringify(captures, null, 2));
  for (const base of ["/styleguide/", "/"]) {
    const config = path.join(host, "zfb.config.ts");
    const current = await readFile(config, "utf8");
    await writeFile(config, current.replace(/base: "(?:\/styleguide\/|\/)"/, `base: ${JSON.stringify(base)}`));
    await pnpm(["run", "build"]);
    helper.validateExternalCatalogAssets({ manifest: outputs.manifest, projectRoot: host, assetRoot: path.join(host, "dist", base.slice(1)), captures });
    await assertReactDescriptorHostContracts({ hostDir: host, base, captures });
    await browserProof(browser, base);
  }
  }
  console.log("PASS: packed React descriptor host contract");
} finally {
  await browser?.close();
  if (!keep && existing < 0) await rm(host, { recursive: true, force: true });
  else console.log(`Retained evidence: ${host}`);
}
