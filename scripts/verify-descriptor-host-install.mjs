// Packed descriptor-host consumer fixture proof (epic #879, S7 confirm
// sub-task). Exercises S1–S6 together through a real packed tarball,
// installed outside this workspace, in a host that:
//   - registers stories as plain-data `StoryDescriptor`s (registry.mode:
//     "descriptor"), never a `.stories.tsx` and never `react`;
//   - serves its own framework-free external preview document
//     (public/frame/) instead of the in-engine preview route
//     (externalPreview);
//   - ships no `tokens` block, so `/tokens` and the in-engine preview route
//     are both implicitly off.
//
// Model: scripts/verify-styleguide-install.mjs (module-mode host, same
// pack/copy/install/build shape). This script imports that script's
// pack/copy/process helpers and the browser verifier's static-host server
// rather than re-implementing an ~800-line sibling (issue #887, do-item 2).

import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assert,
  assertForeignPackage,
  assertTarballShape,
  copyFixtureDir,
  packEngine,
  read,
  run,
  runCapture,
  runStreamed,
} from "./verify-styleguide-install.mjs";
import { BASE, launchChromium, startBuiltHost } from "./verify-styleguide-install-browser.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixtureRoot = path.join(root, "fixtures/descriptor-host");
const packageDirRelative = "packages/styleguide";
const tarballName = "zudo-sg-engine.tgz";
const keep = process.argv.includes("--keep") || Boolean(process.env.ZUDO_SG_VERIFY_KEEP);

/** The two engine routes descriptor mode ships (componentsPreview and tokens are both off). */
const ENGINE_ROUTE_SOURCES = new Set(["pages/components.tsx", "pages/components/[slug].tsx"]);
const DISABLED_ROUTE_SOURCES = ["pages/components/preview.tsx", "pages/tokens.tsx"];

const STORIES = [
  { slug: "primary-button", title: "Primary Button" },
  { slug: "secondary-button", title: "Secondary Button" },
  { slug: "info-card", title: "Info Card" },
];

/**
 * Exact grep patterns for the client-bundle graph check (do-item 2's "name
 * the exact grep patterns"). Run against every `dist/assets/*.js` chunk —
 * the browser-loaded output, never the server-only SSR/build code:
 *   - `preact-render-to-string`: the module-mode SSR story renderer
 *     (catalog/component-thumb.tsx). Descriptor mode never calls it
 *     (catalog/descriptor-thumb.tsx has no import of it at all — see that
 *     file's own header comment), so it must never reach the client.
 *   - a bare `"react"` (or `'react'`) module specifier: this fixture has no
 *     react dependency and no story imports it.
 *   - the descriptor module's own basename ("story-descriptors"): it is read
 *     SERVER-SIDE only, through `virtual:zudo-sg-registry`'s SSR-time import
 *     (routes plugin `buildRegistryModuleSource`) — never a client story
 *     import, since descriptor stories have no client-rendered module to
 *     import at all.
 */
