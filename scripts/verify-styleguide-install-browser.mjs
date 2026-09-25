// Browser proof for the packed public consumer created by
// scripts/verify-styleguide-install.mjs. The host lives outside this
// workspace and has the real engine tarball installed in node_modules.

import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BASE = "/styleguide/";
export const PACKED_HOST_SCENARIOS = {
  default: {
    routes: {},
    previewPath: "/components/preview",
    stories: [
      { slug: "preview-2", title: "Preview", identity: "packed-preview-default" },
      { slug: "preview-2-2", title: "Preview 2", identity: "packed-preview-two-default" },
      { slug: "canvas", title: "Canvas", identity: "packed-canvas-default" },
    ],
  },
  "custom-collision": {
    routes: { componentsPreview: "/components/canvas" },
    previewPath: "/components/canvas",
    stories: [
      { slug: "preview", title: "Preview", identity: "packed-preview-default" },
      { slug: "preview-2", title: "Preview 2", identity: "packed-preview-two-default" },
      { slug: "canvas-2", title: "Canvas", identity: "packed-canvas-default" },
    ],
  },
  "outside-namespace": {
    routes: { componentsPreview: "/preview-frame" },
    previewPath: "/preview-frame",
    stories: [
      { slug: "preview", title: "Preview", identity: "packed-preview-default" },
      { slug: "preview-2", title: "Preview 2", identity: "packed-preview-two-default" },
      { slug: "canvas", title: "Canvas", identity: "packed-canvas-default" },
    ],
  },
};
const SCENARIOS = PACKED_HOST_SCENARIOS;

function fail(message) {
  throw new Error(`[packed host browser proof] ${message}`);
}

function check(condition, message) {
  if (!condition) fail(message);
}

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

async function resolveBuiltFile(distDir, pathname) {
  if (!pathname.startsWith(BASE)) return null;
  const relativePath = decodeURIComponent(pathname.slice(BASE.length));
  const resolvedDist = path.resolve(distDir);
  let target = path.resolve(resolvedDist, relativePath || "index.html");
  if (target !== resolvedDist && !target.startsWith(`${resolvedDist}${path.sep}`)) return null;

  try {
    const entry = await stat(target);
    if (entry.isDirectory()) target = path.join(target, "index.html");
    else if (!path.extname(target)) {
      try {
        const index = path.join(target, "index.html");
        const indexStat = await stat(index);
        if (indexStat.isFile()) target = index;
      } catch {
        // Let the caller return 404 for an unknown extensionless asset.
      }
    }
  } catch {
    if (!path.extname(target)) target = path.join(target, "index.html");
  }

  if (target !== resolvedDist && !target.startsWith(`${resolvedDist}${path.sep}`)) return null;
  try {
    const entry = await stat(target);
    return entry.isFile() ? target : null;
  } catch {
    return null;
  }
}

