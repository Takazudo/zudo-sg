import {
  expect,
  test,
  type Frame,
  type FrameLocator,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { openComposerRecord } from "./support/composer-persistence";

// Issue #444 is intentionally an opt-in measurement suite. The default
// playwright.config.ts does not list this file, so `pnpm test:e2e` remains the
// normal Chromium-only suite. Run against a BUILT site with:
//
//   pnpm build
//   pnpm test:e2e:inline-edit-newline
//
// The same committed matrix becomes an assertion gate for #447 with:
//
//   INLINE_EDIT_NEWLINE_ASSERT=1 pnpm test:e2e:inline-edit-newline
//
// The Playwright JSON reporter and the per-project JSON attachments contain
// the machine-readable rows. Measurement mode records mismatches and stays
// green; confirm mode reports every mismatch after all probes have run.

const CANVAS_IFRAME = ".sg-composer-canvas-frame iframe";
const PROSE_EDITOR = "[data-zc-prose-editing]";
const SAVE_BUTTON = ".zc-prose-save";
const PASTE_TEXT = "p1\n\np2\n\np3";

type Engine = "chromium" | "firefox";
type ContenteditableMode = "plaintext-only" | "true";
type RunMode = "measure" | "confirm";

interface ProjectMatrixEntry {
  engine: Engine;
  mode: ContenteditableMode;
}

const PROJECT_MATRIX: Readonly<Record<string, ProjectMatrixEntry>> = {
  "chromium-plaintext-only": { engine: "chromium", mode: "plaintext-only" },
  "chromium-true": { engine: "chromium", mode: "true" },
  "firefox-plaintext-only": { engine: "firefox", mode: "plaintext-only" },
  "firefox-true": { engine: "firefox", mode: "true" },
};

type ProbeAction =
  | { kind: "type"; text: string }
  | { kind: "press"; key: string }
  | { kind: "select-text" }
  | { kind: "paste"; text: string };

interface ProbeDefinition {
  probe: string;
  seed: string;
  expected: string;
  actions: readonly ProbeAction[];
}

interface DomSnapshot {
  step: string;
  innerHTML: string;
  textContent: string;
  contenteditable: string | null;
}

interface RenderObservation {
  revision: number;
  markdownByNodeId: Record<string, string | null>;
}

interface InlineEditCommit {
  nodeId: string;
  fieldKey: string;
  value: string;
  documentRevision: number;
}

interface ProbeResult {
  engine: Engine;
  mode: ContenteditableMode;
  probe: string;
  seed: string;
  seedRenderRevision: number;
  expectedValue: string;
  innerHTML: string;
  textContent: string;
  committedValue: string;
  /** The inspector's model value after the session ended. */
  inspectorValue: string;
  /** Null for clean no-op saves, which intentionally emit no commit message. */
  commitMessageValue: string | null;
  commitDocumentRevision: number | null;
  commitCountDelta: number;
  affordanceBeforeSave: string;
  pasteMethod: "clipboard" | "insertText-fallback" | null;
  steps: readonly DomSnapshot[];
  mismatch: boolean;
}

interface ProbeReport {
  schemaVersion: 1;
  issue: 444;
  engine: Engine;
  mode: ContenteditableMode;
  runMode: RunMode;
  rows: readonly ProbeResult[];
  mismatchCount: number;
  pageErrors: readonly string[];
  harnessError: string | null;
}

declare global {
  interface Window {
    __inlineEditCommits?: InlineEditCommit[];
    __inlineEditNewlineRenderObservations?: RenderObservation[];
  }
}

function canvas(page: Page): FrameLocator {
  return page.frameLocator(CANVAS_IFRAME);
}

function previewFrame(page: Page): Frame {
  const frame = page.frames().find((candidate) => candidate.url().includes("/composer/preview"));
  if (!frame) throw new Error("composer preview frame is not attached");
  return frame;
}

function nodeLocator(page: Page, nodeId: string): Locator {
  return canvas(page).locator(`[data-zc-node-id="${nodeId}"]`);
}

function markdownField(page: Page): Locator {
  return page.locator("#sg-composer-inspector").getByLabel("Markdown");
}

function projectMatrix(testInfo: TestInfo): ProjectMatrixEntry {
  const entry = PROJECT_MATRIX[testInfo.project.name];
  if (!entry) throw new Error(`Unknown inline-edit newline project: ${testInfo.project.name}`);
  return entry;
}

function runMode(): RunMode {
  return process.env.INLINE_EDIT_NEWLINE_ASSERT === "1" ? "confirm" : "measure";
}

/** Capture the real host-side commit envelope before the Composer starts. */
async function installCommitCapture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__inlineEditCommits = [];
    window.addEventListener("message", (event) => {
      const data = event.data as {
        type?: unknown;
        nodeId?: unknown;
        fieldKey?: unknown;
        value?: unknown;
        documentRevision?: unknown;
      } | null;
      if (!data || data.type !== "commit-inline-edit") return;
      window.__inlineEditCommits?.push({
        nodeId: typeof data.nodeId === "string" ? data.nodeId : String(data.nodeId ?? ""),
        fieldKey: typeof data.fieldKey === "string" ? data.fieldKey : String(data.fieldKey ?? ""),
        value: typeof data.value === "string" ? data.value : String(data.value ?? ""),
        documentRevision:
          typeof data.documentRevision === "number" ? data.documentRevision : Number(data.documentRevision ?? 0),
      });
    });
  });
}

