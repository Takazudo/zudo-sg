// ---------------------------------------------------------------------------
// Leaving the BROWSER is not leaving the block (epic #368, review finding 2).
//
// `leftTheBrowser` in `prose-inline-session.ts` has to separate two events the
// DOM reports IDENTICALLY — a `focusout` with a null `relatedTarget` and
// `document.hasFocus()` false:
//
//   * the user clicked HOST chrome (inspector / tree / toolbar) → prompt, and
//     pull the frame forward so the modal is answerable;
//   * the user left the browser (another window, another tab) → do NOTHING,
//     because a prompt there pops a modal nobody asked for and yanks the tab
//     back to the front to show it.
//
// Why this suite is not in `playwright.config.ts`. Reproducing the second case
// needs a browser that reports focus HONESTLY, and the default harness cannot:
//
//   1. Playwright turns on CDP focus emulation so a page always claims to be
//      focused — the flakiness cure that makes this exact bug invisible. It is
//      switched off below, and switched back on afterwards.
//   2. Headless Chromium has no window to lose focus at all. So this suite runs
//      HEADED (`headless: false` in playwright.prose-window-blur.config.ts,
//      under xvfb-run on a machine with no display).
//
// With both in place a second tab genuinely takes focus away, and the composer
// tab reports what a real alt-tab reports: still VISIBLE, but `hasFocus()`
// false — the branch that decides via the TOP document. The first attempt at
// this test did neither and was VACUOUS: nothing backgrounded, no focusout
// fired, and "no dialog appeared" proved only that nothing had happened. So
// every assertion about the outcome is now gated behind assertions that the
// mechanism REALLY fired — see `expect(away.focusOuts)` below.
//
// The paired host-chrome case runs in the SAME browser under the SAME settings,
// so the two are discriminated by one run rather than compared across
// environments. `composer-prose.spec.ts` 11:* covers it in the default harness.
// ---------------------------------------------------------------------------

import { expect, test, type BrowserContext, type FrameLocator, type Locator, type Page } from "@playwright/test";
import { openComposerRecord } from "./support/composer-persistence";

const CANVAS_IFRAME = ".sg-composer-canvas-frame iframe";
const EDITOR = "[data-zc-prose-editing]";
const DIALOG = ".zc-prose-dialog";
const DIALOG_ACTION = ".zc-prose-dialog-action";

declare global {
  interface Window {
    __proseCommits?: number;
    __focusOuts?: number;
  }
}

const canvas = (page: Page): FrameLocator => page.frameLocator(CANVAS_IFRAME);

function previewFrame(page: Page) {
  const frame = page.frames().find((f) => f.url().includes("/composer/preview"));
  if (!frame) throw new Error("composer preview frame is not attached");
  return frame;
}

const markdownField = (page: Page): Locator =>
  page.locator("#sg-composer-inspector").getByLabel("Markdown");

const dialogAction = (page: Page, label: string): Locator =>
  canvas(page).locator(DIALOG_ACTION, { hasText: label });

/** Real `commit-inline-edit` envelopes arriving at the host window. */
async function installCommitCounter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__proseCommits = 0;
    window.addEventListener("message", (event) => {
      const data = event.data as { type?: unknown } | null;
      if (data && typeof data === "object" && data.type === "commit-inline-edit") {
        window.__proseCommits = (window.__proseCommits ?? 0) + 1;
      }
    });
  });
}

const commitCount = (page: Page) => page.evaluate(() => window.__proseCommits ?? 0);

async function addProseMd(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Add component to document root" }).click();
  const chooser = page.locator("dialog.sg-composer-chooser");
  await expect(chooser).toBeVisible();
  await chooser.getByPlaceholder("Search components…").fill("ProseMd");
  await chooser.getByRole("button", { name: "ProseMd", exact: true }).click();
  await expect(chooser).not.toBeVisible();
  const pressed = page.locator('.sg-composer-tree-select[aria-pressed="true"]');
  await expect(pressed).toHaveCount(1);
  const id = await pressed.evaluate(
    (el) => el.closest("[data-sg-tree-node-id]")?.getAttribute("data-sg-tree-node-id") ?? "",
  );
  if (!id) throw new Error("added ProseMd row has no data-sg-tree-node-id");
  return id;
}

const editorText = (editor: Locator) => editor.evaluate((el) => el.textContent ?? "");

/** Exactly the signals `leftTheBrowser` reads, plus proof a focusout happened. */
async function focusState(page: Page) {
  return {
    visibility: await previewFrame(page).evaluate(() => document.visibilityState),
    frameHasFocus: await previewFrame(page).evaluate(() => document.hasFocus()),
    topHasFocus: await previewFrame(page).evaluate(
      () => window.top?.document.hasFocus() ?? null,
    ),
    activeIsEditable: await previewFrame(page).evaluate(
      () => document.activeElement?.hasAttribute("data-zc-prose-editing") ?? false,
    ),
    focusOuts: await previewFrame(page).evaluate(() => window.__focusOuts ?? 0),
  };
}