async function startBuiltHost(distDir) {
  const server = createServer(async (request, response) => {
    let pathname;
    try {
      pathname = new URL(request.url ?? "/", "http://packed-host.invalid").pathname;
    } catch {
      response.writeHead(400).end("bad URL");
      return;
    }
    // Browsers may request an implicit favicon even though the fixture has
    // none. zudo-doc's actual document favicon is an inline SVG data URL.
    if (pathname === "/favicon.ico" || pathname === `${BASE}favicon.ico`) {
      response.writeHead(204).end();
      return;
    }
    const target = await resolveBuiltFile(distDir, pathname);
    if (!target) {
      response.writeHead(404).end(`not found: ${pathname}`);
      return;
    }
    try {
      const body = await readFile(target);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": body.byteLength,
        "Content-Type": MIME_TYPES.get(path.extname(target)) ?? "application/octet-stream",
      });
      response.end(body);
    } catch {
      response.writeHead(500).end("failed to read built asset");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  check(address && typeof address === "object", "static packed-host server has no TCP address");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function findPanelChunks(distDir) {
  const assetsDir = path.join(distDir, "assets");
  const files = (await readdir(assetsDir)).filter((name) => name.endsWith(".js"));
  const panelChunks = [];
  for (const name of files) {
    if ((await readFile(path.join(assetsDir, name), "utf8")).includes("tokenpanel-shell")) {
      panelChunks.push(name);
    }
  }
  check(panelChunks.length > 0, `packed host has no JS chunk containing the real tokenpanel-shell implementation (${files.join(", ")})`);
  return new Set(panelChunks.map((name) => `${BASE}assets/${name}`));
}

async function assertPanelState(page, visible) {
  const panel = page.locator(".tokenpanel-shell");
  if (visible) {
    await panel.first().waitFor({ state: "visible", timeout: 15_000 });
    check(await panel.count() === 1, `expected exactly one preview panel shell, found ${await panel.count()}`);
  } else {
    await panel.first().waitFor({ state: "hidden", timeout: 10_000 });
  }
}

async function panelDiagnostics(page) {
  return page.evaluate(() => {
    const shells = [...document.querySelectorAll(".tokenpanel-shell")];
    const bindings = window.__zudoDesignTokenPanelInstanceBindings;
    const lifecycle = window.__zudoDesignTokenPanelLifecycle;
    return {
      route: location.pathname,
      capture: window.__sgPreviewTokenPanelCapture && {
        ready: window.__sgPreviewTokenPanelCapture.ready,
        pending: window.__sgPreviewTokenPanelCapture.pending,
      },
      clickEvents: window.__packedReadyClickEvents,
      shells: shells.map((shell) => ({
        connected: shell.isConnected,
        visibility: getComputedStyle(shell).visibility,
        display: getComputedStyle(shell).display,
        hidden: shell.hasAttribute("hidden"),
      })),
      previewStorage: Object.fromEntries(Object.keys(localStorage)
        .filter((key) => key.startsWith("sg-preview-tweak"))
        .map((key) => [key, localStorage.getItem(key)])),
      bindingPrefixes: bindings instanceof Map ? [...bindings.keys()] : null,
      lifecycleCleanups: Array.isArray(lifecycle?.cleanups) ? lifecycle.cleanups.length : null,
    };
  });
}

async function afterSwapPromise(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("timed out waiting for zfb:after-swap")), 15_000);
    document.addEventListener("zfb:after-swap", () => {
      window.clearTimeout(timeout);
      resolve();
    }, { once: true });
  }));
}

