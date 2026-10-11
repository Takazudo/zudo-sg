import { auditIslands } from "./audit";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect, type Page } from "@playwright/test";
import { createStaticPreviewServer, resolveE2EHost } from "../../../scripts/lib/playwright-e2e-server.mjs";
import { setAppearanceTheme } from "../../../e2e/helpers/appearance";

type CaptureState = {
  id: string;
  path: string;
  screenshot: "full-page" | "viewport";
  actions?: string[];
};

type Site = {
  id: "root" | "demo" | "doc";
  dist: string;
  buildCommand: string;
  previewCommand: string;
  states: CaptureState[];
};

type StateManifest = {
  baseSha: string;
  viewports: { width: number; height: number }[];
  themes: ("light" | "dark")[];
  styleProperties: string[];
  styleSelectors: string[];
  sites: Site[];
};

const PARITY_DIR = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = resolve(PARITY_DIR, "../baseline");
const REPO_ROOT = resolve(BASELINE_DIR, "../../..");
const OUTPUT_DIR = resolve(PARITY_DIR, "states");
const manifest = JSON.parse(
  await readFile(resolve(BASELINE_DIR, "states.json"), "utf8"),
) as StateManifest;
const siteFlag = process.argv.indexOf("--site");
const requestedSite = siteFlag < 0 ? undefined : process.argv[siteFlag + 1];
if (siteFlag >= 0 && !manifest.sites.some(site => site.id === requestedSite)) {
  throw new Error("--site requires root, demo, or doc");
}
const selectedSites = manifest.sites.filter(site => requestedSite === undefined || site.id === requestedSite);