/** Caret position inside the editable, so "intact" can mean something exact. */
async function caret(page: Page) {
  return previewFrame(page).evaluate(() => {
    const el = document.querySelector("[data-zc-prose-editing]");
    const selection = document.defaultView?.getSelection();
    if (!el || !selection) return null;
    return {
      collapsed: selection.isCollapsed,
      offset: selection.focusOffset,
      length: el.textContent?.length ?? 0,
    };
  });
}

test.describe.serial("Leaving the browser is not leaving the block (#368)", () => {
  let context: BrowserContext;
  let page: Page;
  let nodeId = "";

  const node = (): Locator => canvas(page).locator(`[data-zc-node-id="${nodeId}"]`);
  const editor = (): Locator => canvas(page).locator(EDITOR);
  const dialog = (): Locator => canvas(page).locator(DIALOG);

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await installCommitCounter(page);
    await openComposerRecord(page);
    nodeId = await addProseMd(page);
    await expect(node().locator(".zc-prose-md")).toBeVisible();
    await markdownField(page).fill("hello");
    await expect(node().locator(".zc-prose-md")).toContainText("hello");
  });

  test.afterAll(async () => {
    await context.close();
  });

  /** Open the source editor, dirty it, and arm the focusout counter. */
  async function openDirty(suffix: string): Promise<void> {
    await page.locator(`[data-sg-tree-node-id="${nodeId}"] .sg-composer-tree-select`).first().click();
    await node().dblclick();
    await expect(editor()).toBeVisible();
    await expect(editor()).toBeFocused();
    await page.evaluate(() => {
      window.__proseCommits = 0;
    });
    await page.keyboard.type(suffix);
    await previewFrame(page).evaluate(() => {
      window.__focusOuts = 0;
      document.querySelector("[data-zc-prose-editing]")?.addEventListener("focusout", () => {
        window.__focusOuts = (window.__focusOuts ?? 0) + 1;
      });
    });
  }

  test("a window/tab blur raises nothing, keeps the draft, and never grabs focus", async () => {
    await openDirty("TABSWITCH");
    const before = await caret(page);

    // Stop Playwright pretending the page is focused, then let a second tab
    // genuinely take focus — the only combination that reproduces the real
    // signal (see the header).
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: false });
    const other = await context.newPage();
    await other.goto("about:blank");
    await other.bringToFront();
    // The verdict is taken one task after the focusout; give it room to be wrong.
    await page.waitForTimeout(600);

    const away = await focusState(page);

    // ── The MECHANISM really fired. Without this the test proves nothing. ────
    expect(away.topHasFocus, "the composer tab must really have lost focus").toBe(false);
    expect(away.frameHasFocus, "the preview document must report itself unfocused").toBe(false);
    expect(away.focusOuts, "a real focusout must have reached the editable").toBeGreaterThan(0);
    // Still VISIBLE: this is the alt-tab-to-another-window shape, so the
    // `visibilityState === "hidden"` shortcut is NOT what saves us here — the
    // top-document branch is.
    expect(away.visibility).toBe("visible");
    // A window blur RETAINS the focus path; that is what tells it apart from a
    // click on host chrome, which resets `activeElement` to `<body>`.
    expect(away.activeIsEditable).toBe(true);

    // ── …and the session ignored it completely. ─────────────────────────────
    expect(await dialog().count(), "leaving the browser must not prompt").toBe(0);
    await expect(editor()).toBeVisible();
    expect(await editorText(editor())).toBe("helloTABSWITCH");
    expect(await commitCount(page)).toBe(0);

    // Coming back: the draft and the caret are exactly as they were, and the
    // tab was never dragged forward while it was in the background.
    await other.close();
    await page.bringToFront();
    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await cdp.detach();
    await page.waitForTimeout(300);

    expect(await dialog().count()).toBe(0);
    expect(await editorText(editor())).toBe("helloTABSWITCH");
    expect(await caret(page)).toEqual(before);
    expect(await commitCount(page)).toBe(0);

    await page.keyboard.press("Escape");
    await dialogAction(page, "Discard changes").click();
    await expect(editor()).toHaveCount(0);
  });

  test("…while a click on host chrome, in the SAME browser, still prompts", async () => {
    // The discrimination, decided in one run rather than across two harnesses:
    // same window, same focus-emulation setting, different gesture.
    await openDirty("Q");

    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: false });
    await markdownField(page).click();

    await expect(dialog()).toBeVisible();
    await expect(canvas(page).locator(".zc-prose-dialog-title")).toHaveText(
      "Unsaved markdown changes",
    );
    await expect(canvas(page).locator(DIALOG_ACTION)).toHaveText([
      "Discard changes",
      "Keep editing",
      "Save changes",
    ]);
    expect(await commitCount(page)).toBe(0);

    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await cdp.detach();
    await dialogAction(page, "Discard changes").click();
    await expect(editor()).toHaveCount(0);
  });
});