async function proveEarlyClick(page, origin) {
  const errors = [];
  const badResponses = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(`${origin}${BASE}docs/getting-started`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load");
  const trigger = page.locator("#sg-preview-tokens-trigger");
  await trigger.waitFor({ state: "attached" });
  check(!(await trigger.isVisible()), "the preview trigger should be hidden on the host docs route");
  const persistentHeader = page.locator("header[data-zfb-transition-persist]");
  check(await persistentHeader.count() === 1, "host docs route does not render one persistent header");
  await page.waitForFunction(() => Boolean(window.__sgPreviewTokenPanelCapture), null, { timeout: 15_000 });
  const initialCapture = await page.evaluate(() => window.__sgPreviewTokenPanelCapture ?? null);
  check(initialCapture && initialCapture.ready === false, `host route did not install an unready public trigger capture: ${JSON.stringify(initialCapture)}`);

  // The engine trigger's own after-swap listener was installed by the inline
  // header markup before this probe. zfb reveals the button in that listener,
  // then its route lifecycle resumes island scanning after synchronous event
  // dispatch returns. Clicking here holds that exact lifecycle gap open on the
  // JS stack: no sleep, retry, or timing-dependent network stall is involved.
  await page.evaluate(() => {
    const proof = { visible: false, enabled: false, headerPersisted: false, readyBeforeClick: null, pendingBeforeClick: null, readyAfterClick: null, pendingAfterClick: null };
    (window).__packedPersistentHeader = document.querySelector("header[data-zfb-transition-persist]");
    (window).__packedEarlyClickProof = proof;
    document.addEventListener("zfb:after-swap", () => {
      const button = document.getElementById("sg-preview-tokens-trigger");
      const capture = window.__sgPreviewTokenPanelCapture;
      proof.visible = Boolean(button && !button.hidden);
      proof.enabled = Boolean(button && !button.disabled);
      proof.headerPersisted = Boolean(window.__packedPersistentHeader && window.__packedPersistentHeader.isConnected && window.__packedPersistentHeader === document.querySelector("header[data-zfb-transition-persist]"));
      proof.readyBeforeClick = capture?.ready ?? null;
      proof.pendingBeforeClick = capture?.pending ?? null;
      if (proof.visible && proof.enabled && button) button.click();
      proof.readyAfterClick = capture?.ready ?? null;
      proof.pendingAfterClick = capture?.pending ?? null;
    }, { once: true });
  });

  const swapped = afterSwapPromise(page);
  await page.getByRole("link", { name: "Components", exact: true }).first().click();
  await swapped;
  const proof = await page.evaluate(() => window.__packedEarlyClickProof);
  check(proof?.visible && proof?.enabled, "the after-swap probe did not click a visible, enabled public trigger");
  check(proof.headerPersisted, "the host header was replaced during the SPA transition");
  check(proof.readyBeforeClick === false && proof.readyAfterClick === false, "bootstrap readiness was not delayed through the early click");
  check(proof.pendingBeforeClick === 0 && proof.pendingAfterClick === 1, "the capture did not observe exactly one click before listener readiness");
  await page.waitForFunction(() => window.__sgPreviewTokenPanelCapture?.ready === true, null, { timeout: 15_000 });
  try {
    await assertPanelState(page, true);
  } catch (error) {
    const state = await page.evaluate(() => ({ capture: window.__sgPreviewTokenPanelCapture, proof: window.__packedEarlyClickProof }));
    fail(`early-click panel did not open: ${JSON.stringify(state)}; browser errors: ${errors.join(" | ")}; ${error}`);
  }
  check(await page.locator("#sg-preview-tokens-trigger").count() === 1, "SPA navigation duplicated the public trigger");

  await trigger.click();
  await assertPanelState(page, false);
  console.log("OK — early-click panel closed on second click.");
  await trigger.click();
  await assertPanelState(page, true);
  console.log("OK — early-click panel reopened on third click.");

  const returned = afterSwapPromise(page);
  await page.goBack();
  await returned;
  check(new URL(page.url()).pathname === `${BASE}docs/getting-started`, "browser back did not return to the host docs route");
  check(!(await trigger.isVisible()), "the persistent trigger stayed visible after returning to the host route");

  await page.evaluate(() => localStorage.clear());
  await page.goto(`${origin}${BASE}components`, { waitUntil: "domcontentloaded" });
  await trigger.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => window.__sgPreviewTokenPanelCapture?.ready === true, null, { timeout: 15_000 });
  await assertPanelState(page, false);
  await trigger.click();
  await assertPanelState(page, true);
  console.log("OK — direct engine load opened the panel.");
  check(errors.length === 0, `browser errors during early-click flow: ${errors.join(" | ")}`);
  check(badResponses.length === 0, `failed browser requests during early-click flow: ${badResponses.join(" | ")}`);
}