async function commitCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__inlineEditCommits?.length ?? 0);
}

async function latestCommit(
  page: Page,
  nodeId: string,
  startIndex: number,
): Promise<InlineEditCommit | null> {
  return page.evaluate(
    ({ nodeId: requestedNodeId, startIndex: requestedStartIndex }) => {
      const commits = window.__inlineEditCommits ?? [];
      return (
        commits
          .slice(requestedStartIndex)
          .find((commit) => commit.nodeId === requestedNodeId && commit.fieldKey === "markdown") ?? null
      );
    },
    { nodeId, startIndex },
  );
}

/** Add the actual ProseMd component through the Composer chooser. */
async function addProseMd(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Add component to document root" }).click();
  const chooser = page.locator("dialog.sg-composer-chooser");
  await expect(chooser).toBeVisible();
  await chooser.getByPlaceholder("Search components…").fill("ProseMd");
  await chooser.getByRole("button", { name: "ProseMd", exact: true }).click();
  await expect(chooser).not.toBeVisible();

  // The chooser closes before the tree's add/select render necessarily lands.
  // Filter the pressed control by the component title so an older selected
  // SplitLayout cannot win the race while the new ProseMd row is mounting.
  const selected = page
    .locator('.sg-composer-tree-select[aria-pressed="true"]')
    .filter({ hasText: "ProseMd" });
  await expect(selected).toHaveCount(1);
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  const nodeId = await selected.evaluate(
    (element) => element.closest("[data-sg-tree-node-id]")?.getAttribute("data-sg-tree-node-id") ?? "",
  );
  if (!nodeId) throw new Error("added ProseMd row has no data-sg-tree-node-id");
  return nodeId;
}

/** Observe trusted parent→preview renders at an applied rAF boundary. */
async function installRenderObserver(page: Page): Promise<void> {
  previewFrame(page);
  await previewFrame(page).evaluate(() => {
    window.__inlineEditNewlineRenderObservations = [];
    window.addEventListener("message", (event) => {
      const data = event.data as {
        channel?: unknown;
        v?: unknown;
        type?: unknown;
        revision?: unknown;
        document?: { root?: unknown };
      } | null;
      if (
        event.source !== window.parent ||
        event.origin !== window.location.origin ||
        data?.channel !== "composer-preview" ||
        data.v !== 1 ||
        data.type !== "render" ||
        typeof data.revision !== "number" ||
        !Number.isInteger(data.revision) ||
        !Array.isArray(data.document?.root)
      ) {
        return;
      }

      const revision = data.revision;
      const root = data.document.root;
      window.requestAnimationFrame(() => {
        const markdownByNodeId: Record<string, string | null> = {};
        const visit = (nodes: unknown[]): void => {
          for (const candidate of nodes) {
            if (!candidate || typeof candidate !== "object") continue;
            const node = candidate as {
              id?: unknown;
              props?: unknown;
              slots?: unknown;
            };
            if (typeof node.id === "string") {
              const props = node.props;
              const markdown =
                props && typeof props === "object" && typeof (props as { markdown?: unknown }).markdown === "string"
                  ? (props as { markdown: string }).markdown
                  : null;
              markdownByNodeId[node.id] = markdown;
            }
            if (node.slots && typeof node.slots === "object") {
              for (const children of Object.values(node.slots as Record<string, unknown>)) {
                if (Array.isArray(children)) visit(children);
              }
            }
          }
        };
        visit(root);
        window.__inlineEditNewlineRenderObservations?.push({ revision, markdownByNodeId });
      });
    });
  });
}

