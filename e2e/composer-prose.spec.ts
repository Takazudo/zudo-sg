import { expect, test, type FrameLocator, type Locator, type Page } from "@playwright/test";
import { openComposerRecord } from "./support/composer-persistence";

// ---------------------------------------------------------------------------
// Explicit-save prose editing, end to end (#376, epic #368).
//
// Three things this suite exists to prove, none of which a unit test can:
//
//   1. THE WASM RUNTIME LOADS ON THE BUILT SITE. `ProseMd` renders markdown
//      client-side through `@takazudo/zfb-md-wasm`, whose glue module and
//      `.wasm` payload are emitted as HASHED build assets. A `dist/` preview
//      serves them the way production does — right MIME, right path, no
//      console noise — and a fence really does come back carrying `hi-*`
//      classes. The hashes themselves are deliberately NOT asserted: they
//      change on every build.
//   2. THERE ARE NO IMPLICIT COMMITS. Exactly two gestures reach the model:
//      the floating Save button, and the leave dialog's "Save changes". Blur
//      does not commit. Enter does not commit. An Edit→Preview switch does not
//      commit. ESC and click-away PROMPT. The unit suite
//      (`src/features/composer/preview/__tests__/prose-inline-session.test.ts`)
//      pins the state machine; only a real browser can prove the same for a
//      real cross-document click on host chrome, where the ONLY signal the
//      iframe gets is `focusout`.
//   3. THE PLAIN PATH IS UNTOUCHED. A `"plain"` field still auto-commits on
//      Enter/blur with no Save button and no source editor.
//
// Serial, one shared page: the flows build on each other (a node added in the
// first test is the subject of every later one) and the composer's document is
// per-record persistent state, so a fresh page per test would mean re-adding
// the block fourteen times for no extra coverage.
//
// Every commit assertion counts REAL `commit-inline-edit` messages arriving at
// the host window (see `installCommitCounter`) rather than inferring "it
// committed" from a value that happens to match — "committed twice" and
// "committed once" are indistinguishable by value alone, and the difference is
// exactly what "no implicit commits" is about.
// ---------------------------------------------------------------------------

const CANVAS_IFRAME = ".sg-composer-canvas-frame iframe";
const EDITOR = "[data-zc-prose-editing]";
const SAVE = ".zc-prose-save";
const SAVEBAR = ".zc-prose-savebar";
const DIALOG = ".zc-prose-dialog";
const DIALOG_ACTION = ".zc-prose-dialog-action";

declare global {
  interface Window {
    __proseCommits?: number;
  }
}

function canvas(page: Page): FrameLocator {
  return page.frameLocator(CANVAS_IFRAME);
}

/** The preview document as a real Frame — needed to read ITS `activeElement`. */
function previewFrame(page: Page) {
  const frame = page.frames().find((f) => f.url().includes("/composer/preview"));
  if (!frame) throw new Error("composer preview frame is not attached");
  return frame;
}

function dialogAction(page: Page, label: string): Locator {
  return canvas(page).locator(DIALOG_ACTION, { hasText: label });
}

function markdownField(page: Page): Locator {
  return page.locator("#sg-composer-inspector").getByLabel("Markdown");
}

/**
 * Count `commit-inline-edit` envelopes as the HOST window receives them. An
 * init script (not an `evaluate`) so the listener is installed before the app
 * runs and survives the reload in the persistence test.
 */
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

async function commitCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__proseCommits ?? 0);
}

async function resetCommitCount(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__proseCommits = 0;
  });
}

/** Add a ProseMd block at the document root; returns its node id. */
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

/**
 * Set the markdown from the inspector and return only once the CANVAS is
 * showing that exact value.
 *
 * Not decoration: an inspector edit reaches the canvas as a `render` message,
 * and a session opened before it lands captures the OLD value — the #288
 * ground-check then sees the field change under the session and ends it,
 * silently and correctly. Waiting on the rendered text is what makes every
 * later step deterministic.
 */
async function setMarkdown(
  page: Page,
  node: Locator,
  markdown: string,
  rendered: string | RegExp,
): Promise<void> {
  await markdownField(page).fill(markdown);
  await expect(node.locator(".zc-prose-md")).toContainText(rendered);
}

/**
 * Open the prose session and return only once the editable is genuinely ready
 * for keystrokes — the mount effect seeds its text, focuses it and places the
 * caret, and a `type()` fired before that silently targets nothing.
 */