async function proveReadyHostBootstrap(page, origin, panelChunkPaths) {
  const scriptRequests = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scriptRequests.push(request.url());
  });
  let releaseLoader;
  const loaderGate = new Promise((resolve) => { releaseLoader = resolve; });
  page.once("close", () => releaseLoader());
  let heldLoader = false;
  await page.goto(`${origin}${BASE}docs/getting-started`, { waitUntil: "load" });
  const trigger = page.locator("#sg-preview-tokens-trigger");
  await trigger.waitFor({ state: "attached" });
  check(!(await trigger.isVisible()), "the host route exposed the engine trigger");
  await page.waitForFunction(() => window.__sgPreviewTokenPanelCapture?.ready === true);
  const previewStateKeys = await page.evaluate(() => Object.keys(localStorage)
    .filter((key) => key.startsWith("sg-preview-tweak")));
  check(previewStateKeys.length === 0, `the ready-host proof started with persisted preview state: ${previewStateKeys.join(", ")}`);
  const loadedPanelChunk = await page.evaluate((paths) => performance.getEntriesByType("resource")
    .some((entry) => paths.includes(new URL(entry.name).pathname)), [...panelChunkPaths]);
  check(!loadedPanelChunk, "the panel implementation was eagerly loaded on a fresh host route");
  await page.route("**/*.js", async (route) => {
    if (!panelChunkPaths.has(new URL(route.request().url()).pathname)) {
      await route.continue();
      return;
    }
    heldLoader = true;
    await loaderGate;
    await route.continue();
  });

  await page.evaluate(() => {
    window.__packedReadyHeader = document.querySelector("header[data-zfb-transition-persist]");
    window.__packedReadyProof = null;
    window.__packedBeforeSwapProof = null;
    window.__packedReadyClickEvents = 0;
    window.__packedConfiguredSwapArmed = false;
    window.addEventListener("toggle-preview-token-panel", () => { window.__packedReadyClickEvents += 1; });
    // Install before the first lazy zdtp activation. When armed later, this
    // listener runs before zdtp's onPageLoad remount during after-swap.
    document.addEventListener("zfb:after-swap", () => {
      if (!window.__packedConfiguredSwapArmed) return;
      window.__packedConfiguredSwapArmed = false;
      const button = document.getElementById("sg-preview-tokens-trigger");
      const before = window.__packedReadyClickEvents;
      const ready = window.__sgPreviewTokenPanelCapture?.ready;
      const pending = window.__sgPreviewTokenPanelCapture?.pending;
      if (button && !button.hidden && !button.disabled) button.click();
      window.__packedConfiguredSwapClick = {
        visible: Boolean(button && !button.hidden && !button.disabled),
        clickEvents: window.__packedReadyClickEvents - before,
        ready,
        pending,
        shellAtClick: Boolean(document.querySelector(".tokenpanel-shell")),
      };
      queueMicrotask(() => {
        window.__packedConfiguredAfterDispatch = {
          shell: Boolean(document.querySelector(".tokenpanel-shell")),
          open: localStorage.getItem("sg-preview-tweak-open"),
        };
      });
    });
    document.addEventListener("zfb:before-swap", () => {
      const capture = window.__sgPreviewTokenPanelCapture;
      window.__packedBeforeSwapProof = { ready: capture?.ready, pending: capture?.pending };
    }, { once: true });
    document.addEventListener("zfb:after-swap", () => {
      const button = document.getElementById("sg-preview-tokens-trigger");
      const capture = window.__sgPreviewTokenPanelCapture;
      window.__packedReadyProof = {
        persisted: window.__packedReadyHeader === document.querySelector("header[data-zfb-transition-persist]"),
        visibleAtSwap: Boolean(button && !button.hidden && !button.disabled),
        before: { ready: capture?.ready, pending: capture?.pending },
      };
      const clickWhenVisible = () => {
        if (!button || button.hidden || button.disabled) return false;
        button.click();
        window.__packedReadyProof.after = { ready: capture?.ready, pending: capture?.pending };
        return true;
      };
      if (clickWhenVisible() || !button) return;
      const observer = new MutationObserver(() => {
        if (clickWhenVisible()) observer.disconnect();
      });
      observer.observe(button, { attributes: true, attributeFilter: ["hidden", "disabled"] });
    }, { once: true });
  });
  const loaderRequest = page.waitForRequest((request) => panelChunkPaths.has(new URL(request.url()).pathname), { timeout: 10_000 })
    .catch((error) => error);
  const swapped = afterSwapPromise(page);
  await page.getByRole("link", { name: "Components", exact: true }).first().click();
  await swapped;
  try {
    await page.waitForFunction(() => window.__packedReadyProof?.after !== undefined, null, { timeout: 10_000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      beforeSwap: window.__packedBeforeSwapProof,
      afterSwap: window.__packedReadyProof,
      clickEvents: window.__packedReadyClickEvents,
      trigger: (() => {
        const button = document.getElementById("sg-preview-tokens-trigger");
        return button ? { hidden: button.hidden, disabled: button.disabled, connected: button.isConnected } : null;
      })(),
    }));
    fail(`the persisted trigger never produced a ready click: ${JSON.stringify(state)}; scriptRequests=${JSON.stringify(scriptRequests)}; ${error}`);
  }
  const proof = await page.evaluate(() => window.__packedReadyProof);
  const beforeSwap = await page.evaluate(() => window.__packedBeforeSwapProof);
  check(beforeSwap?.ready === true && beforeSwap.pending === 0, `host bootstrap was not ready before the body swap: ${JSON.stringify(beforeSwap)}`);
  check(proof?.persisted, `ready host probe lost its persisted trigger: ${JSON.stringify(proof)}`);
  check(proof.before.ready === true && proof.after.ready === true, `capture was not ready across the click: ${JSON.stringify(proof)}`);
  check(proof.before.pending === 0 && proof.after.pending === 0, `a ready click entered the early queue: ${JSON.stringify(proof)}`);
  const clickEvents = await page.evaluate(() => window.__packedReadyClickEvents);
  check(clickEvents === 1, `expected one public toggle event, got ${clickEvents}: ${JSON.stringify(proof)}`);
  const loaderResult = await loaderRequest;
  if (loaderResult instanceof Error) {
    const resources = await page.evaluate(() => performance.getEntriesByType("resource")
      .filter((entry) => entry.name.endsWith(".js"))
      .map((entry) => entry.name));
    fail(`lazy panel chunk request was not observed after a ready click: panelChunks=${JSON.stringify([...panelChunkPaths])}; proof=${JSON.stringify(proof)}; clickEvents=${clickEvents}; scriptRequests=${JSON.stringify(scriptRequests)}; resources=${JSON.stringify(resources)}; ${loaderResult}`);
  }
  check(heldLoader, "the real lazy zdtp loader was not held after the ready click");
  await assertPanelState(page, false);
  releaseLoader();
  await assertPanelState(page, true);
  await trigger.click();
  await assertPanelState(page, false);
  await trigger.click();
  await assertPanelState(page, true);

  for (let turn = 0; turn < 2; turn++) {
    const back = afterSwapPromise(page);
    await page.goBack();
    await back;
    check(!(await trigger.isVisible()), "the trigger stayed visible on the host route");
    if (turn === 0) {
      await page.evaluate(() => {
        window.__packedConfiguredSwapClick = null;
        window.__packedConfiguredAfterDispatch = null;
        window.__packedConfiguredSwapArmed = true;
      });
    }
    const forward = afterSwapPromise(page);
    await page.goForward();
    await forward;
    if (turn === 0) {
      const configuredClick = await page.evaluate(() => window.__packedConfiguredSwapClick);
      check(configuredClick?.visible && configuredClick.clickEvents === 1 && configuredClick.ready === true && configuredClick.pending === 0,
        `configured after-swap click missed the public preview channel: ${JSON.stringify(configuredClick)}`);
      const afterSwapClick = await panelDiagnostics(page);
      const afterDispatch = await page.evaluate(() => window.__packedConfiguredAfterDispatch);
      try {
        await assertPanelState(page, false);
      } catch (error) {
        fail(`configured pre-remount click did not close the panel: event=${JSON.stringify(configuredClick)}; afterDispatch=${JSON.stringify(afterDispatch)}; afterSwapClick=${JSON.stringify(afterSwapClick)}; final=${JSON.stringify(await panelDiagnostics(page))}; ${error}`);
      }
      await trigger.click();
      const afterReopenClick = await panelDiagnostics(page);
      try {
        await assertPanelState(page, true);
      } catch (error) {
        fail(`configured SPA toggle sequence lost the panel: event=${JSON.stringify(configuredClick)}; afterDispatch=${JSON.stringify(afterDispatch)}; afterSwapClick=${JSON.stringify(afterSwapClick)}; afterReopenClick=${JSON.stringify(afterReopenClick)}; final=${JSON.stringify(await panelDiagnostics(page))}; ${error}`);
      }
      continue;
    }
    await assertPanelState(page, true);
    check(await trigger.count() === 1, "SPA navigation duplicated the preview trigger");
  }

  await page.goto(`${origin}${BASE}components`, { waitUntil: "load" });
  await trigger.waitFor({ state: "visible" });
  await assertPanelState(page, true);
  await trigger.click();
  await assertPanelState(page, false);
  console.log("OK — ready host bootstrap delivered the persisted-header click and preserved toggles across SPA remounts and direct load.");
}