async function observedSeedRender(
  page: Page,
  nodeId: string,
  value: string,
): Promise<RenderObservation | null> {
  return previewFrame(page).evaluate(
    ({ nodeId: requestedNodeId, value: requestedValue }) => {
      const observations = window.__inlineEditNewlineRenderObservations ?? [];
      for (let index = observations.length - 1; index >= 0; index -= 1) {
        const observation = observations[index]!;
        if (observation.markdownByNodeId[requestedNodeId] === requestedValue) return observation;
      }
      return null;
    },
    { nodeId, value },
  );
}

/** Update the real inspector/model, then wait for the built ProseMd to settle. */
async function setMarkdown(page: Page, nodeId: string, value: string): Promise<number> {
  const field = markdownField(page);
  await field.fill(value);
  // Inspector text fields use the Composer's debounced update channel. Blur is
  // the existing user-facing flush point; without it, an immediate empty
  // probe can open before the canvas receives the requested value and capture
  // the component default instead.
  await field.blur();
  await expect(field).toHaveValue(value);

  // The flush above schedules the normal Composer persistence path. Saved is
  // useful host evidence, but it is not an iframe delivery acknowledgement.
  await expect(page.locator('.sg-composer-save-status[data-sg-status="saved"]')).toBeVisible();

  // Wait for the trusted parent→preview render containing THIS node's exact
  // requested prop after the observer's requestAnimationFrame boundary. This
  // is the synchronization point that prevents a stale/default document from
  // being captured by the next inline session.
  await expect
    .poll(() => observedSeedRender(page, nodeId, value), { timeout: 15_000 })
    .not.toBeNull();
  const render = await observedSeedRender(page, nodeId, value);
  if (!render) throw new Error(`render observer did not see seed for node ${nodeId}`);

  const block = nodeLocator(page, nodeId).locator(".zc-prose-md");
  await expect(block).toHaveCount(1);
  // Avoid opening a session while the async markdown runtime is still painting
  // its pending placeholder. The source editor then owns the body cleanly.
  await expect(block).not.toHaveClass(/zc-prose-md--pending|zc-prose-md--error/);
  return render.revision;
}

async function openEditor(page: Page, nodeId: string, seed: string): Promise<Locator> {
  const node = nodeLocator(page, nodeId);
  const editor = canvas(page).locator(PROSE_EDITOR);
  if (await node.isVisible()) {
    await node.dblclick();
  } else {
    // An empty ProseMd legitimately renders no pixels, so Playwright cannot
    // perform a coordinate double-click on it. Dispatch the same bubbling
    // `dblclick` at the real node wrapper; renderer.ts's production handler
    // still resolves the node and enters the actual Prose session.
    await node.dispatchEvent("dblclick");
  }
  await expect(editor).toBeVisible();
  await expect(editor).toBeFocused();
  await expect.poll(() => editor.evaluate((element) => element.textContent ?? "")).toBe(seed);
  return editor;
}

/** Force the requested value after the real source editor has mounted. */
async function forceContenteditable(editor: Locator, mode: ContenteditableMode): Promise<void> {
  await editor.evaluate((element, value) => {
    element.setAttribute("contenteditable", value);
    element.focus();
  }, mode);
  await expect(editor).toHaveAttribute("contenteditable", mode);
  await expect(editor).toBeFocused();
}

async function snapshot(editor: Locator, step: string): Promise<DomSnapshot> {
  return editor.evaluate((element, label) => ({
    step: label,
    innerHTML: element.innerHTML,
    textContent: element.textContent ?? "",
    contenteditable: element.getAttribute("contenteditable"),
  }), step);
}