const FORBIDDEN_CLIENT_BUNDLE_PATTERNS = [
  { name: "preact-render-to-string", pattern: /preact-render-to-string/u },
  { name: 'a bare "react" import specifier', pattern: /(?:from\s*|require\(\s*)["']react["']/u },
  { name: "the descriptor module path as a story import", pattern: /story-descriptors/u },
];

function checkArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function assertRoutesJson(hostDir) {
  const routesJson = JSON.parse(await read(hostDir, "dist/__zfb/routes.json"));
  const routes = Array.isArray(routesJson.routes) ? routesJson.routes : routesJson;
  const engineSources = new Set(routes.map((r) => r.source).filter((s) => ENGINE_ROUTE_SOURCES.has(s)));
  assert(
    engineSources.size === ENGINE_ROUTE_SOURCES.size && [...ENGINE_ROUTE_SOURCES].every((s) => engineSources.has(s)),
    `dist/__zfb/routes.json engine route sources = ${[...engineSources].join(", ")}, expected exactly ${[...ENGINE_ROUTE_SOURCES].join(", ")}`,
  );
  for (const disabled of DISABLED_ROUTE_SOURCES) {
    assert(
      !routes.some((r) => r.source === disabled),
      `dist/__zfb/routes.json unexpectedly lists a route from ${disabled} (componentsPreview/tokens must be off)`,
    );
  }
  const slugRoutes = routes.filter((r) => r.source === "pages/components/[slug].tsx");
  assert(
    slugRoutes.length === STORIES.length,
    `expected ${STORIES.length} components/[slug] routes, found ${slugRoutes.length}`,
  );
  for (const story of STORIES) {
    assert(
      slugRoutes.some((r) => r.params?.slug === story.slug),
      `dist/__zfb/routes.json is missing a components/[slug] route for ${story.slug}`,
    );
  }
  console.log("OK — dist/__zfb/routes.json lists exactly the two engine routes (componentsIndex, componentsSlug); no preview or tokens route.");
}

async function assertNoDisabledRouteOutput(hostDir) {
  assert(!existsSync(path.join(hostDir, "dist/components/preview")), "dist/components/preview exists — componentsPreview should be disabled by externalPreview");
  assert(!existsSync(path.join(hostDir, "dist/tokens")), "dist/tokens exists — /tokens should be implicitly disabled (descriptor mode, no tokens block)");
  console.log("OK — no dist/components/preview or dist/tokens output.");
}

async function assertCatalogHtml(hostDir) {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM(await read(hostDir, "dist/components/index.html"));
  const document = dom.window.document;

  const imageTile = document.querySelector("[data-sg-thumb-image]");
  assert(imageTile, "catalog is missing the image-thumbnail tile ([data-sg-thumb-image])");
  assert(imageTile.getAttribute("inert") !== null, "image thumbnail wrapper is missing the inert attribute");
  assert(!imageTile.querySelector("iframe"), "image thumbnail wrapper unexpectedly renders an iframe");
  const img = imageTile.querySelector("img");
  assert(img, "image thumbnail wrapper has no <img>");
  assert(
    img.getAttribute("src") === `${BASE}thumbs/primary-button.svg`,
    `image thumbnail src = ${img.getAttribute("src")}, expected base-prefixed ${BASE}thumbs/primary-button.svg`,
  );

  const noteTiles = [...document.querySelectorAll("[data-sg-thumb-note]")];
  assert(noteTiles.length === 2, `expected 2 note tiles (placeholder + missing), found ${noteTiles.length}`);
  for (const tile of noteTiles) {
    assert(tile.getAttribute("inert") !== null, "note thumbnail wrapper is missing the inert attribute");
    assert(!tile.querySelector("iframe"), "note thumbnail wrapper unexpectedly renders an iframe");
  }
  const { DESCRIPTOR_THUMB_MISSING_NOTE } = await import("@takazudo/zudo-sg/catalog");
  const notes = noteTiles.map((tile) => tile.querySelector(".sg-thumb-note")?.textContent?.trim());
  assert(notes.includes("Snapshot pending"), `catalog is missing the placeholder note; found ${notes.join(", ")}`);
  assert(notes.includes(DESCRIPTOR_THUMB_MISSING_NOTE), `catalog is missing the default "no thumbnail" note; found ${notes.join(", ")}`);

  for (const story of STORIES) {
    assert(dom.window.document.documentElement.outerHTML.includes(story.title), `catalog index is missing ${story.title}`);
  }
  dom.window.close();
  console.log("OK — catalog HTML has the image tile (base-prefixed, inert, no iframe), the placeholder note, and the default missing note.");
}

async function assertDetailHtml(hostDir) {
  const { JSDOM } = await import("jsdom");
  for (const story of STORIES) {
    const detailPath = `dist/components/${story.slug}/index.html`;
    assert(existsSync(path.join(hostDir, detailPath)), `missing built detail route ${detailPath}`);
    const html = await read(hostDir, detailPath);
    const dom = new JSDOM(html);
    const document = dom.window.document;
    assert(document.querySelector("main h1")?.textContent?.trim() === story.title, `${detailPath} does not render the ${story.title} heading`);

    const iframe = document.querySelector("main iframe");
    assert(iframe, `${detailPath} has no preview iframe`);
    const src = iframe.getAttribute("src") ?? "";
    const url = new URL(src, "https://fixture.invalid");
    assert(
      url.pathname === `${BASE}frame/`,
      `${detailPath} iframe points at ${url.pathname}, expected ${BASE}frame/ (externalPreview, base-prefixed)`,
    );
    assert(url.searchParams.get("slug") === story.slug, `${detailPath} iframe does not select its own slug`);
    assert(url.searchParams.get("variant") === "Default", `${detailPath} iframe does not select the Default variant`);

    assert(!document.getElementById("sg-code-panel"), `${detailPath} unexpectedly renders a Code panel (descriptor entries have no story source)`);
    assert(
      !html.includes("Preview tokens"),
      `${detailPath} unexpectedly renders a Preview-tokens button (zdtpApplyProxy is not wired in this fixture)`,
    );
    dom.window.close();
  }
  console.log("OK — every detail page's workbench iframe points at the externalPreview frame with no Code panel and no Preview-tokens button.");
}

/** do-item 2's graph check: no client JS chunk leaks module-mode SSR code, react, or the descriptor module as a story import. */
async function assertClientBundleGraph(hostDir) {
  const assetsDir = path.join(hostDir, "dist/assets");
  const jsFiles = (await readdir(assetsDir)).filter((f) => f.endsWith(".js"));
  assert(jsFiles.length > 0, "no dist/assets/*.js chunks found");
  const contents = await Promise.all(jsFiles.map((f) => readFile(path.join(assetsDir, f), "utf8")));
  for (const { name, pattern } of FORBIDDEN_CLIENT_BUNDLE_PATTERNS) {
    const hit = jsFiles.find((_, i) => pattern.test(contents[i]));
    assert(!hit, `dist/assets/${hit} unexpectedly contains ${name} (pattern ${pattern})`);
  }
  console.log(`OK — no dist/assets/*.js chunk contains preact-render-to-string, a react import, or the descriptor module path (checked ${jsFiles.length} chunks).`);
}

/** `import("@takazudo/zudo-sg/preview/messages")` must work in plain Node, no preact resolution needed. */
async function assertMessagesModuleIsFrameworkFreeInNode(hostDir) {
  const probe = [
    'import { PROTOCOL_VERSION, isReadyMessage, isHeightMessage } from "@takazudo/zudo-sg/preview/messages";',
    "if (PROTOCOL_VERSION !== 1) throw new Error(`unexpected PROTOCOL_VERSION ${PROTOCOL_VERSION}`);",
    'if (typeof isReadyMessage !== "function" || typeof isHeightMessage !== "function") throw new Error("missing guard exports");',
    'console.log("OK");',
  ].join("\n");
  const probePath = path.join(hostDir, ".probe-messages.mjs");
  await writeFile(probePath, probe);
  try {
    const output = await runCapture("node", [probePath], hostDir);
    assert(output.includes("OK"), `messages-module Node probe did not print OK: ${output}`);
  } finally {
    await rm(probePath, { force: true });
  }
  console.log('OK — import("@takazudo/zudo-sg/preview/messages") resolves and runs in plain Node (no preact resolution needed).');
}

async function assertBrowserHandshake(hostDir) {
  const { chromium } = await import("@playwright/test");
  const server = await startBuiltHost(path.join(hostDir, "dist"));
  let browser;
  try {
    browser = await launchChromium(chromium);
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    // Capture postMessage traffic from BEFORE navigation so no early sg:ready
    // / sg:height report from the frame is missed.
    await page.addInitScript(() => {
      window.__sgMessages = [];
      window.addEventListener("message", (event) => {
        if (event.data && typeof event.data === "object" && typeof event.data.type === "string") {
          window.__sgMessages.push(event.data);
        }
      });
    });

    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    for (const story of STORIES) {
      await page.evaluate(() => { window.__sgMessages = []; });
      await page.goto(`${server.origin}${BASE}components/${story.slug}`, { waitUntil: "domcontentloaded" });
      const iframe = page.locator("main iframe").first();
      await iframe.waitFor({ state: "attached", timeout: 15_000 });
      const src = await iframe.getAttribute("src");
      const url = new URL(src ?? "", server.origin);
      assert(url.pathname === `${BASE}frame/`, `${story.slug}: iframe src ${url.pathname}, expected ${BASE}frame/`);

      await page.waitForFunction(
        () => (window.__sgMessages ?? []).some((m) => m.type === "sg:ready") && (window.__sgMessages ?? []).some((m) => m.type === "sg:height"),
        null,
        { timeout: 15_000 },
      );
      const messages = await page.evaluate(() => window.__sgMessages);
      const ready = messages.find((m) => m.type === "sg:ready");
      const height = messages.filter((m) => m.type === "sg:height").at(-1);
      assert(ready?.v === 1, `${story.slug}: sg:ready did not carry v:1 (${JSON.stringify(ready)})`);
      assert(ready?.slug === story.slug, `${story.slug}: sg:ready identity mismatch (${JSON.stringify(ready)})`);
      assert(height?.v === 1, `${story.slug}: sg:height did not carry v:1 (${JSON.stringify(height)})`);
      assert(typeof height?.height === "number" && height.height > 0, `${story.slug}: sg:height has no usable height (${JSON.stringify(height)})`);

      // The frame applies (VariantFrame clamps to a minimum of 80px and starts
      // at 180px before any report lands) — assert the live iframe grew past
      // the pre-report fallback once the real report has been applied.
      await page.waitForFunction(
        (expectedMinHeight) => {
          const el = document.querySelector("main iframe");
          if (!el) return false;
          const px = Number.parseFloat(el.style.height || "0");
          return Number.isFinite(px) && px !== 180 && px >= expectedMinHeight;
        },
        80,
        { timeout: 15_000 },
      );
    }

    // Not exercised here: the shipped `routes-src/components-slug.tsx` always
    // passes `selection: { mode: "all" }` (one stage per variant) — there is
    // no host lever yet to opt into `single` mode's variant-tab src swap, so
    // this fixture cannot exercise "switching variant swaps src with no
    // stale height" (do-item 2). Revisit once the engine exposes selection
    // mode to a host.
    assert(errors.length === 0, `browser errors during descriptor-host handshake: ${errors.join(" | ")}`);
    console.log("OK — every descriptor's preview iframe received sg:ready v1 and a real sg:height, and its rendered height moved off the pre-report fallback.");
    await context.close();
  } finally {
    await browser?.close();
    await server.close();
  }
}

async function main() {
  const artifacts = await mkdtemp(path.join(os.tmpdir(), "zudo-sg-descriptor-pack-"));
  const hostDir = await mkdtemp(path.join(os.tmpdir(), "zudo-sg-descriptor-host-"));

  try {
    const tarballIndex = process.argv.indexOf("--tarball");
    const tarballPath = tarballIndex === -1 ? await packEngine(artifacts) : path.resolve(checkArg("--tarball"));
    if (tarballIndex === -1) console.log(`Packing @takazudo/zudo-sg (${packageDirRelative}) -> ${artifacts}`);
    await assertTarballShape(tarballPath);

    console.log(`Copying fixtures/descriptor-host -> ${hostDir}`);
    await copyFixtureDir(fixtureRoot, hostDir);
    await mkdir(path.join(hostDir, ".tarball"), { recursive: true });
    await cp(tarballPath, path.join(hostDir, ".tarball", tarballName));

    console.log("Installing (tarball + exact @takazudo/zfb / @takazudo/zudo-doc pins)");
    await run("corepack", ["pnpm", "install"], hostDir);
    await assertForeignPackage(hostDir);

    console.log("Type-checking the consumer against packed declarations: tsc --noEmit -p tsconfig.json");
    await run("corepack", ["pnpm", "exec", "tsc", "--noEmit", "-p", "tsconfig.json"], hostDir);

    await assertMessagesModuleIsFrameworkFreeInNode(hostDir);

    console.log("zfb build (descriptor mode, externalPreview, base \"/styleguide/\")");
    const buildLog = await runStreamed("corepack", ["pnpm", "exec", "zfb", "build"], hostDir);
    assert(!/has no matching registry entry/u.test(buildLog), "zfb build logged an unregistered island marker");

    await assertRoutesJson(hostDir);
    await assertNoDisabledRouteOutput(hostDir);
    await assertCatalogHtml(hostDir);
    await assertDetailHtml(hostDir);
    await assertClientBundleGraph(hostDir);
    await assertBrowserHandshake(hostDir);

    console.log("OK — packed @takazudo/zudo-sg descriptor mode + externalPreview installs and builds outside the workspace, under base \"/styleguide/\".");
  } finally {
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