async function proveStoryRoutes(page, origin, scenario) {
  const errors = [];
  const badResponses = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
  });

  for (const story of scenario.stories) {
    const detailUrl = `${origin}${BASE}components/${story.slug}`;
    await page.goto(detailUrl, { waitUntil: "domcontentloaded" });
    const title = await page.locator("main h1").first().textContent();
    check(title?.trim() === story.title, `${story.title} detail route rendered ${JSON.stringify(title)} at ${detailUrl}`);

    const iframe = page.locator("main iframe").first();
    await iframe.scrollIntoViewIfNeeded();
    await iframe.waitFor({ state: "attached", timeout: 15_000 });
    const src = await iframe.getAttribute("src");
    check(src, `${story.title} detail page has no preview iframe URL`);
    const parsed = new URL(src, origin);
    check(parsed.pathname === `${BASE.replace(/\/$/u, "")}${scenario.previewPath}`, `${story.title} iframe points at ${parsed.pathname}, expected ${scenario.previewPath}`);
    check(parsed.searchParams.get("slug") === story.slug, `${story.title} iframe does not select its own detail slug`);
    check(parsed.searchParams.get("variant") === "Default", `${story.title} iframe does not select the Default story`);

    const identity = page.frameLocator("main iframe").locator(`[data-packed-story-identity="${story.identity}"]`);
    await identity.waitFor({ state: "visible", timeout: 15_000 });
    check((await identity.textContent())?.includes("route probe"), `${story.title} iframe marker did not render its story body`);
  }

  check(errors.length === 0, `browser errors on ${scenario.name} routes: ${errors.join(" | ")}`);
  check(badResponses.length === 0, `failed browser requests on ${scenario.name} routes: ${badResponses.join(" | ")}`);
}