/** Use the real clipboard shortcut when available; retain a transparent fallback for Firefox permissions. */
async function pasteExact(
  page: Page,
  editor: Locator,
  text: string,
): Promise<"clipboard" | "insertText-fallback"> {
  let clipboardReady = false;
  try {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: new URL(page.url()).origin,
    });
    clipboardReady = await page.evaluate(async (value) => {
      try {
        if (!navigator.clipboard) return false;
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        return false;
      }
    }, text);
  } catch {
    clipboardReady = false;
  }

  if (clipboardReady) {
    const beforeText = await editor.evaluate((element) => element.textContent ?? "");
    const modifier = await page.evaluate(() => (/Mac/i.test(navigator.platform) ? "Meta" : "Control"));
    await page.keyboard.press(`${modifier}+V`);
    // A granted write permission does not guarantee that the browser accepts
    // the keyboard paste (notably in some Firefox headless environments).
    // Detect a no-op before falling back, so the row still measures the real
    // editor rather than silently recording an untouched source.
    try {
      await expect
        .poll(() => editor.evaluate((element) => element.textContent ?? ""), { timeout: 1_000 })
        .not.toBe(beforeText);
      return "clipboard";
    } catch {
      // Fall through to the deterministic focused-editor insertion below.
    }
  }

  // `insertText` still uses the focused, real Composer contenteditable and
  // browser editing algorithm. The fallback is recorded so a manager can
  // distinguish a clipboard-permission limitation from normal rows.
  await page.keyboard.insertText(text);
  return "insertText-fallback";
}

async function performAction(page: Page, editor: Locator, action: ProbeAction): Promise<string> {
  await expect(editor).toBeFocused();
  switch (action.kind) {
    case "type":
      await page.keyboard.type(action.text);
      return `type:${JSON.stringify(action.text)}`;
    case "press":
      await page.keyboard.press(action.key);
      return `press:${action.key}`;
    case "select-text":
      await editor.selectText();
      return "select-text";
    case "paste":
      return `paste:${await pasteExact(page, editor, action.text)}`;
  }
}

async function saveEditor(
  page: Page,
  nodeId: string,
  editor: Locator,
  seed: string,
): Promise<{
  affordance: string;
  commitMessage: InlineEditCommit | null;
  committedValue: string;
  inspectorValue: string;
  commitCountDelta: number;
}> {
  const save = canvas(page).locator(SAVE_BUTTON);
  await expect(save).toBeVisible();
  const affordance = (await save.textContent())?.trim() ?? "";
  const before = await commitCount(page);

  await save.click();
  await expect(editor).toHaveCount(0);

  // A clean source save is deliberately a no-op (no commit envelope). A dirty
  // source save emits exactly one envelope, which we wait for before reading
  // the row so `committedValue` is never a timing-dependent guess.
  if (affordance === "Save") {
    await expect.poll(() => commitCount(page)).toBe(before + 1);
  }

  const commitMessage = await latestCommit(page, nodeId, before);
  const inspectorValue = await markdownField(page).inputValue();
  return {
    affordance,
    commitMessage,
    committedValue: commitMessage?.value ?? inspectorValue ?? seed,
    inspectorValue,
    commitCountDelta: (await commitCount(page)) - before,
  };
}

function probeDefinitions(): readonly ProbeDefinition[] {
  const type = (text: string): ProbeAction => ({ kind: "type", text });
  const press = (key: string): ProbeAction => ({ kind: "press", key });
  return [
    {
      probe: "a-newline-b",
      seed: "",
      expected: "a\nb",
      actions: [type("a"), press("Enter"), type("b")],
    },
    {
      probe: "a-double-newline-b",
      seed: "",
      expected: "a\n\nb",
      actions: [type("a"), press("Enter"), press("Enter"), type("b")],
    },
    {
      probe: "a-trailing-newline",
      seed: "",
      expected: "a\n",
      actions: [type("a"), press("Enter")],
    },
    {
      probe: "a-double-trailing-newline",
      seed: "",
      expected: "a\n\n",
      actions: [type("a"), press("Enter"), press("Enter")],
    },
    {
      probe: "exact-multi-paragraph-paste",
      seed: "",
      expected: PASTE_TEXT,
      actions: [{ kind: "paste", text: PASTE_TEXT }],
    },
    {
      probe: "empty-editable",
      seed: "clear me",
      expected: "",
      actions: [{ kind: "select-text" }, press("Backspace")],
    },
    ...(["", "a", "a\n", "a\n\n"] as const).flatMap((seed) => [
      {
        probe: `round-trip-no-edit-${JSON.stringify(seed)}`,
        seed,
        expected: seed,
        actions: [] as const,
      },
      {
        probe: `round-trip-type-delete-${JSON.stringify(seed)}`,
        seed,
        expected: seed,
        actions: [type("x"), press("Backspace")],
      },
    ]),
  ];
}