async function openProseEditor(node: Locator, editor: Locator): Promise<void> {
  await node.dblclick();
  await expect(editor).toBeVisible();
  await expect(editor).toBeFocused();
}

/** The editable's text, read the way the session reads it. */
async function editorText(editor: Locator): Promise<string> {
  return editor.evaluate((el) => el.textContent ?? "");
}

test.describe.serial("Composer prose editing (#376)", () => {
  let page: Page;
  let nodeId = "";
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const wasmResponses: Array<{ url: string; status: number; type: string }> = [];

  const node = (): Locator => canvas(page).locator(`[data-zc-node-id="${nodeId}"]`);
  const editor = (): Locator => canvas(page).locator(EDITOR);
  const saveButton = (): Locator => canvas(page).locator(SAVE);
  const dialog = (): Locator => canvas(page).locator(DIALOG);

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("response", (response) => {
      const url = response.url();
      if (!/zfb_md_wasm/.test(url)) return;
      wasmResponses.push({
        url,
        status: response.status(),
        type: response.headers()["content-type"] ?? "",
      });
    });
    await installCommitCounter(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ── 1 ─────────────────────────────────────────────────────────────────────
  test("01 - adds a ProseMd block whose default markdown renders through the BUILT wasm runtime", async () => {
    await openComposerRecord(page);
    nodeId = await addProseMd(page);

    const block = node().locator(".zc-prose-md");
    await expect(block).toBeVisible();
    // Rendered markdown, not the `--pending` raw-source placeholder: the
    // runtime resolved, so the wasm module really executed.
    await expect(block).not.toHaveClass(/zc-prose-md--pending/);
    await expect(block.locator("h2")).toHaveText(/Getting started/);
    await expect(block.locator("li")).toHaveCount(2);
    await expect(block.locator("blockquote")).toBeVisible();

    // The fence is highlighted by CLASS (#371) — semantic `hi-*` spans under a
    // `pre.hi-root`, which is what the `--zfb-hi-*` bridge styles.
    const fence = block.locator("pre.hi-root");
    await expect(fence).toHaveCount(1);
    await expect(fence.locator(".hi-kw").first()).toHaveText("export");
    await expect(fence.locator(".hi-str").first()).toBeVisible();

    // …and both hashed build assets were actually fetched, with the MIME that
    // makes `WebAssembly.instantiateStreaming` work. Hashes are not asserted.
    const wasm = wasmResponses.find((r) => r.url.includes(".wasm"));
    const glue = wasmResponses.find((r) => r.url.includes("glue"));
    expect(wasm, "the .wasm payload must be requested from the built site").toBeDefined();
    expect(glue, "the wasm glue module must be requested from the built site").toBeDefined();
    expect(wasm!.status).toBe(200);
    expect(wasm!.type).toContain("application/wasm");
    expect(glue!.status).toBe(200);
    expect(glue!.type).toContain("javascript");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // ── 2 ─────────────────────────────────────────────────────────────────────
  test("02 - inspector edits re-render the markdown live, fence classes and all", async () => {
    const block = node().locator(".zc-prose-md");
    await setMarkdown(page, node(), "# Ignored\n\n## Live edit\n\n```ts\nconst x = 1;\n```\n", "Live edit");
    await expect(block.locator("h2")).toHaveText("Live edit");
    await expect(block.locator("pre.hi-root .hi-kw").first()).toHaveText("const");

    // Back to a small, newline-free value: every later step compares exact
    // stored text, and a trailing newline in a `contenteditable` is subject to
    // the browser's own placeholder handling (see issue #380).
    await setMarkdown(page, node(), "hello", "hello");
  });

  // ── 3 ─────────────────────────────────────────────────────────────────────
  test("03 - double-click opens a RAW-SOURCE editable with the caret at the end", async () => {
    await setMarkdown(page, node(), "## Heading\n\n`code` and text.", "code and text.");

    await openProseEditor(node(), editor());
    // The source itself, verbatim — markdown syntax visible as literal text,
    // not the rendered tree (the component is not mounted underneath).
    expect(await editorText(editor())).toBe("## Heading\n\n`code` and text.");
    await expect(node().locator(".zc-prose-md")).toHaveCount(0);
    await expect(editor()).toHaveAttribute("contenteditable", "plaintext-only");
    await expect(editor()).toHaveAttribute("aria-label", "Markdown source");
    await expect(editor()).toHaveCSS("white-space", "pre-wrap");
    await expect(editor()).toHaveCSS("font-family", /mono/);

    // Caret collapsed at the end, so the first keystroke APPENDS. Entering
    // consumes a click on the rendered block, and the source that replaces it
    // has an unrelated layout — a caret left at the pointer would sit at an
    // arbitrary offset, and a double-click's word-select would leave a
    // selection there for the next keystroke to replace.
    const caret = await editor().evaluate((el) => {
      const selection = el.ownerDocument.defaultView!.getSelection()!;
      return {
        collapsed: selection.isCollapsed,
        offset: selection.focusOffset,
        length: (el.textContent ?? "").length,
      };
    });
    expect(caret.collapsed).toBe(true);
    expect(caret.offset).toBe(caret.length);

    // The Save affordance floats over the canvas, OUTSIDE the edited block.
    const savebar = canvas(page).locator(SAVEBAR);
    await expect(savebar).toBeVisible();
    await expect(savebar).toHaveCSS("position", "fixed");
    expect(
      await savebar.evaluate((el, id) => el.closest(`[data-zc-node-id="${id}"]`) !== null, nodeId),
    ).toBe(false);
    await expect(saveButton()).toHaveText("Done");
  });

  // ── 4 ─────────────────────────────────────────────────────────────────────
  test("04 - the affordance turns into a dirty Save and back again as the draft diverges", async () => {
    await page.keyboard.type("X");
    await expect(saveButton()).toHaveText("Save");
    await expect(saveButton()).toHaveAttribute("data-zc-dirty", "");
    await expect(canvas(page).locator(".zc-prose-savebar-status")).toHaveText("Unsaved changes");

    // Dirtiness is derived from the value, so undoing the keystroke clears it.
    await page.keyboard.press("Backspace");
    await expect(saveButton()).toHaveText("Done");
    await expect(saveButton()).not.toHaveAttribute("data-zc-dirty", "");
    await expect(canvas(page).locator(".zc-prose-savebar-status")).toHaveCount(0);
  });

  // ── 5 ─────────────────────────────────────────────────────────────────────
  test("05 - Enter inserts newlines and commits NOTHING", async () => {
    await resetCommitCount(page);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("## New heading");

    expect(await editorText(editor())).toBe("## Heading\n\n`code` and text.\n\n## New heading");
    // Still editing: the block has not re-rendered and nothing reached the model.
    await expect(editor()).toBeVisible();
    await expect(node().locator(".zc-prose-md")).toHaveCount(0);
    expect(await commitCount(page)).toBe(0);
  });

  // ── 6 ─────────────────────────────────────────────────────────────────────
  test("06 - the Save button commits exactly once and the inspector reflects it", async () => {
    await resetCommitCount(page);
    await saveButton().click();

    await expect(editor()).toHaveCount(0);
    await expect(canvas(page).locator(SAVEBAR)).toHaveCount(0);
    await expect(node().locator(".zc-prose-md h2").nth(1)).toHaveText("New heading");
    await expect(markdownField(page)).toHaveValue(
      "## Heading\n\n`code` and text.\n\n## New heading",
    );
    expect(await commitCount(page)).toBe(1);
  });

  // ── 7 ─────────────────────────────────────────────────────────────────────
  test("07 - ESC while dirty prompts; Keep editing preserves the draft, Discard reverts", async () => {
    await setMarkdown(page, node(), "hello", "hello");
    await openProseEditor(node(), editor());
    await resetCommitCount(page);
    await page.keyboard.type("ZZZ");

    await page.keyboard.press("Escape");
    await expect(dialog()).toBeVisible();
    await expect(dialog()).toHaveAttribute("aria-modal", "true");
    await expect(canvas(page).locator(".zc-prose-dialog-title")).toHaveText(
      "Unsaved markdown changes",
    );
    // The ESC dialog offers no Save — ESC means "I want out", so the choice is
    // only whether the draft survives.
    await expect(canvas(page).locator(DIALOG_ACTION)).toHaveText([
      "Discard changes",
      "Keep editing",
    ]);
    await expect(dialogAction(page, "Keep editing")).toBeFocused();

    await dialogAction(page, "Keep editing").click();
    await expect(dialog()).toHaveCount(0);
    expect(await editorText(editor())).toBe("helloZZZ");
    await expect(editor()).toBeFocused();
    expect(await commitCount(page)).toBe(0);

    await page.keyboard.press("Escape");
    await expect(dialog()).toBeVisible();
    await dialogAction(page, "Discard changes").click();
    await expect(editor()).toHaveCount(0);
    await expect(node().locator(".zc-prose-md")).toHaveText("hello");
    await expect(markdownField(page)).toHaveValue("hello");
    expect(await commitCount(page)).toBe(0);
  });

  // ── 8 ─────────────────────────────────────────────────────────────────────
  test("08 - ESC with a clean draft exits silently", async () => {
    await openProseEditor(node(), editor());
    await resetCommitCount(page);
    await page.keyboard.press("Escape");

    await expect(editor()).toHaveCount(0);
    await expect(dialog()).toHaveCount(0);
    await expect(node().locator(".zc-prose-md")).toHaveText("hello");
    expect(await commitCount(page)).toBe(0);
  });

  // ── 9 ─────────────────────────────────────────────────────────────────────
  test("09 - clicking another canvas block prompts, consumes the gesture, and can save", async () => {
    await openProseEditor(node(), editor());
    await resetCommitCount(page);
    await page.keyboard.type("AAA");

    await canvas(page).locator('[data-zc-node-id="heading-1"]').click({ force: true });
    await expect(dialog()).toBeVisible();
    // Leaving is a three-way choice — unlike ESC, saving is on the table.
    await expect(canvas(page).locator(DIALOG_ACTION)).toHaveText([
      "Discard changes",
      "Keep editing",
      "Save changes",
    ]);
    // The click that raised the dialog is CONSUMED, never replayed: selection
    // must still be the block being edited.
    await expect(
      page.locator('.sg-composer-tree-select[aria-pressed="true"]').locator("xpath=ancestor::*[@data-sg-tree-node-id][1]"),
    ).toHaveAttribute("data-sg-tree-node-id", nodeId);

    await dialogAction(page, "Save changes").click();
    await expect(editor()).toHaveCount(0);
    await expect(markdownField(page)).toHaveValue("helloAAA");
    expect(await commitCount(page)).toBe(1);
  });

  // ── 10 ────────────────────────────────────────────────────────────────────
  test("10 - clicking another canvas block and discarding reverts without committing", async () => {
    await openProseEditor(node(), editor());
    await resetCommitCount(page);
    await page.keyboard.type("BBB");

    await canvas(page).locator('[data-zc-node-id="heading-1"]').click({ force: true });
    await expect(dialog()).toBeVisible();
    await dialogAction(page, "Discard changes").click();

    await expect(editor()).toHaveCount(0);
    await expect(markdownField(page)).toHaveValue("helloAAA");
    expect(await commitCount(page)).toBe(0);
  });

  // ── 11 ────────────────────────────────────────────────────────────────────
  // The `focusout` path — the ONLY signal the iframe gets for a click on host
  // chrome, since it cannot see the parent document's mousedown and this epic
  // adds no protocol message for it. All three host surfaces, because each
  // reaches the iframe through a different parent-side handler.
  for (const surface of ["inspector", "tree", "toolbar"] as const) {
    test(`11:${surface} - clicking host ${surface} while dirty raises the leave dialog`, async () => {
      await openProseEditor(node(), editor());
      await resetCommitCount(page);
      await page.keyboard.type("Q");

      if (surface === "inspector") await markdownField(page).click();
      if (surface === "tree") {
        await page.locator('[data-sg-tree-node-id="split-1"] .sg-composer-tree-select').first().click();
      }
      if (surface === "toolbar") await page.getByRole("button", { name: "Export JSX", exact: true }).click();

      await expect(dialog()).toBeVisible();
      await expect(canvas(page).locator(DIALOG_ACTION)).toHaveText([
        "Discard changes",
        "Keep editing",
        "Save changes",
      ]);
      // The modal must own the KEYBOARD too. A host-chrome click leaves real
      // focus in the parent document, so the dialog has to pull the frame
      // forward — otherwise Tab keeps walking the host UI behind a modal the
      // keyboard could never answer.
      expect(
        await previewFrame(page).evaluate(() => document.activeElement?.textContent ?? ""),
      ).toBe("Keep editing");
      expect(await page.evaluate(() => document.activeElement?.tagName ?? "")).toBe("IFRAME");

      // The Export modal is a full-viewport host `<dialog>` covering the
      // iframe, so it has to go before the in-canvas dialog is answerable.
      if (surface === "toolbar") {
        await page
          .getByRole("dialog", { name: /Export/ })
          .getByRole("button", { name: "Close", exact: true })
          .click();
      }
      await dialogAction(page, "Discard changes").click();
      await expect(dialog()).toHaveCount(0);
      expect(await commitCount(page)).toBe(0);

      await page.locator(`[data-sg-tree-node-id="${nodeId}"] .sg-composer-tree-select`).first().click();
      await expect(node()).toHaveAttribute("data-zc-selected", "");
    });
  }

  // ── 12 ────────────────────────────────────────────────────────────────────
  test("12 - switching to Preview stashes the draft; Keep editing restores it, then Save commits", async () => {
    await openProseEditor(node(), editor());
    await resetCommitCount(page);
    await page.keyboard.type("CCC");

    const modeToggle = page.locator(".sg-composer-mode-toggle");
    await modeToggle.getByRole("button", { name: "Preview", exact: true }).click();

    // The editable is gone (the canvas rebuilt for Preview) but the draft is
    // not — it lives in the machine until the dialog is answered.
    await expect(editor()).toHaveCount(0);
    await expect(dialog()).toBeVisible();
    expect(await commitCount(page)).toBe(0);

    await dialogAction(page, "Keep editing").click();
    await expect(editor()).toBeVisible();
    expect(await editorText(editor())).toBe("helloAAACCC");
    // Restoring a stashed draft needs Edit-mode chrome back, even though the
    // HOST toggle still says Preview — the canvas overrides it locally.
    await expect(canvas(page).locator('[data-composer-canvas][data-mode="edit"]')).toBeVisible();
    await expect(canvas(page).locator(".zc-insert").first()).toBeVisible();
    await expect(modeToggle.getByRole("button", { name: "Preview", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await saveButton().click();
    await expect(markdownField(page)).toHaveValue("helloAAACCC");
    expect(await commitCount(page)).toBe(1);
    // The local override is dropped the moment the session ends.
    await expect(canvas(page).locator('[data-composer-canvas][data-mode="preview"]')).toBeVisible();

    await modeToggle.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(canvas(page).locator('[data-composer-canvas][data-mode="edit"]')).toBeVisible();
  });

  // ── 13 ────────────────────────────────────────────────────────────────────
  test("13 - the Save button saves without first reading as a click-away", async () => {
    await openProseEditor(node(), editor());
    await resetCommitCount(page);
    await page.keyboard.type("!");

    await saveButton().click();
    // No dialog, ever: the button suppresses its own mousedown, so the focusout
    // that would otherwise be read as leaving never happens.
    await expect(dialog()).toHaveCount(0);
    await expect(editor()).toHaveCount(0);
    await expect(markdownField(page)).toHaveValue("helloAAACCC!");
    expect(await commitCount(page)).toBe(1);
  });

  // ── 14 ────────────────────────────────────────────────────────────────────
  test("14 - the dialog contains Tab, treats ESC as Keep editing, and covers the Save bar", async () => {
    await openProseEditor(node(), editor());
    await resetCommitCount(page);
    await page.keyboard.type("?");
    await page.keyboard.press("Escape");
    await expect(dialog()).toBeVisible();

    // The backdrop is what makes the dialog modal for the POINTER — and the
    // Save bar is not rendered at all beneath it, so there is never a second
    // accent affordance competing with the dialog's own.
    await expect(canvas(page).locator(SAVEBAR)).toHaveCount(0);
    await expect(canvas(page).locator(".zc-prose-dialog-backdrop")).toHaveCSS("position", "fixed");

    const focused = () => previewFrame(page).evaluate(() => document.activeElement?.textContent ?? "");
    expect(await focused()).toBe("Keep editing");
    await page.keyboard.press("Tab");
    expect(await focused()).toBe("Discard changes");
    await page.keyboard.press("Tab");
    expect(await focused()).toBe("Keep editing");
    await page.keyboard.press("Shift+Tab");
    expect(await focused()).toBe("Discard changes");
    // Focus never escaped into the canvas behind the modal.
    expect(await page.evaluate(() => document.activeElement?.tagName ?? "")).toBe("IFRAME");

    await page.keyboard.press("Escape");
    await expect(dialog()).toHaveCount(0);
    await expect(editor()).toBeVisible();
    expect(await editorText(editor())).toBe("helloAAACCC!?");
    expect(await commitCount(page)).toBe(0);

    await saveButton().click();
    await expect(markdownField(page)).toHaveValue("helloAAACCC!?");
  });

  // ── 15 ────────────────────────────────────────────────────────────────────
  test("15 - the Save affordance spends the viewport's one accent and stays neutral on hover", async () => {
    await openProseEditor(node(), editor());
    const clean = await saveButton().evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.keyboard.type("~");
    const dirty = await saveButton().evaluate((el) => getComputedStyle(el).backgroundColor);
    // Loud only once there is something to save.
    expect(dirty).not.toBe(clean);

    // Hover is a neutral wash, never a second accent hue (the project's accent
    // budget forbids accent-on-hover anywhere).
    await saveButton().hover();
    const hovered = await saveButton().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(hovered).not.toBe(dirty);

    // Functional text floor: 14px.
    for (const size of await canvas(page)
      .locator(`${SAVEBAR} *`)
      .evaluateAll((els) => els.map((el) => Number.parseFloat(getComputedStyle(el).fontSize)))) {
      expect(size).toBeGreaterThanOrEqual(14);
    }

    await page.mouse.move(0, 0);
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Escape");
    await expect(editor()).toHaveCount(0);
  });

  // ── 16 ────────────────────────────────────────────────────────────────────
  test("16 - a plain (auto-commit) field is completely unaffected", async () => {
    const split = page.locator('[data-sg-tree-node-id="split-1"] .sg-composer-tree-disclosure').first();
    if ((await split.getAttribute("aria-expanded")) !== "true") await split.click();
    await page.locator('[data-sg-tree-node-id="cta-1"] .sg-composer-tree-select').first().click();

    const cta = canvas(page).locator('[data-zc-node-id="cta-1"]');
    await expect(cta).toHaveAttribute("data-zc-selected", "");
    const plainEditable = canvas(page).locator("[data-zc-inline-editing]");
    await cta.dblclick();
    await expect(plainEditable).toBeVisible();
    await expect(plainEditable).toBeFocused();

    // The plain session edits the COMPONENT's own text region — no source
    // editor, and none of this epic's chrome.
    await expect(canvas(page).locator(EDITOR)).toHaveCount(0);
    await expect(canvas(page).locator(SAVEBAR)).toHaveCount(0);
    await expect(plainEditable).toContainText("Get started");

    // …and Enter still auto-commits, exactly as before.
    await page.keyboard.press("Control+A");
    await page.keyboard.type("Get building");
    await expect(plainEditable).toContainText("Get building");
    await page.keyboard.press("Enter");
    await expect(canvas(page).locator("[data-zc-inline-editing]")).toHaveCount(0);
    await expect(page.locator("#sg-composer-inspector").getByLabel("Label")).toHaveValue(
      "Get building",
    );
  });

  // ── 17 ────────────────────────────────────────────────────────────────────
  test("17 - a saved draft survives a full reload of the composer", async () => {
    await page.locator(`[data-sg-tree-node-id="${nodeId}"] .sg-composer-tree-select`).first().click();
    await expect(node()).toHaveAttribute("data-zc-selected", "");
    await openProseEditor(node(), editor());
    await page.keyboard.type("\n\n## Persisted heading");
    await saveButton().click();
    const saved = "helloAAACCC!?\n\n## Persisted heading";
    await expect(markdownField(page)).toHaveValue(saved);

    await page.reload();
    await expect(canvas(page).locator("[data-composer-canvas]")).toBeVisible({ timeout: 15_000 });
    await page.locator(`[data-sg-tree-node-id="${nodeId}"] .sg-composer-tree-select`).first().click();
    await expect(markdownField(page)).toHaveValue(saved);
    await expect(node().locator(".zc-prose-md h2")).toHaveText("Persisted heading");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // ── 18 ────────────────────────────────────────────────────────────────────
  test("18 - rendered prose typography is token-bound and re-themes between light and dark", async () => {
    const block = node().locator(".zc-prose-md");
    await setMarkdown(
      page,
      node(),
      "## Heading\n\nBody with [a link](https://example.com).\n\n> Quoted.\n\n```ts\nexport const x = 1;\n```\n",
      "Quoted.",
    );
    await expect(block.locator("pre.hi-root")).toHaveCount(1);

    const sample = () =>
      block.evaluate((root) => {
        const read = (selector: string, props: string[]) => {
          const el = root.querySelector(selector);
          if (!el) return null;
          const style = getComputedStyle(el);
          return Object.fromEntries(props.map((p) => [p, style.getPropertyValue(p)]));
        };
        return {
          theme: root.ownerDocument.documentElement.getAttribute("data-theme"),
          h2: read("h2", ["color", "font-size", "border-bottom-color"]),
          p: read("p", ["color", "font-size"]),
          a: read("a", ["color"]),
          blockquote: read("blockquote", ["color", "border-left-color"]),
          pre: read("pre.hi-root", ["background-color", "color"]),
        };
      });

    const themeToggle = page.getByRole("button", { name: /Switch to (dark|light) mode/ }).first();
    const light = await sample();
    await themeToggle.click();
    await expect(canvas(page).locator("html[data-theme='dark']")).toBeAttached();
    const dark = await sample();

    expect(light.theme).toBe("light");
    expect(dark.theme).toBe("dark");
    // Every colour role re-themes; sizes do not.
    for (const key of ["h2", "p", "a", "blockquote", "pre"] as const) {
      const lightValues = light[key]!;
      const darkValues = dark[key]!;
      expect(lightValues.color, `${key} color must re-theme`).not.toBe(darkValues.color);
    }
    expect(light.h2!["font-size"]).toBe(dark.h2!["font-size"]);
    expect(light.h2!["border-bottom-color"]).not.toBe(dark.h2!["border-bottom-color"]);
    expect(light.blockquote!["border-left-color"]).not.toBe(dark.blockquote!["border-left-color"]);
    expect(light.pre!["background-color"]).not.toBe(dark.pre!["background-color"]);

    await themeToggle.click();
    await expect(canvas(page).locator("html[data-theme='light']")).toBeAttached();
  });

  // ── 19 ────────────────────────────────────────────────────────────────────
  test("19 - fence token colours follow the theme in the composer canvas", async () => {
    // NOTE (issue raised as `agent-found`): inside BOTH preview iframes the
    // `--zfb-hi-*` bridge shipped by @takazudo/zudo-doc/features.css resolves
    // to nothing, because that bridge is defined in terms of the doc-chrome
    // `--zd-syntax-*` tokens and the chrome-free preview documents have no
    // `--zd-*` injected. Every `hi-*` span therefore INHERITS the code block's
    // colour instead of getting its own. This test pins what is actually true
    // today — the tokens re-theme with the document — and deliberately does not
    // pretend the fence is multi-coloured; tighten it when the bridge reaches
    // the preview scope.
    // A fence rich enough to carry every token class under test — the previous
    // step's one-liner has no string or call in it.
    await setMarkdown(
      page,
      node(),
      "```ts\nexport function greet(name: string): string {\n  return `Hi, ${name}!`;\n}\n```\n",
      "greet",
    );

    const tokens = () =>
      canvas(page)
        .locator("pre.hi-root")
        .evaluate((pre) => {
          const out: Record<string, string | null> = {};
          for (const name of ["hi-kw", "hi-str", "hi-var", "hi-punct"]) {
            const el = pre.querySelector(`.${name}`);
            out[name] = el ? getComputedStyle(el).color : null;
          }
          return out;
        });

    const themeToggle = page.getByRole("button", { name: /Switch to (dark|light) mode/ }).first();
    const light = await tokens();
    await themeToggle.click();
    await expect(canvas(page).locator("html[data-theme='dark']")).toBeAttached();
    const dark = await tokens();

    for (const name of Object.keys(light)) {
      expect(light[name], `${name} must be painted in light mode`).toBeTruthy();
      expect(dark[name], `${name} must be painted in dark mode`).toBeTruthy();
      expect(light[name], `${name} must not be baked to one theme`).not.toBe(dark[name]);
    }

    await themeToggle.click();
    await expect(canvas(page).locator("html[data-theme='light']")).toBeAttached();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
