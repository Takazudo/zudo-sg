import { test, expect, type Page, type FrameLocator, type Locator } from "@playwright/test";
import {
  inspectComposerDatabase,
  invalidateComposerConnection,
  openComposerLibrary,
  openComposerRecord,
  prepareLegacyMigration,
  replaceComposerRecords,
} from "./support/composer-persistence";

// ---------------------------------------------------------------------------
// Composer end-to-end confirmation (#252) — Wave 10, final.
//
// AUTHORED DEFENSIVELY: this spec was written by reading the production
// source (renderer.ts, controller-model.ts, composer-*.tsx under
// src/features/composer/**) and the native sample (src/composer/sample/
// sample-document.ts) rather than by driving a live browser — the author
// agent's environment forbids browser tooling. It is expected to be
// MANAGER-VALIDATED and may need selector tweaks against the actually-built
// DOM. Prefer ARIA roles/labels, visible text, and the app's own
// `data-composer-shell` / `data-sg-*` / `data-zc-*` attributes throughout —
// every selector below was cross-checked against the component that renders
// it (see the referenced files in comments) rather than invented.
//
// Structure:
//   - `Composer 14-step walkthrough` (serial, one shared `page`) covers
//     steps 1-6 and 8-13. Steps that mutate global load state (7: reload/
//     reset/malformed/quarantined/blocked storage) run in their own
//     isolated-page describe block below so a storage-recovery scenario
//     never has to fight the shared walkthrough's document state.
//   - `Composer storage & recovery matrix` covers step 7 plus the
//     opaque-node export-block half of step 8 (needs a hand-seeded document,
//     which only makes sense on a fresh page).
//   - `Composer SPA navigation guard` covers step 14 in isolation (needs a
//     deterministically "unsaved" document, achieved via a blocked-storage
//     write — see that test's comment).
//   - `Composer lightweight responsive + protocol checks` adds a couple of
//     cheap, deterministic supplemental checks explicitly permitted by the
//     issue ("a genuine responsive/a11y assertion... as a deterministic
//     computed-style check"). The FULL 5-width x 2-theme screenshot matrix
//     and verify-ui pass are the MANAGER's job, not this spec's.
//
// Known deliberately-NOT-covered-in-depth items (left to the manager's
// central checks / `verify-ui` pass, per the issue's resource-coordination
// split):
//   - the full responsive/a11y matrix (1440/1024/1023/768/390 x light/dark)
//   - iframe wrong-source/origin/stale-message rejection (unit-tested under
//     src/features/composer/preview/__tests__/bridge*.test.ts already)
//   - the "same-slot index adjustment" half of drag & drop (unit-tested
//     under src/features/composer/chrome/__tests__/controller-model-drop.
//     test.ts) — this spec's drag test focuses on the walkthrough's explicit
//     cross-slot + before-first + Alt-copy contract
//   - a genuine stale-revision race for inline-edit/drop (would require
//     deliberately racing the postMessage bridge; out of scope here)
//
// Drag & drop technique: native OS-level HTML5 drag gestures are not
// reliably simulatable in headless CI. Instead this spec manually dispatches
// the exact `DragEvent`s (`dragstart` -> `dragenter`/`dragover` -> `drop` ->
// `dragend`) the renderer listens for (see renderer.ts's "Drag & drop (issue
// #258)" section), carrying a real `DataTransfer` stashed on `window`
// between dispatch calls (a fresh `Locator.evaluate()` call re-enters the
// frame's JS realm each time, so the DataTransfer instance must be stashed
// somewhere that survives between calls). The renderer defers its
// `dragstart` state mutation to a macrotask (Chromium cancels a synchronous
// native drag otherwise) — this spec waits on the resulting `data-zc-
// dragging` attribute rather than an arbitrary timeout.
//
// IME technique: composing state is simulated by dispatching a real
// `compositionstart` event, then a `keydown` whose read-only `isComposing`
// getter is overridden via `Object.defineProperty` before dispatch — this
// exercises the renderer's actual `event.isComposing` guard directly (see
// renderer.ts's inline-editing `onKeyDown`), rather than relying on
// `Event` constructor init dicts that do not reliably expose it.
// ---------------------------------------------------------------------------

const TREE_WIDTH_KEY = "sg-composer-tree-width";
const CANVAS_IFRAME_SELECTOR = ".sg-composer-canvas-frame iframe";
const CHOOSER_PREVIEW_IFRAME_SELECTOR = 'iframe[title="Composer chooser live preview"]';
// Top-level tree rows only — excludes nested `<ul class="sg-composer-tree-list
// sg-composer-tree-list-nested">` lists inside expanded slots (see
// ComposerTree / TreeNode under src/features/composer/ui/tree/).
const TOP_LEVEL_TREE_ROWS = "ul.sg-composer-tree-list:not(.sg-composer-tree-list-nested) > li";