function startPreview(site: Site) {
  const host = resolveE2EHost();
  const hostFlag = host === "localhost" ? "" : ` --host ${host}`;
  const entry =
    site.id === "doc" ? { name: "doc", offset: 2, legacyPort: 4_702 } : site.id;
  const preview = createStaticPreviewServer({
    entry,
    projectRoot: REPO_ROOT,
    host,
    distPath: site.dist,
    buildCommand: site.buildCommand,
    command: site.previewCommand.replace("{hostFlag}", hostFlag),
    urlPath: "/",
    timeout: 60_000,
  });
  const child = spawn("bash", ["-lc", preview.webServer.command], {
    cwd: preview.webServer.cwd,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout?.on("data", (chunk: Buffer) => (logs += chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => (logs += chunk.toString()));

  return {
    origin: preview.origin,
    child,
    get logs() {
      return logs;
    },
  };
}

async function waitForPreview(
  origin: string,
  child: ReturnType<typeof spawn>,
  getLogs: () => string,
) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Preview exited before becoming ready.\n${getLogs()}`);
    }
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // The static preview can take a short time to bind after pnpm starts it.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${origin}.\n${getLogs()}`);
}

async function stopPreview(child: ReturnType<typeof spawn>) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (child.pid && process.platform !== "win32") process.kill(-child.pid, "SIGTERM");
    else child.kill("SIGTERM");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
  await Promise.race([
    new Promise<void>((done) => child.once("exit", () => done())),
    delay(5_000),
  ]);
  if (child.exitCode === null && child.pid) {
    try {
      if (process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
      else child.kill("SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }
}

async function setDemoTheme(page: Page, theme: "light" | "dark") {
  await expect(page.locator('[data-theme-control] button:visible').first()).toBeVisible();
  if ((await page.locator("html").getAttribute("data-theme")) !== theme) {
    await page.locator('[data-theme-control] button:visible').first().click();
  }
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function applyTheme(page: Page, site: Site, theme: "light" | "dark") {
  if (site.id === "demo") {
    await setDemoTheme(page, theme);
    return "demo-theme-control";
  }
  const appearanceTrigger = page
    .getByRole("banner")
    .getByRole("button", { name: /^Appearance:/ });
  if (await appearanceTrigger.count()) {
    await setAppearanceTheme(page, theme);
    return "appearance-helper";
  }
  await page.locator("html").evaluate((root, value) => {
    root.setAttribute("data-theme", value);
  }, theme);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  return "document-attribute";
}

async function applyActions(
  page: Page,
  state: CaptureState,
  width: number,
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  for (const action of state.actions ?? []) {
    if (action === "workbench-ready") {
      await expect(page.locator(".sg-workbench-toolbar")).toBeVisible({ timeout: 15_000 });
      results[action] = "ready";
      continue;
    }
    if (action === "open-code-panel") {
      const toggle = page.locator('.sg-workbench-toolbar button[title="Toggle code panel"]');
      await expect(toggle).toBeVisible({ timeout: 15_000 });
      if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      results[action] = "open";
      continue;
    }
    if (action === "preview-ready") {
      await expect(page.locator("[data-sg-variant-root]")).toBeVisible({ timeout: 15_000 });
      results[action] = "ready";
      continue;
    }
    if (action === "open-mobile-nav") {
      if (width > 640) {
        results[action] = "skipped: desktop navigation at this viewport";
        continue;
      }
      const toggle = page.locator("[data-nav-toggle]");
      await expect(toggle).toBeAttached();
      if (!(await toggle.isChecked())) await page.locator("[data-nav-hamburger]").click();
      await expect(toggle).toBeChecked();
      results[action] = "open";
      continue;
    }
    throw new Error(`Unknown capture action: ${action}`);
  }
  return results;
}

async function computedStyles(page: Page, selectors: string[], properties: string[]) {
  return page.evaluate(
    ({ selectors: selectorList, properties: propertyList }) => {
      const result: Record<string, unknown> = {};
      const actualSelectors = [...selectorList, "first-main-control"];
      for (const selector of actualSelectors) {
        const query = selector === "first-main-control" ? "main button, main a" : selector;
        const elements = [...document.querySelectorAll<HTMLElement>(query)];
        const element = elements[0];
        if (!element) {
          result[selector] = null;
          continue;
        }
        const style = getComputedStyle(element);
        result[selector] = {
          matchCount: elements.length,
          tagName: element.tagName.toLowerCase(),
          id: element.id || null,
          className: typeof element.className === "string" ? element.className : null,
          styles: Object.fromEntries(
            propertyList.map((property) => [property, style.getPropertyValue(property)]),
          ),
        };
      }
      return result;
    },
    { selectors, properties },
  );
}

async function captureOne(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  origin: string,
  site: Site,
  state: CaptureState,
  viewport: { width: number; height: number },
  theme: "light" | "dark",
  properties: string[],
  selectors: string[],
) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    const response = await page.goto(`${origin}${state.path}`, { waitUntil: "domcontentloaded" });
    if (!response?.ok()) {
      throw new Error(`${site.id} ${state.path} returned HTTP ${response?.status() ?? "no response"}`);
    }
    await page.waitForLoadState("networkidle");
    await page.setViewportSize({ width: 1280, height: viewport.height });
    const themeMethod = await applyTheme(page, site, theme);
    await page.setViewportSize(viewport);
    const actions = await applyActions(page, state, viewport.width);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(async () => {
      await document.fonts?.ready;
    });

    const key = `${state.id}-${viewport.width}-${theme}`;
    const directory = resolve(OUTPUT_DIR, site.id);
    await mkdir(directory, { recursive: true });
    const screenshotPath = resolve(directory, `${key}.png`);
    const stylePath = resolve(directory, `${key}.json`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: state.screenshot === "full-page",
      animations: "disabled",
    });
    const styles = await computedStyles(page, selectors, properties);
    await writeFile(
      stylePath,
      `${JSON.stringify(
        {
          site: site.id,
          state: state.id,
          path: state.path,
          url: page.url(),
          viewport,
          theme,
          themeMethod,
          screenshot: state.screenshot,
          actions,
          styles,
        },
        null,
        2,
      )}\n`,
    );
    console.log(`captured ${site.id}/${key}`);
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  for (const site of selectedSites) {
    const preview = startPreview(site);
    try {
      await waitForPreview(preview.origin, preview.child, () => preview.logs);
      if (process.argv.includes("--audit")) {
        await auditIslands(browser, preview.origin, site, REPO_ROOT, PARITY_DIR);
        continue;
      }
      for (const state of site.states) {
        for (const viewport of manifest.viewports) {
          for (const theme of manifest.themes) {
            await captureOne(
              browser,
              preview.origin,
              site,
              state,
              viewport,
              theme,
              manifest.styleProperties,
              manifest.styleSelectors,
            );
          }
        }
      }
    } finally {
      await stopPreview(preview.child);
    }
  }
} finally {
  await browser.close();
}

const expectedCaptures = selectedSites.reduce((sum, site) => sum + site.states.length, 0)
  * manifest.viewports.length
  * manifest.themes.length;
console.log(process.argv.includes("--audit") ? `completed ${selectedSites.length} all-route island audits` : `completed ${expectedCaptures} screenshot/style pairs`);