async function runProbe(
  page: Page,
  nodeId: string,
  matrix: ProjectMatrixEntry,
  definition: ProbeDefinition,
): Promise<ProbeResult> {
  const seedRenderRevision = await setMarkdown(page, nodeId, definition.seed);
  const editor = await openEditor(page, nodeId, definition.seed);
  await forceContenteditable(editor, matrix.mode);

  const steps: DomSnapshot[] = [await snapshot(editor, "open")];
  let pasteMethod: ProbeResult["pasteMethod"] = null;
  for (const action of definition.actions) {
    const label = await performAction(page, editor, action);
    const captured = await snapshot(editor, label);
    steps.push(captured);
    if (action.kind === "paste") {
      pasteMethod = label.endsWith("clipboard") ? "clipboard" : "insertText-fallback";
    }
  }

  const finalSnapshot = steps[steps.length - 1]!;
  const saved = await saveEditor(page, nodeId, editor, definition.seed);
  const committedValue = saved.committedValue;
  return {
    engine: matrix.engine,
    mode: matrix.mode,
    probe: definition.probe,
    seed: definition.seed,
    seedRenderRevision,
    expectedValue: definition.expected,
    innerHTML: finalSnapshot.innerHTML,
    textContent: finalSnapshot.textContent,
    committedValue,
    inspectorValue: saved.inspectorValue,
    commitMessageValue: saved.commitMessage?.value ?? null,
    commitDocumentRevision: saved.commitMessage?.documentRevision ?? null,
    commitCountDelta: saved.commitCountDelta,
    affordanceBeforeSave: saved.affordance,
    pasteMethod,
    steps,
    mismatch: committedValue !== definition.expected,
  };
}

test("captures the built Composer inline-edit newline matrix", async ({ browser }, testInfo) => {
  // Fourteen intentionally fresh browser contexts each boot the built
  // Composer/wasm path; keep the overall bound generous without changing the
  // focused locator/action assertion timeouts.
  test.setTimeout(600_000);
  const matrix = projectMatrix(testInfo);
  const selectedRunMode = runMode();
  const rows: ProbeResult[] = [];
  const pageErrors: string[] = [];
  let harnessError: string | null = null;

  try {
    for (const definition of probeDefinitions()) {
      // Each probe gets a clean browser document and a newly-added real
      // ProseMd. The prior probe's commit/render messages cannot then arrive
      // after this session starts and mark its draft stale (#288).
      const context = await browser.newContext();
      const probePage = await context.newPage();
      probePage.on("pageerror", (error) => pageErrors.push(`${definition.probe}: ${error.message}`));
      try {
        await installCommitCapture(probePage);
        await openComposerRecord(probePage);
        await installRenderObserver(probePage);
        const nodeId = await addProseMd(probePage);
        const row = await runProbe(probePage, nodeId, matrix, definition);
        rows.push(row);
        // Keep this line deliberately stable: the manager can collect all four
        // projects without parsing Playwright's human-oriented list reporter.
        console.log(
          `INLINE_EDIT_NEWLINE_ROW ${JSON.stringify({
            engine: row.engine,
            mode: row.mode,
            probe: row.probe,
            innerHTML: row.innerHTML,
            textContent: row.textContent,
            committed: row.committedValue,
            expected: row.expectedValue,
            pass: !row.mismatch,
          })}`,
        );
      } finally {
        await context.close();
      }
    }

    if (selectedRunMode === "confirm") {
      const mismatches = rows.filter((row) => row.mismatch);
      expect(
        mismatches,
        mismatches.length === 0
          ? undefined
          : mismatches
              .map(
                (row) =>
                  `${row.engine}/${row.mode}/${row.probe}: committed=${JSON.stringify(row.committedValue)} expected=${JSON.stringify(row.expectedValue)}`,
              )
              .join("\n"),
      ).toEqual([]);
    }
  } catch (error) {
    harnessError = error instanceof Error ? error.stack ?? error.message : String(error);
    throw error;
  } finally {
    const report: ProbeReport = {
      schemaVersion: 1,
      issue: 444,
      engine: matrix.engine,
      mode: matrix.mode,
      runMode: selectedRunMode,
      rows,
      mismatchCount: rows.filter((row) => row.mismatch).length,
      pageErrors,
      harnessError,
    };
    await testInfo.attach("inline-edit-newline-probe.json", {
      body: Buffer.from(JSON.stringify(report, null, 2), "utf8"),
      contentType: "application/json",
    });
  }
});