declare global {
  interface Window {
    __e2eDragDT?: DataTransfer;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function canvasFrame(page: Page): FrameLocator {
  return page.frameLocator(CANVAS_IFRAME_SELECTOR);
}

function chooserPreviewFrame(page: Page): FrameLocator {
  return page.frameLocator(CHOOSER_PREVIEW_IFRAME_SELECTOR);
}

function chooserDialog(page: Page): Locator {
  return page.locator("dialog.sg-composer-chooser");
}

/**
 * The Export JSX modal, scoped by its accessible name ("Export — <doc name>").
 * Kept name-scoped rather than a bare `getByRole("dialog")` even though the
 * closed chooser `<dialog.sg-composer-chooser>` no longer renders as a
 * strict-mode collision candidate: it used to stay `display:flex` (not the
 * UA `display:none`) while closed, because the chooser's own CSS set
 * `display:flex` unconditionally rather than gating it on `[open]` — fixed
 * in #264 (`src/features/composer/styles.css`'s `.sg-composer-chooser[open]`
 * rule). Scoping by name is still the more precise selector regardless.
 */
function exportModal(page: Page): Locator {
  return page.getByRole("dialog", { name: /Export/ });
}

function contextMenu(page: Page): Locator {
  return page.locator(".sg-composer-menu");
}

function treeNode(page: Page, nodeId: string): Locator {
  return page.locator(`[data-sg-tree-node-id="${nodeId}"]`);
}

function topLevelTreeRows(page: Page): Locator {
  return page.locator(TOP_LEVEL_TREE_ROWS);
}

/** Navigate to `/composer` and wait for the real preview canvas to mount. */
async function gotoComposer(page: Page): Promise<void> {
  await openComposerRecord(page);
}

/** The single tree row currently showing `aria-pressed="true"` on its select button. */
async function selectedTreeNodeId(page: Page): Promise<string> {
  // `<li class="sg-composer-tree-node">` rows nest (a slot's children are
  // descendant rows), so a `.filter({ has: pressed-select })` on the row
  // matches every ANCESTOR row too — when a nested node is selected the count
  // is >1. Target the globally-unique pressed select button itself and read
  // its OWN owning row's id via the closest node ancestor.
  const pressed = page.locator('.sg-composer-tree-select[aria-pressed="true"]');
  await expect(pressed).toHaveCount(1);
  const id = await pressed.evaluate(
    (el) => el.closest("[data-sg-tree-node-id]")?.getAttribute("data-sg-tree-node-id") ?? "",
  );
  if (!id) throw new Error("Selected tree row has no data-sg-tree-node-id");
  return id;
}

/** The single canvas node currently carrying `data-zc-selected` (renderer.ts). */
async function selectedCanvasNodeId(frame: FrameLocator): Promise<string> {
  const el = frame.locator("[data-zc-selected]");
  await expect(el).toHaveCount(1);
  const id = await el.getAttribute("data-zc-node-id");
  if (!id) throw new Error("Selected canvas node has no data-zc-node-id");
  return id;
}

/**
 * Opens a canvas node's inline editor and returns only once the contenteditable
 * is genuinely ready for keystrokes.
 *
 * The double-click opens the inline session synchronously, but the renderer
 * places the editable's text node, moves focus into it, and sets the caret in
 * an async `useLayoutEffect` that runs AFTER a keyed-body REMOUNT (renderer.ts's
 * inline session). The `data-zc-inline-editing` attribute this `editable`
 * locator keys on is set at the TOP of that effect — so on a CPU-starved CI
 * runner the attribute (and thus a bare `toBeVisible()`) can resolve a beat
 * before `el.focus()` lands. A `Control+A`/`type` fired in that window silently
 * targets nothing, the field keeps its seed value, and the later commit records
 * the UNCHANGED text — precisely the #252 step-11 CI flake. Gating on visible
 * AND focused guarantees subsequent keystrokes reach the live editable.
 */
async function openInlineEditor(nodeLocator: Locator, editable: Locator): Promise<void> {
  await nodeLocator.dblclick();
  await expect(editable).toBeVisible();
  await expect(editable).toBeFocused();
}

interface AddViaChooserOptions {
  /** Clicks whatever "+ Add" affordance should open the chooser for this target. */
  open: () => Promise<void>;
  /** Substring expected in ".sg-composer-chooser-target" (composer-chooser.tsx). */
  targetText: string | RegExp;
  search: string;
  cardName: string;
}

/** Opens the shared chooser, searches, and confirms one card — leaves the added node selected. */
async function addViaChooser(page: Page, opts: AddViaChooserOptions): Promise<void> {
  await opts.open();
  const dialog = chooserDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".sg-composer-chooser-target")).toContainText(opts.targetText);
  await dialog.getByPlaceholder("Search components…").fill(opts.search);
  const card = dialog.getByRole("button", { name: opts.cardName, exact: true });
  await expect(card).toBeVisible();
  await card.click();
  await expect(dialog).not.toBeVisible();
}

/**
 * Drives a cross-slot canvas drag & drop by dispatching the exact DragEvents
 * the renderer listens for (see this file's header comment). `targetKey` is
 * the insert point's `${parentId}:${slotId}:${index}` key — the SAME string
 * the renderer stamps on the insert button's `data-zc-insert` attribute
 * (renderer.ts's `insertPoint()`).
 */
async function dragToInsertPoint(
  frame: FrameLocator,
  sourceGripSelector: string,
  targetKey: string,
  opts: { altKey?: boolean } = {},
): Promise<void> {
  const altKey = opts.altKey ?? false;
  const source = frame.locator(sourceGripSelector);
  const targetButton = frame.locator(`[data-zc-insert="${targetKey}"]`);
  const targetGroup = targetButton.locator("xpath=..");

  // Capture the grip as a stable handle NOW. An Alt-copy drop reselects the new
  // clone, which unmounts the SOURCE node's grip (grips render only on the
  // selected node) — so by `dragend` a fresh `source` locator can no longer
  // resolve. A handle keeps referencing the (now-detached) node, and Preact's
  // onDragEnd listener still fires on it, so `endDrag` runs and the drag state
  // clears deterministically regardless of drop-apply timing (issue #258).
  await expect(source).toBeVisible();
  const sourceHandle = await source.elementHandle();
  if (!sourceHandle) throw new Error("drag source grip could not be resolved");

  await sourceHandle.evaluate((el) => {
    const dt = new DataTransfer();
    window.__e2eDragDT = dt;
    el.dispatchEvent(
      new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }),
    );
  });

  // The renderer defers its dragActive state mutation to a macrotask — wait
  // on the resulting attribute rather than an arbitrary timeout.
  await expect(frame.locator("[data-zc-dragging]")).toBeAttached();

  await targetButton.evaluate((el, altKeyArg) => {
    const dt = window.__e2eDragDT;
    if (!dt) throw new Error("drag DataTransfer was not stashed on window");
    const init: DragEventInit = { bubbles: true, cancelable: true, dataTransfer: dt, altKey: altKeyArg };
    el.dispatchEvent(new DragEvent("dragenter", init));
    el.dispatchEvent(new DragEvent("dragover", init));
  }, altKey);

  // Drop-target highlighting is advisory/renderer-drawn — live before the drop.
  await expect(targetGroup).toHaveAttribute("data-zc-drop-active", "");

  await targetButton.evaluate((el, altKeyArg) => {
    const dt = window.__e2eDragDT;
    if (!dt) throw new Error("drag DataTransfer was not stashed on window");
    el.dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt, altKey: altKeyArg }),
    );
  }, altKey);

  await sourceHandle.evaluate((el) => el.dispatchEvent(new DragEvent("dragend", { bubbles: true })));
  await expect(frame.locator("[data-zc-dragging]")).not.toBeAttached();
  await sourceHandle.dispose();
}

// ---------------------------------------------------------------------------
// Steps 1-6, 8-13 — one shared session, mirroring the fixed walkthrough.
// ---------------------------------------------------------------------------