async function main() {
  const args = process.argv.slice(2);
  const hostIndex = args.indexOf("--host");
  const scenarioIndex = args.indexOf("--scenario");
  check(hostIndex >= 0 && args[hostIndex + 1], "usage: node scripts/verify-styleguide-install-browser.mjs --host <packed-host-dir> --scenario <default|custom-collision|outside-namespace> [--early-click|--ready-host-bootstrap]");
  check(scenarioIndex >= 0 && SCENARIOS[args[scenarioIndex + 1]], "a known --scenario is required");
  const hostDir = path.resolve(args[hostIndex + 1]);
  const scenarioName = args[scenarioIndex + 1];
  const scenario = { ...SCENARIOS[scenarioName], name: scenarioName };
  const withEarlyClick = args.includes("--early-click");
  const withReadyHostBootstrap = args.includes("--ready-host-bootstrap");
  check(!withEarlyClick || scenarioName === "default", "--early-click is only defined for the default route scenario");
  check(!withReadyHostBootstrap || scenarioName === "default", "--ready-host-bootstrap is only defined for the default route scenario");

  const distDir = path.join(hostDir, "dist");
  const panelChunkPaths = withReadyHostBootstrap ? await findPanelChunks(distDir) : null;
  const { chromium } = await import("@playwright/test");
  const server = await startBuiltHost(distDir);
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    if (withEarlyClick) {
      const page = await context.newPage();
      await proveEarlyClick(page, server.origin);
      await page.close();
      console.log("OK — packed host captured a visible-trigger click before bootstrap readiness, replayed one toggle, and returned through SPA history.");
    }
    if (withReadyHostBootstrap) {
      // The early-click proof writes persisted open state. A new browser
      // context keeps the ready-host click as the first lazy activation.
      const readyContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await readyContext.newPage();
      await proveReadyHostBootstrap(page, server.origin, panelChunkPaths);
      await readyContext.close();
    }
    await proveStoryRoutes(await context.newPage(), server.origin, scenario);
    console.log(`OK — packed host ${scenarioName} detail and preview iframes rendered the expected story identities.`);
    await context.close();
  } finally {
    await browser?.close();
    await server.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