test.describe.serial("Composer 14-step walkthrough (#252) — steps 1-6, 8-13", () => {
  let page: Page;
  const pageErrors: string[] = [];
  const failedResponses: string[] = [];

  // Dynamic ids captured along the way (see each step's comment for what
  // they refer to). The native sample's OWN node ids are stable literal
  // strings (split-1 / heading-1 / stack-1 / prose-1 / prose-2 / cta-1 — see
  // src/composer/sample/sample-document.ts) and are referenced directly.
  let splitId = "";
  let aId = "";
  let bId = "";
  let cId = "";
  let insertedId = "";

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("response", (res) => {
      if (res.status() >= 400) failedResponses.push(`${res.status()} ${res.url()}`);
    });
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ── Step 1 ─────────────────────────────────────────────────────────────
  test("step 01 - loads /composer with the real shared header and native production sample", async () => {
    await gotoComposer(page);

    // Shared header (pages/lib/_header-with-defaults.tsx -> @takazudo/zudo-doc
    // Header — the <header> carries a stable `data-header` attribute).
    const header = page.locator("header[data-header]");
    await expect(header).toBeVisible();
    await expect(header.locator("nav[data-header-nav]").getByRole("link", { name: "Composer" })).toBeVisible();

    // No docs-route chrome on this bespoke document shell (pages/composer/
    // index.tsx's header comment: no sidebar/TOC/footer/padded article band).
    await expect(page.locator("#desktop-sidebar")).toHaveCount(0);
    await expect(page.locator("#sg-code-panel")).toHaveCount(0);
    await expect(page.locator("footer")).toHaveCount(0);

    // Composer shell + native sample loaded (document name "Product overview" —
    // sample-document.ts).
    await expect(page.locator(".sg-composer-toolbar")).toContainText("Product overview");
    await expect(topLevelTreeRows(page)).toHaveCount(1);
    await expect(treeNode(page, "split-1")).toBeVisible();

    // The canvas renders REAL production components, not placeholders — the
    // sample's SectionHeading heading and CtaButton label are visible text
    // inside the iframe.
    const frame = canvasFrame(page);
    await expect(frame.locator('[data-composer-canvas][data-mode="edit"]')).toBeVisible();
    await expect(frame.getByText("Compose real components")).toBeVisible();
    await expect(frame.getByText("Get started")).toBeVisible();
  });

  // ── Step 2 ─────────────────────────────────────────────────────────────
  test("step 02 - adds SplitLayout at the virtual document root", async () => {
    await addViaChooser(page, {
      open: () => page.getByRole("button", { name: "Add component to document root" }).click(),
      targetText: "Document root",
      search: "SplitLayout",
      cardName: "SplitLayout",
    });
    splitId = await selectedTreeNodeId(page);
    await expect(topLevelTreeRows(page)).toHaveCount(2);
  });

  // ── Step 3 ─────────────────────────────────────────────────────────────
  test("step 03 - adds one component to its left slot, then B and C to its right slot", async () => {
    const splitRow = treeNode(page, splitId);
    await splitRow.locator(".sg-composer-tree-disclosure").first().click();

    const leftAdd = splitRow.locator(
      '[data-sg-tree-slot-id="left"] > .sg-composer-tree-slot-header .sg-composer-tree-add',
    );
    const rightAdd = splitRow.locator(
      '[data-sg-tree-slot-id="right"] > .sg-composer-tree-slot-header .sg-composer-tree-add',
    );

    await addViaChooser(page, {
      open: () => leftAdd.first().click(),
      targetText: "Left",
      search: "PlaceholderBox",
      cardName: "PlaceholderBox",
    });
    aId = await selectedTreeNodeId(page);

    await addViaChooser(page, {
      open: () => rightAdd.first().click(),
      targetText: "Right",
      search: "PlaceholderBox",
      cardName: "PlaceholderBox",
    });
    bId = await selectedTreeNodeId(page);

    await addViaChooser(page, {
      open: () => rightAdd.first().click(),
      targetText: "Right",
      search: "PlaceholderBox",
      cardName: "PlaceholderBox",
    });
    cId = await selectedTreeNodeId(page);

    expect(new Set([splitId, aId, bId, cId]).size).toBe(4);
  });

  // ── Step 4 ─────────────────────────────────────────────────────────────
  test("step 04 - asserts named-slot nesting/order in structure, canvas, and JSX export", async () => {
    const splitRow = treeNode(page, splitId);

    const leftChildren = splitRow.locator('[data-sg-tree-slot-id="left"] > ul.sg-composer-tree-list > li');
    await expect(leftChildren).toHaveCount(1);
    await expect(leftChildren.first()).toHaveAttribute("data-sg-tree-node-id", aId);

    const rightChildren = splitRow.locator('[data-sg-tree-slot-id="right"] > ul.sg-composer-tree-list > li');
    await expect(rightChildren).toHaveCount(2);
    await expect(rightChildren.nth(0)).toHaveAttribute("data-sg-tree-node-id", bId);
    await expect(rightChildren.nth(1)).toHaveAttribute("data-sg-tree-node-id", cId);

    // Canvas DOM order: left slot's A precedes right slot's B, which precedes C
    // (SplitLayout renders `left` then `right` — packages/ui/.../split-layout.tsx).
    const frame = canvasFrame(page);
    const ids = await frame
      .locator("[data-zc-node-id]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-zc-node-id")));
    const idx = (id: string) => ids.indexOf(id);
    expect(idx(aId)).toBeGreaterThanOrEqual(0);
    expect(idx(aId)).toBeLessThan(idx(bId));
    expect(idx(bId)).toBeLessThan(idx(cId));

    // JSX export mirrors the same document/manifest the canvas renders from.
    await page.getByRole("button", { name: "Export JSX", exact: true }).click();
    const dialog = exportModal(page);
    await expect(dialog).toBeVisible();
    const code = await dialog.locator("pre code").innerText();
    expect(code).toContain("SplitLayout");
    expect(code).toContain("left=");
    expect(code).toContain("right=");
    expect((code.match(/PlaceholderBox/g) ?? []).length).toBeGreaterThanOrEqual(3);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(dialog).not.toBeVisible();
  });

  // ── Step 5 ─────────────────────────────────────────────────────────────
  test("step 05 - select from tree/canvas, edit a scalar prop, move a sibling, remove a subtree with confirmation", async () => {
    const frame = canvasFrame(page);

    // 5a: select C from the CANVAS; the host tree stays in sync.
    await frame.locator(`[data-zc-node-id="${cId}"]`).click();
    await expect(frame.locator(`[data-zc-node-id="${cId}"][data-zc-selected]`)).toBeVisible();
    expect(await selectedTreeNodeId(page)).toBe(cId);

    // 5b: edit a scalar prop via the inspector — reflected live on the canvas + tree.
    const labelField = page.locator("#sg-composer-inspector").getByLabel("Label");
    await labelField.fill("Box C");
    await expect(frame.locator(`[data-zc-node-id="${cId}"]`).getByRole("img", { name: "Box C" })).toBeVisible();
    await expect(treeNode(page, cId).locator(".sg-composer-tree-select-subtitle")).toHaveText("Box C");

    // 5c: move C up within its own slot (right: B, C -> C, B).
    await treeNode(page, cId)
      .getByRole("button", { name: /^Move .* up$/ })
      .click();
    const splitRow = treeNode(page, splitId);
    const rightChildren = splitRow.locator('[data-sg-tree-slot-id="right"] > ul.sg-composer-tree-list > li');
    await expect(rightChildren.nth(0)).toHaveAttribute("data-sg-tree-node-id", cId);
    await expect(rightChildren.nth(1)).toHaveAttribute("data-sg-tree-node-id", bId);

    // 5d: remove the whole SplitLayout subtree (3 descendants) — requires confirmation,
    // then repairs selection safely (no crash, no dangling selection).
    await splitRow.getByRole("button", { name: "Remove SplitLayout" }).click();
    const confirm = splitRow.locator(".sg-composer-tree-confirm");
    await expect(confirm).toContainText("Remove SplitLayout and its 3 nested components?");
    // Initial focus lands on the SAFE action (Cancel), unified with the
    // context-menu Delete confirmation and the toolbar Reset confirm
    // (issue #260/#269).
    await expect(confirm.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    await confirm.getByRole("button", { name: "Confirm removal", exact: true }).click();

    await expect(treeNode(page, splitId)).toHaveCount(0);
    await expect(frame.locator(`[data-zc-node-id="${splitId}"]`)).toHaveCount(0);
    await expect(frame.locator(`[data-zc-node-id="${aId}"]`)).toHaveCount(0);
    await expect(frame.locator(`[data-zc-node-id="${bId}"]`)).toHaveCount(0);
    await expect(frame.locator(`[data-zc-node-id="${cId}"]`)).toHaveCount(0);
    // Back to just the native sample's own root node.
    await expect(topLevelTreeRows(page)).toHaveCount(1);
    await expect(treeNode(page, "split-1")).toBeVisible();
  });

  // ── Step 6 ─────────────────────────────────────────────────────────────
  test("step 06 - Preview hides editor chrome and activates real controls; Edit returns with state intact", async () => {
    // The native sample's split-1 is collapsed in the host tree at this point
    // (step 05 removed the *added* SplitLayout; native split-1 was never
    // expanded), so cta-1's and heading-1's rows aren't rendered yet. Expand
    // split-1 so its direct slot children (heading-1 in Left, cta-1 in Right)
    // become selectable from the tree. Guarded so it never toggles closed.
    const split1Disclosure = treeNode(page, "split-1")
      .locator(".sg-composer-tree-disclosure")
      .first();
    if ((await split1Disclosure.getAttribute("aria-expanded")) !== "true") {
      await split1Disclosure.click();
    }

    // Select a node in Edit mode first, to prove the SAME selection/values
    // survive the Edit <-> Preview round trip.
    await treeNode(page, "cta-1").locator(".sg-composer-tree-select").first().click();
    expect(await selectedTreeNodeId(page)).toBe("cta-1");

    const frame = canvasFrame(page);
    await expect(frame.locator(".zc-insert").first()).toBeVisible();

    const modeToggle = page.locator(".sg-composer-mode-toggle");
    await modeToggle.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(frame.locator('[data-composer-canvas][data-mode="preview"]')).toBeVisible();

    // Editor-only affordances disappear entirely.
    await expect(frame.locator(".zc-insert")).toHaveCount(0);
    await expect(frame.locator(".zc-chrome-menu")).toHaveCount(0);
    await expect(frame.locator(".zc-chrome-grip")).toHaveCount(0);

    // Inspector stays visible (same selection) but becomes read-only.
    await expect(page.locator('[data-sg-inspector-state="editable"]')).toBeVisible();
    await expect(page.getByText("Preview mode — properties are read-only.")).toBeVisible();
    await expect(page.locator("#sg-composer-inspector").getByLabel("Label")).toBeDisabled();

    // The structure tree stays navigable in Preview — selecting a DIFFERENT
    // node still works even though editing is disabled.
    await treeNode(page, "heading-1").locator(".sg-composer-tree-select").first().click();
    expect(await selectedTreeNodeId(page)).toBe("heading-1");

    // Rendered controls activate normally in Preview: clicking a canvas node
    // does NOT re-select it (editor selection is Edit-only).
    await frame.locator('[data-zc-node-id="cta-1"]').click();
    expect(await selectedTreeNodeId(page)).toBe("heading-1");

    // Edit returns with state intact.
    await modeToggle.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(frame.locator('[data-composer-canvas][data-mode="edit"]')).toBeVisible();
    expect(await selectedTreeNodeId(page)).toBe("heading-1");
  });

  // ── Step 8 (export half — the opaque-block half lives in the storage matrix below) ──
  test("step 08 - export/copy JSX source matches current props/order/slots and imports", async () => {
    await page.getByRole("button", { name: "Export JSX", exact: true }).click();
    const dialog = exportModal(page);
    await expect(dialog).toBeVisible();
    const code = await dialog.locator("pre code").innerText();

    expect(code).toContain("SplitLayout");
    expect(code).toContain("SectionHeading");
    expect(code).toContain("Stack");
    expect(code).toContain("ProseP");
    expect(code).toContain("CtaButton");
    expect(code).toContain("Compose real components");
    expect(code).toContain("Get started");

    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(dialog).not.toBeVisible();
  });

  // ── Step 9 ─────────────────────────────────────────────────────────────
  test("step 09 - inserts a component BEFORE the first child of a populated slot via a canvas insert point", async () => {
    const frame = canvasFrame(page);
    // "Right, position 1" = index 0 of split-1's right slot (which currently
    // holds [stack-1, cta-1]) — see renderer.ts's insertPoint()'s `position`.
    const insertBtn = frame.getByRole("button", { name: "Add component to Right, position 1" });
    await insertBtn.click();

    const dialog = chooserDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".sg-composer-chooser-target")).toContainText("SplitLayout");
    await expect(dialog.locator(".sg-composer-chooser-target")).toContainText("Right");
    await dialog.getByPlaceholder("Search components…").fill("PlaceholderBox");
    await dialog.getByRole("button", { name: "PlaceholderBox", exact: true }).click();
    await expect(dialog).not.toBeVisible();

    // Cross-frame focus restore (issue #256 protocol note): the Add dialog
    // returns focus to the CANVAS IFRAME it was opened from.
    const canvasFocused = await page.evaluate(
      (sel) => document.activeElement === document.querySelector(sel),
      CANVAS_IFRAME_SELECTOR,
    );
    expect(canvasFocused).toBe(true);

    insertedId = await selectedCanvasNodeId(frame);

    const rightChildren = treeNode(page, "split-1").locator(
      '[data-sg-tree-slot-id="right"] > ul.sg-composer-tree-list > li',
    );
    await expect(rightChildren).toHaveCount(3);
    await expect(rightChildren.nth(0)).toHaveAttribute("data-sg-tree-node-id", insertedId);
    await expect(rightChildren.nth(1)).toHaveAttribute("data-sg-tree-node-id", "stack-1");
    await expect(rightChildren.nth(2)).toHaveAttribute("data-sg-tree-node-id", "cta-1");

    const ids = await frame
      .locator("[data-zc-node-id]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-zc-node-id")));
    expect(ids.indexOf(insertedId)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(insertedId)).toBeLessThan(ids.indexOf("stack-1"));

    await page.getByRole("button", { name: "Export JSX", exact: true }).click();
    const exportDialog = exportModal(page);
    await expect(exportDialog).toBeVisible();
    const code = await exportDialog.locator("pre code").innerText();
    // Order-check the JSX BODY only: the import block is sorted by module path
    // (CtaButton's import precedes Stack's), so a whole-string indexOf would
    // read import order, not render order. Slice from `return (` onward.
    const body = code.slice(code.indexOf("return ("));
    expect(body.indexOf("PlaceholderBox")).toBeGreaterThanOrEqual(0);
    expect(body.indexOf("PlaceholderBox")).toBeLessThan(body.indexOf("Stack"));
    expect(body.indexOf("Stack")).toBeLessThan(body.indexOf("CtaButton"));
    await exportDialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(exportDialog).not.toBeVisible();
  });

  // ── Step 10 ────────────────────────────────────────────────────────────
  test("step 10 - chooser hover shows a live preview with slot placeholders and movable tool-dialog geometry", async () => {
    await page.getByRole("button", { name: "Add component to document root" }).click();
    const dialog = chooserDialog(page);
    await expect(dialog).toBeVisible();

    await expect(dialog.locator(".sg-composer-chooser-preview-empty")).toBeVisible();

    const splitCard = dialog.getByRole("button", { name: "SplitLayout", exact: true });
    await expect(splitCard).toBeVisible();
    await splitCard.hover();

    await expect(dialog.locator(".sg-composer-chooser-preview-empty")).toHaveCount(0);
    // SplitLayout declares 2 slots (left single, right many) -> one PlaceholderBox
    // placeholder per slot in the live preview (chooser-preview-host.tsx).
    await expect(chooserPreviewFrame(page).getByRole("img", { name: "hero-image.png" })).toHaveCount(2);

    const grip = dialog.getByRole("button", { name: "Move dialog", exact: true });
    await expect(grip).toBeVisible();
    await expect(dialog.locator(".sg-composer-chooser-enlarge")).toHaveCount(0);
    await expect(dialog).not.toHaveAttribute("data-sg-enlarged");
    const beforeBox = await dialog.boundingBox();
    const viewport = page.viewportSize();
    if (beforeBox && viewport) {
      expect(beforeBox.x).toBeCloseTo(24, 0);
      expect(beforeBox.y).toBeCloseTo(24, 0);
      expect(beforeBox.width).toBeCloseTo(viewport.width - 48, 0);
      expect(beforeBox.height).toBeCloseTo(viewport.height - 48, 0);
    }

    // Keyboard movement documents Arrow/Shift behavior, preserves size, and
    // Home returns to the fresh-open default without closing the modal.
    await grip.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");
    const movedBox = await dialog.boundingBox();
    if (beforeBox && movedBox) {
      expect(movedBox.width).toBeCloseTo(beforeBox.width, 0);
      expect(movedBox.height).toBeCloseTo(beforeBox.height, 0);
      expect(movedBox.x).toBeGreaterThan(beforeBox.x);
      expect(movedBox.y).toBeGreaterThan(beforeBox.y);
    }
    await page.keyboard.press("Home");
    const resetBox = await dialog.boundingBox();
    if (beforeBox && resetBox) {
      expect(resetBox.x).toBeCloseTo(beforeBox.x, 0);
      expect(resetBox.y).toBeCloseTo(beforeBox.y, 0);
      expect(resetBox.width).toBeCloseTo(beforeBox.width, 0);
      expect(resetBox.height).toBeCloseTo(beforeBox.height, 0);
    }

    await dialog.locator(".sg-composer-chooser-cancel").click();
    await expect(dialog).not.toBeVisible();
  });

  // ── Step 11 ────────────────────────────────────────────────────────────
  test("step 11 - inline-edits a flagged text field on the canvas (commit/cancel/IME/blur) and the inspector reflects it", async () => {
    // Regression guard for a #252-confirmation fix: inline-editing CtaButton's
    // `label` used to PREPEND ("Get building" → "Get buildingGet started")
    // because its editable ends in a `contenteditable="false"` decoration (the
    // trailing "→" arrow) and `placeCaretAtEnd` collapsed to the raw contents
    // end — after the arrow — which the browser bounced to offset 0. Fixed in
    // renderer.ts by collapsing to the last EDITABLE text node instead.
    await treeNode(page, "cta-1").locator(".sg-composer-tree-select").first().click();
    expect(await selectedTreeNodeId(page)).toBe("cta-1");

    const frame = canvasFrame(page);
    const ctaNode = frame.locator('[data-zc-node-id="cta-1"]');
    const editable = frame.locator("[data-zc-inline-editing]");
    const labelField = page.locator("#sg-composer-inspector").getByLabel("Label");

    // The tree-selection above bridges host→iframe asynchronously; wait for the
    // CANVAS node to actually reflect it so edit-entry never races a stale
    // renderer `selectedId` (a click-again entry keys off `selectedId`).
    await expect(ctaNode).toHaveAttribute("data-zc-selected", "");

    // Commit via Enter.
    await openInlineEditor(ctaNode, editable);
    await expect(editable).toHaveAttribute("contenteditable", "plaintext-only");
    // The layout effect seeds the field with its current value — wait for it so
    // Control+A selects real content, not an empty field.
    await expect(editable).toContainText("Get started");
    await page.keyboard.press("Control+A");
    await page.keyboard.type("Get building");
    // Confirm the keystrokes actually landed BEFORE committing — a raced type
    // would otherwise commit the unchanged seed value (the #252 step-11 flake).
    await expect(editable).toContainText("Get building");
    await page.keyboard.press("Enter");
    await expect(frame.locator("[data-zc-inline-editing]")).toHaveCount(0);
    await expect(ctaNode).toContainText("Get building");
    await expect(labelField).toHaveValue("Get building");

    // Cancel via Escape.
    await openInlineEditor(ctaNode, editable);
    await page.keyboard.press("Control+A");
    await page.keyboard.type("Should not persist");
    await expect(editable).toContainText("Should not persist");
    await page.keyboard.press("Escape");
    await expect(frame.locator("[data-zc-inline-editing]")).toHaveCount(0);
    await expect(ctaNode).toContainText("Get building");
    await expect(ctaNode).not.toContainText("Should not persist");

    // An IME composition's confirming Enter must NOT commit.
    await openInlineEditor(ctaNode, editable);
    await editable.evaluate((el) => {
      el.dispatchEvent(new Event("compositionstart", { bubbles: true }));
      const ev = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
      Object.defineProperty(ev, "isComposing", { value: true });
      el.dispatchEvent(ev);
    });
    await expect(frame.locator("[data-zc-inline-editing]")).toHaveCount(1);
    await editable.evaluate((el) => el.dispatchEvent(new Event("compositionend", { bubbles: true })));
    await page.keyboard.press("Escape"); // clean, non-committing exit
    await expect(frame.locator("[data-zc-inline-editing]")).toHaveCount(0);
    await expect(ctaNode).toContainText("Get building");

    // Commit via blur (click outside the iframe entirely).
    await openInlineEditor(ctaNode, editable);
    await page.keyboard.press("Control+A");
    await page.keyboard.type("Get building now");
    await expect(editable).toContainText("Get building now");
    await page.locator(".sg-composer-toolbar").first().click({ position: { x: 4, y: 4 } });
    await expect(frame.locator("[data-zc-inline-editing]")).toHaveCount(0);
    await expect(ctaNode).toContainText("Get building now");
    await expect(labelField).toHaveValue("Get building now");
  });

  // ── Step 12 ────────────────────────────────────────────────────────────
  test("step 12 - copy/paste-into-named-slot/cut/duplicate via context menus, with clipboard chip and re-issued node ids", async () => {
    const menu = contextMenu(page);
    const chip = page.locator(".sg-composer-clipboard-chip");

    // Copy cta-1.
    const ctaRow = treeNode(page, "cta-1");
    await ctaRow.locator(".sg-composer-tree-select").first().click();
    await ctaRow.locator(".sg-composer-tree-menu-trigger").first().click();
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: "Copy", exact: true }).click();
    await expect(menu).not.toBeVisible();
    await expect(chip).toHaveAttribute("data-sg-clipboard-component", "ui.cta-button");
    await expect(chip).toContainText("CtaButton");

    // Paste it into Stack's named "content" slot via an INSERT-POINT menu (not "+Add").
    const stackRow = treeNode(page, "stack-1");
    await stackRow.locator(".sg-composer-tree-disclosure").first().click();
    const contentInsertMenu = stackRow.locator(
      '[data-sg-tree-slot-id="content"] > .sg-composer-tree-slot-header .sg-composer-tree-insert-menu',
    );
    await contentInsertMenu.first().click();
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: 'Paste "CtaButton" here', exact: true }).click();
    await expect(menu).not.toBeVisible();

    const pastedCtaId = await selectedTreeNodeId(page);
    expect(pastedCtaId).not.toBe("cta-1");
    const contentChildren = stackRow.locator('[data-sg-tree-slot-id="content"] > ul.sg-composer-tree-list > li');
    await expect(contentChildren.last()).toHaveAttribute("data-sg-tree-node-id", pastedCtaId);

    // Duplicate prose-1 — the clone lands immediately after it, in the same slot.
    const prose1Row = treeNode(page, "prose-1");
    await prose1Row.locator(".sg-composer-tree-select").first().click();
    await prose1Row.locator(".sg-composer-tree-menu-trigger").first().click();
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: "Duplicate", exact: true }).click();
    await expect(menu).not.toBeVisible();

    const duplicateId = await selectedTreeNodeId(page);
    expect(duplicateId).not.toBe("prose-1");
    expect(duplicateId).not.toBe("prose-2");
    const contentIdsAfterDup = await contentChildren.evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-sg-tree-node-id")),
    );
    const prose1Index = contentIdsAfterDup.indexOf("prose-1");
    expect(contentIdsAfterDup[prose1Index + 1]).toBe(duplicateId);

    // Cut prose-2 — removed from tree + canvas, and now the clipboard's contents.
    const prose2Row = treeNode(page, "prose-2");
    await prose2Row.locator(".sg-composer-tree-select").first().click();
    await prose2Row.locator(".sg-composer-tree-menu-trigger").first().click();
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: "Cut", exact: true }).click();
    await expect(menu).not.toBeVisible();

    await expect(treeNode(page, "prose-2")).toHaveCount(0);
    await expect(canvasFrame(page).locator('[data-zc-node-id="prose-2"]')).toHaveCount(0);
    await expect(chip).toContainText("ProseP");
    await expect(chip).toHaveAttribute("data-sg-clipboard-component", "ui.prose-p");
  });

  // ── Step 13 ────────────────────────────────────────────────────────────
  test("step 13 - drags a component cross-slot to a before-first target, then Alt-drags a copy back", async () => {
    const frame = canvasFrame(page);
    const gripSelector = `[data-zc-node-id="${insertedId}"] .zc-chrome-grip`;

    // Re-select the step-9 inserted PlaceholderBox so its drag grip renders
    // (the grip only shows on the SELECTED node — renderer.ts).
    await frame.locator(`[data-zc-node-id="${insertedId}"]`).click();
    await expect(frame.locator(gripSelector)).toBeVisible();

    // Move it cross-slot into Stack's "content" slot, before its first child.
    await dragToInsertPoint(frame, gripSelector, "stack-1:content:0");

    const stackRow = treeNode(page, "stack-1");
    const contentFirst = stackRow
      .locator('[data-sg-tree-slot-id="content"] > ul.sg-composer-tree-list > li')
      .first();
    await expect(contentFirst).toHaveAttribute("data-sg-tree-node-id", insertedId);

    const splitRow = treeNode(page, "split-1");
    const rightIds = await splitRow
      .locator('[data-sg-tree-slot-id="right"] > ul.sg-composer-tree-list > li')
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-sg-tree-node-id")));
    expect(rightIds).not.toContain(insertedId);
    expect(await selectedTreeNodeId(page)).toBe(insertedId);

    // Alt-drag a COPY of it back into split-1's "right" slot, before-first.
    // The drop routes through the host bridge (revalidate + apply) asynchronously
    // AFTER `dragend` clears `data-zc-dragging`, so the copy renders a beat after
    // the drag helper returns. Poll with toHaveCount (not a one-shot count())
    // so this waits for the applied copy rather than racing the bridge round-trip.
    const heroImages = frame.getByRole("img", { name: "hero-image.png" });
    const beforeCopyCount = await heroImages.count();
    await dragToInsertPoint(frame, gripSelector, "split-1:right:0", { altKey: true });
    await expect(heroImages).toHaveCount(beforeCopyCount + 1);

    // The original stays put (copy, not move) — a NEW, re-issued id is selected.
    await expect(contentFirst).toHaveAttribute("data-sg-tree-node-id", insertedId);
    const copyId = await selectedTreeNodeId(page);
    expect(copyId).not.toBe(insertedId);
    const rightIdsAfterCopy = await splitRow
      .locator('[data-sg-tree-slot-id="right"] > ul.sg-composer-tree-list > li')
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-sg-tree-node-id")));
    expect(rightIdsAfterCopy[0]).toBe(copyId);
  });

  // ── Protocol sanity: no leaked errors across the whole walkthrough ──────
  test("no uncaught browser errors or failed same-origin requests occurred during the walkthrough", () => {
    expect(pageErrors).toEqual([]);
    expect(failedResponses).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Step 7 + the opaque-node half of step 8 — each needs a FRESH page (storage
// is seeded before the app's first read), so these are independent tests.
// Also hosts the menu-path removal-confirm check (issue #260/#269) below,
// which never mutates the document and so is likewise safe on its own page
// rather than risking the shared 14-step walkthrough's state.
// ---------------------------------------------------------------------------

test.describe("Composer storage & recovery matrix (step 7 + opaque export block)", () => {
  test("step 07a/07b - reload persists the document; Reset restores the native sample", async ({ page }) => {
    await gotoComposer(page);
    await expect(page.locator(".sg-composer-save-status")).toHaveAttribute("data-sg-status", "saved");
    await expect(topLevelTreeRows(page)).toHaveCount(1);

    await page.getByRole("button", { name: "Add component to document root" }).click();
    const dialog = chooserDialog(page);
    await dialog.getByPlaceholder("Search components…").fill("Callout");
    await dialog.getByRole("button", { name: "Callout", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(topLevelTreeRows(page)).toHaveCount(2);
    await expect(page.locator(".sg-composer-save-status")).toHaveAttribute("data-sg-status", "saved");

    await page.reload();
    await expect(canvasFrame(page).locator("[data-composer-canvas]")).toBeVisible({ timeout: 15_000 });
    await expect(topLevelTreeRows(page)).toHaveCount(2);

    // Reset now requires an explicit confirm (issue #260/#269) — clicking
    // "Reset sample" alone must NOT wipe the document.
    await page.getByRole("button", { name: "Reset sample", exact: true }).click();
    // #269/#267 moved the Reset confirm from the tree-row confirm into the
    // toolbar's own inline-confirm variant (`.sg-composer-toolbar-confirm`,
    // tone="toolbar"). Same Cancel-focused / Escape-cancels behavior, new class.
    const resetConfirm = page.locator(".sg-composer-toolbar-confirm", { hasText: "Reset the sample?" });
    await expect(resetConfirm).toBeVisible();
    await expect(topLevelTreeRows(page)).toHaveCount(2);
    // Initial focus lands on the SAFE action (Cancel), unified with the
    // tree-row/context-menu removal confirms.
    await expect(resetConfirm.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();

    // Escape cancels, leaving the document untouched.
    await page.keyboard.press("Escape");
    await expect(resetConfirm).not.toBeVisible();
    await expect(topLevelTreeRows(page)).toHaveCount(2);

    await page.getByRole("button", { name: "Reset sample", exact: true }).click();
    await page.getByRole("button", { name: "Confirm reset", exact: true }).click();
    await expect(topLevelTreeRows(page)).toHaveCount(1);
    await expect(page.locator(".sg-composer-save-status")).toHaveAttribute("data-sg-status", "saved");
  });

  test("step 07c - malformed storage recovers to the sample with an honest notice", async ({ page }) => {
    await prepareLegacyMigration(page, "{not valid json");
    await openComposerLibrary(page);

    const banner = page.getByRole("heading", { name: "Recovery notice" }).locator("..");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("malformed");
    await expect(banner).toContainText("original source has been preserved");

    await page.locator(".sg-composer-library-open").first().click();
    await expect(canvasFrame(page).locator("[data-composer-canvas]")).toBeVisible();
    await expect(topLevelTreeRows(page)).toHaveCount(1);
  });

  test("step 07d - a newer schema is quarantined until explicit Start fresh", async ({ page }) => {
    await prepareLegacyMigration(page, JSON.stringify({ schemaVersion: 2 }));
    await openComposerLibrary(page);

    const banner = page.getByRole("heading", { name: "Recovery required" }).locator("..");
    await expect(banner).toContainText("future schema 2");
    await expect(page.getByRole("button", { name: "New composition" }).first()).toBeDisabled();

    await page.getByRole("button", { name: "Start fresh", exact: true }).click();
    await page.getByRole("button", { name: "Start fresh", exact: true }).last().click();
    await expect(page.locator(".sg-composer-library-open")).toHaveCount(1);
    await page.locator(".sg-composer-library-open").first().click();
    await expect(page.locator(".sg-composer-save-status")).toHaveAttribute("data-sg-status", "saved");
  });

  test("step 07e - invalidated IndexedDB writes are reported honestly and the app keeps working", async ({ page, context }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    await gotoComposer(page);
    const peer = await context.newPage();
    await invalidateComposerConnection(page, peer);
    await peer.close();

    const status = page.locator(".sg-composer-save-status");
    await page.getByRole("button", { name: "Add component to document root" }).click();
    const dialog = chooserDialog(page);
    await dialog.getByPlaceholder("Search components…").fill("Callout");
    await dialog.getByRole("button", { name: "Callout", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(topLevelTreeRows(page)).toHaveCount(2);
    await expect(status).toHaveAttribute("data-sg-status", "error");
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test("step 08b - export is blocked when the document contains an opaque node", async ({ page }) => {
    await gotoComposer(page);
    const seedDoc = {
      schemaVersion: 1,
      id: "opaque-check",
      name: "Opaque check",
      root: [
        {
          id: "split-1",
          componentId: "ui.split-layout",
          componentVersion: 1,
          props: { ratio: "50/50", gap: "md" },
          slots: {
            left: [
              {
                id: "ghost-1",
                componentId: "ui.nonexistent-widget",
                componentVersion: 1,
                props: {},
                slots: {},
              },
            ],
            right: [],
          },
        },
      ],
    };
    const database = await inspectComposerDatabase(page);
    const current = database.records[0]!;
    await replaceComposerRecords(page, [{
      ...current,
      document: seedDoc,
      id: "opaque-check",
      createdAt: current.createdAt,
      updatedAt: current.updatedAt,
    }]);
    await page.goto("/composer/#/composition/indexeddb/opaque-check");
    await page.reload();
    await expect(canvasFrame(page).locator("[data-composer-canvas]")).toBeVisible({ timeout: 15_000 });

    const splitRow = treeNode(page, "split-1");
    await splitRow.locator(".sg-composer-tree-disclosure").first().click();
    const ghostRow = treeNode(page, "ghost-1");
    await expect(ghostRow.locator('[data-sg-tree-badge="unavailable"]')).toHaveText("Unavailable");

    await ghostRow.locator(".sg-composer-tree-select").first().click();
    await expect(page.locator("[data-sg-inspector-state]")).toHaveAttribute("data-sg-inspector-state", "opaque");
    await expect(page.locator(".sg-composer-inspector-diagnostics")).toContainText(
      "This component can't be edited.",
    );

    await page.getByRole("button", { name: "Export JSX", exact: true }).click();
    const dialog = exportModal(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Export is blocked");
    await expect(dialog).toContainText("ui.nonexistent-widget");
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
  });

  // Context-menu Delete confirmation (issue #256) — the SECOND removal-confirm
  // entry point, kept unified with the tree row's own inline confirm (step 05d
  // above): same copy/behavior, and initial focus on Cancel (issue #260/#269).
  // Runs on its own fresh page and never actually confirms, so the native
  // sample stays intact — no interference with the shared 14-step walkthrough.
  test("step 05b (menu path) - node context-menu Delete on a populated subtree confirms, focused on Cancel", async ({
    page,
  }) => {
    await gotoComposer(page);
    const splitRow = treeNode(page, "split-1");
    await splitRow.locator(".sg-composer-tree-menu-trigger").first().click();

    const menu = contextMenu(page);
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: "Delete" }).click();

    const confirm = menu.locator(".sg-composer-tree-confirm");
    await expect(confirm).toContainText(/Remove SplitLayout and its \d+ nested components?\?/);
    await expect(confirm.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();

    await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(menu).not.toBeVisible();
    await expect(splitRow).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Step 14 — the SPA navigation guard, on its own fresh page (needs a
// deterministically "unsaved" document — see comment below).
// ---------------------------------------------------------------------------

test.describe("Composer SPA navigation guard (step 14)", () => {
  test("with unsaved edits, leaving via the shared header triggers the guard", async ({ page, context }) => {
    await gotoComposer(page);
    const peer = await context.newPage();
    await invalidateComposerConnection(page, peer);
    await peer.close();
    await page.getByRole("button", { name: "Add component to document root" }).click();
    const dialog = chooserDialog(page);
    await dialog.getByPlaceholder("Search components…").fill("Callout");
    await dialog.getByRole("button", { name: "Callout", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator(".sg-composer-save-status")).toHaveAttribute("data-sg-status", "error");

    let dialogType: string | null = null;
    page.once("dialog", (d) => {
      dialogType = d.type();
      void d.dismiss();
    });

    // "Guide" (settings.ts headerNav) is a same-origin, in-app link — clicking
    // it while unsaved trips navigation-guard.ts's BEFORE_NAVIGATE_EVENT
    // handler, which downgrades the SPA swap to a real navigation so the
    // browser's native beforeunload prompt can intercept it.
    await page
      .locator("header[data-header] nav[data-header-nav]")
      .getByRole("link", { name: "Guide", exact: true })
      .click();

    await expect.poll(() => dialogType).toBe("beforeunload");
    // Dismissing the prompt means "stay" — still on the provider-qualified
    // Composer detail route.
    await expect(page).toHaveURL(/\/composer\/#\/composition\/indexeddb\/[^/]+$/);
  });
});

// ---------------------------------------------------------------------------
// Lightweight responsive + protocol checks. Supplemental only — the full
// 1440/1024/1023/768/390 x light/dark matrix and pixel-level verification is
// the MANAGER's job via `/verify-ui` / a Playwright screenshot pass, not this
// spec's (see issue #252's "Central commands" section).
// ---------------------------------------------------------------------------

test.describe("Composer lightweight responsive + protocol checks (supplemental)", () => {
  test("narrow viewport collapses to a canvas-only view with no body horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoComposer(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await expect(page.locator(".sg-composer-narrow-note")).toBeVisible();
    await expect(page.locator("#sg-composer-tree")).not.toBeVisible();
    await expect(page.locator("#sg-composer-inspector")).not.toBeVisible();
    await expect(canvasFrame(page).locator("[data-composer-canvas]")).toBeVisible();
  });

  test("the structure-rail resizer clamps via keyboard (Home/End) and persists", async ({ page }) => {
    // Regression guard for a #252-confirmation fix: the workspace resizers used
    // to be entirely inert because `ComposerApp` mounts as `Island({ when:
    // "load" })` whose ssrFallback has no resizer, so
    // `[data-sg-composer-tree-resizer]` only exists AFTER hydration — but the
    // body-end RESIZER_SCRIPT ran at parse time (before the island), wired
    // nothing, and a one-shot global guard then blocked every retry. Fixed by
    // dropping that guard and retrying `init()` via a MutationObserver until the
    // island hydrates (per-element `__sgWired` keeps it idempotent).
    await gotoComposer(page);
    const resizer = page.locator("[data-sg-composer-tree-resizer]");
    await resizer.focus();

    await resizer.press("End");
    const grown = Number(await resizer.getAttribute("aria-valuenow"));
    expect(grown).toBeGreaterThan(220);

    await resizer.press("Home");
    await expect(resizer).toHaveAttribute("aria-valuenow", "220");
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), TREE_WIDTH_KEY))
      .toBe("220");
  });
});
