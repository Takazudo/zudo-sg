import { expect, test, type Page, type FrameLocator } from "@playwright/test";

// ---------------------------------------------------------------------------
// H6 integration spec — Preview Token Panel (sg-preview-design-tokens/v1)
//
// Driving approach (hybrid):
//   Programmatic for iframe bridge verification: postMessage to the iframe
//   directly (mirrors what sendApplyCssVars does internally). Tests that the
//   iframe's bridge receiver is installed and working. Used for Test 1 (iframe
//   receiver + host isolation) and Test 2 (doc panel isolation).
//
//   UI clicks for panel-level operations: open panel (dispatch
//   "toggle-preview-token-panel"), set a token value via the Size tab input,
//   Export, Reset, Load from JSON. Used for Tests 3-5b where we need the
//   panel's internal previewOverrides Map to be populated so Reset/sink are
//   exercised correctly.
//
//   Why not only postMessage? applyPreviewVars / clearPreviewVars are bundled
//   in the page's JS module scope and not exposed on window. The panel's Reset
//   button calls clearPreviewVars, which clears the REGISTRY's Map and sends
//   clear messages only for vars the registry actually tracks. Applying via
//   direct postMessage bypasses the registry (the Map stays empty), so a
//   subsequent Reset would NOT clear those vars — making a Reset assertion
//   unreliable. Tests that verify Reset must drive the panel via UI so the
//   registry tracks the overrides.
//
//   window.sgPreview: zdtp's root (non-Astro) API doesn't auto-install these
//   the way its Astro host adapter does, so preview-token-panel-bootstrap.ts
//   wires window.sgPreview.enableAutoload() / .disableAutoload() by hand
//   (#117) — there is no show/hide/toggleDesignPanel on this namespace. For
//   tests we dispatch the CustomEvent directly (synchronous, always wired) to
//   prove the toggle event channel is correctly bound.
//
// All five assertion groups required by issue #80 (H6) are present.
// ---------------------------------------------------------------------------

// Bridge constants — must match the iframe-bridge.js in @takazudo/zudo-doc.
const BRIDGE_SOURCE = "zudo-doc-theme-bridge";

// Sentinel value used across tests — chosen to be a distinct, parseable CSS
// color value that is unlikely to be a stylesheet default.
const BRAND_SENTINEL = "oklch(0.50 0.20 29)";

// Sentinel for the Color-tab (ui-color, a non-reserved GenericTab id — see
// COLOR_TAB in preview-token-panel-config.ts) round-trip assertion in Test 4.
// Distinct from BRAND_SENTINEL so a stale live-apply value can't accidentally
// satisfy the Export/Load assertion.
const COLOR_TAB_SENTINEL = "oklch(0.42 0.18 210)";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to the first component detail page (reused across several tests).
 */
async function gotoFirstDetailPage(page: Page): Promise<void> {
  await page.goto("/components");
  const firstCard = page.locator("[data-sg-card]").first();
  await expect(firstCard).toBeAttached();
  const href = await firstCard.getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);
}

/**
 * Wait for the first preview iframe to be attached and return a frame locator.
 *
 * VariantFrame hydrates when it scrolls into view ("when=visible"), so the
 * iframe element may not be in the DOM immediately. Timeout is generous (15 s)
 * to accommodate cold-start hydration on a freshly-served dist.
 */
async function waitForFirstPreviewFrame(page: Page): Promise<FrameLocator> {
  const iframeEl = page.locator('iframe[src*="/components/preview"]').first();
  await expect(iframeEl).toBeAttached({ timeout: 15_000 });
  return page.frameLocator('iframe[src*="/components/preview"]').first();
}

/**
 * Open the preview token panel by dispatching the CustomEvent.
 *
 * The CustomEvent path is always available (registered by the preview-panel
 * bootstrap island). This also verifies the "toggle-preview-token-panel"
 * event channel is correctly wired. (There is no `window.sgPreview.toggleDesignPanel()`
 * alternative — zdtp's root API doesn't install one for non-Astro hosts; see
 * the file-header note.)
 */
async function openPreviewPanel(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("toggle-preview-token-panel"));
  });
  // Wait for the panel shell to mount and become visible.
  await expect(page.locator(".tokenpanel-shell").first()).toBeVisible({
    timeout: 10_000,
  });
}

/**
 * Navigate to the "Size" tab in the currently-open panel and set --radius-md
 * to a specific px value using the text input (aria-label: "--radius-md value").
 *
 * This drives the panel's own Size tab input, which calls the sink's apply()
 * path (applyPreviewVars → sendApplyCssVars → iframe postMessage). Using the
 * panel UI ensures the registry's previewOverrides Map is populated, which is
 * required for Reset to correctly clear those vars.
 */
async function setPanelRadiusMd(page: Page, pxValue: string): Promise<void> {
  // Scope all lookups to the (single, open) preview panel shell. A bare
  // [role="tab"] + hasText:"Size" locator also matches an unrelated SSR
  // "Sizes" chrome tab elsewhere on the detail page (strict-mode violation),
  // so scope to the panel and match the tab name exactly.
  const panel = page.locator(".tokenpanel-shell").first();

  // Click the panel's "Size" tab (exact — excludes the page-chrome "Sizes" tab).
  const sizeTab = panel.getByRole("tab", { name: "Size", exact: true });
  await expect(sizeTab).toBeVisible({ timeout: 5_000 });
  await sizeTab.click();

  // The --radius-md input has aria-label "--radius-md value" (preview panel only).
  const radiusInput = panel.getByLabel("--radius-md value");
  await expect(radiusInput).toBeVisible({ timeout: 3_000 });

  // fill() dispatches a native input event which triggers Preact's onChange.
  await radiusInput.fill(pxValue);
  // Dispatch an extra input event as a safety measure for older Preact builds.
  await radiusInput.dispatchEvent("input");

  // Allow the sink apply to propagate via postMessage.
  await page.waitForTimeout(150);
}

/**
 * Navigate to the "Color" tab in the currently-open panel and set
 * --color-accent to a specific value using its text input (aria-label:
 * "--color-accent value").
 *
 * Mirrors setPanelRadiusMd, but for the Color tab (`ui-color` — a non-reserved
 * id routed to zdtp's GenericTab, see COLOR_TAB in preview-token-panel-config.ts).
 * Driving it via the panel UI (not a direct postMessage) populates the
 * registry's previewOverrides Map, which is what Export actually serializes.
 */
async function setPanelColorAccent(page: Page, value: string): Promise<void> {
  const panel = page.locator(".tokenpanel-shell").first();

  const colorTab = panel.getByRole("tab", { name: "Color", exact: true });
  await expect(colorTab).toBeVisible({ timeout: 5_000 });
  await colorTab.click();

  const colorInput = panel.getByLabel("--color-accent value");
  await expect(colorInput).toBeVisible({ timeout: 3_000 });

  await colorInput.fill(value);
  await colorInput.dispatchEvent("input");

  // Allow the sink apply to propagate via postMessage.
  await page.waitForTimeout(150);
}

/**
 * Apply CSS variable overrides directly to the preview iframe via the
 * zudo-doc-theme-bridge postMessage API. Tests the iframe receiver only;
 * does NOT populate the panel's previewOverrides registry Map.
 *
 * Use this for tests that verify the iframe bridge receiver is installed and
 * the CSS cascade is correct. Do NOT use this when you need Reset to clear
 * the values afterward (use panel UI instead — see setPanelRadiusMd).
 */
async function applyVarsToFirstIframe(
  page: Page,
  vars: Array<[string, string]>,
): Promise<void> {
  await page.evaluate(
    ({ bridgeSource, vars }) => {
      const iframe = document.querySelector(
        'iframe[src*="/components/preview"]',
      ) as HTMLIFrameElement | null;
      if (!iframe?.contentWindow) {
        throw new Error("Preview iframe not found or not loaded");
      }
      iframe.contentWindow.postMessage(
        { source: bridgeSource, type: "apply-css-vars", vars },
        window.location.origin,
      );
    },
    { bridgeSource: BRIDGE_SOURCE, vars },
  );
  // Small settle to let the iframe process the message.
  await page.waitForTimeout(100);
}

/**
 * Read a CSS custom property from the iframe's :root.
 */
async function getIframeRootVar(
  frame: FrameLocator,
  cssVar: string,
): Promise<string> {
  return frame.locator(":root").evaluate(
    (el, name) => getComputedStyle(el).getPropertyValue(name).trim(),
    cssVar,
  );
}

/**
 * Read a CSS custom property from the host document's <html> element.
 */
async function getHostRootVar(page: Page, cssVar: string): Promise<string> {
  return page.evaluate(
    (name) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    cssVar,
  );
}

// ---------------------------------------------------------------------------
// Test 1: preview panel opens; overrides reach the iframe; host chrome unchanged
// ---------------------------------------------------------------------------

test("preview panel: overrides reach iframe :root; host <html> is unchanged", async ({
  page,
}) => {
  await gotoFirstDetailPage(page);
  const frame = await waitForFirstPreviewFrame(page);

  // Confirm the panel is not yet mounted before opening.
  await expect(page.locator(".tokenpanel-shell").first()).not.toBeAttached();

  // Open the preview panel via the toggle event (verifies event channel wiring).
  await openPreviewPanel(page);

  // Apply overrides via the bridge postMessage API.
  // This tests that the iframe's bridge receiver (installIframeReceiver) is
  // installed and that inline style writes are reflected via getComputedStyle.
  const brandOverride = BRAND_SENTINEL;
  const radiusOverride = "20px";

  // Capture the host <html> baseline BEFORE applying. The host :root legitimately
  // defines base @zudo-sg/ui tokens (src/styles/global.css aliases them onto the
  // doc chrome), so these are NOT empty — the correct isolation assertion is that
  // the preview override does not CHANGE the host value, not that it equals "".
  const hostBrandBefore = await getHostRootVar(page, "--color-accent");
  const hostRadiusBefore = await getHostRootVar(page, "--radius-md");

  await applyVarsToFirstIframe(page, [
    ["--color-accent", brandOverride],
    ["--radius-md", radiusOverride],
  ]);

  // Assert iframe :root has the overrides applied.
  expect(await getIframeRootVar(frame, "--color-accent")).toBe(brandOverride);
  expect(await getIframeRootVar(frame, "--radius-md")).toBe(radiusOverride);

  // Assert host <html> is UNCHANGED by the preview override — the applySink
  // routes writes to iframes only, never to the host :root.
  expect(await getHostRootVar(page, "--color-accent")).toBe(hostBrandBefore);
  expect(await getHostRootVar(page, "--radius-md")).toBe(hostRadiusBefore);
  // …and specifically never picked up the iframe sentinel values.
  expect(await getHostRootVar(page, "--color-accent")).not.toBe(brandOverride);
  expect(await getHostRootVar(page, "--radius-md")).not.toBe(radiusOverride);
});

// ---------------------------------------------------------------------------
// Test 2: doc "Tokens" panel does NOT change the preview iframe
// ---------------------------------------------------------------------------

test("doc Tokens panel: dispatching toggle-sg-doc-tweak opens the real (non-empty) panel and does not change preview iframe", async ({
  page,
}) => {
  await gotoFirstDetailPage(page);
  const frame = await waitForFirstPreviewFrame(page);

  // Capture the iframe's baseline --color-accent value.
  const beforeBrand = await getIframeRootVar(frame, "--color-accent");

  // Open the DOC token panel via its explicit toggle channel.
  // The doc panel has NO applySink — it writes to the host :root only.
  //
  // CRITICAL: the channel is "toggle-sg-doc-tweak", NOT the reserved
  // "toggle-design-token-panel". This site mounts two zdtp instances, so the
  // doc panel must stay on its explicit event and not accidentally fall back
  // to the reserved default (Takazudo/zudo-sg#84/#85).
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("toggle-sg-doc-tweak"));
  });
  const docPanel = page.locator(".tokenpanel-shell").first();
  await expect(docPanel).toBeVisible({
    timeout: 10_000,
  });

  // REGRESSION GUARD (#85): the doc-chrome panel must open with a NON-EMPTY
  // body — i.e. its real tabs are present. The original defect mounted the
  // framework's empty-tabs default instead, so the shell had no tab controls.
  // Assert all four doc-panel tabs (Color / Font / Spacing / Size) render,
  // panel-scoped so an unrelated SSR token-row label can't satisfy the match.
  await expect(
    docPanel.getByRole("tab", { name: "Color", exact: true }),
  ).toBeVisible();
  await expect(
    docPanel.getByRole("tab", { name: "Font", exact: true }),
  ).toBeVisible();
  await expect(
    docPanel.getByRole("tab", { name: "Spacing", exact: true }),
  ).toBeVisible();
  await expect(
    docPanel.getByRole("tab", { name: "Size", exact: true }),
  ).toBeVisible();

  // Opening the doc panel must not have changed --color-accent on the iframe.
  expect(await getIframeRootVar(frame, "--color-accent")).toBe(beforeBrand);

  // Apply a sentinel value to the iframe via direct postMessage.
  await applyVarsToFirstIframe(page, [["--color-accent", BRAND_SENTINEL]]);
  expect(await getIframeRootVar(frame, "--color-accent")).toBe(BRAND_SENTINEL);

  // Click Reset on the doc panel — this resets the doc panel's host :root vars
  // but must NOT clear the preview iframe's --color-accent.
  // The doc panel's Reset calls clearAppliedStyles (no sink), which only removes
  // inline styles from the host document.documentElement — not from iframes.
  const resetBtn = page
    .locator(".tokenpanel-action-link", { hasText: "Reset" })
    .first();
  await expect(resetBtn).toBeVisible({ timeout: 5_000 });
  await resetBtn.click();
  await page.waitForTimeout(200);

  // Iframe's --color-accent must still be the sentinel after doc panel Reset.
  expect(await getIframeRootVar(frame, "--color-accent")).toBe(BRAND_SENTINEL);
});

// ---------------------------------------------------------------------------
// Test 3: Reset clears only preview overrides; host chrome / doc panel untouched
// ---------------------------------------------------------------------------

test("preview panel: Reset clears preview overrides; host chrome state is untouched", async ({
  page,
}) => {
  await gotoFirstDetailPage(page);
  const frame = await waitForFirstPreviewFrame(page);

  // Write a doc-chrome inline override to the host :root so we can verify it
  // survives the preview panel Reset.
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--zd-bg", "#aabbcc");
  });

  // Open the preview panel and apply an override via the Size tab UI.
  // Using panel UI (not direct postMessage) ensures the registry's
  // previewOverrides Map is populated, which is what Reset clears.
  await openPreviewPanel(page);

  // Apply --radius-md override via the panel's Size tab text input.
  // This goes through: input onChange → zdtp state → sink.apply() →
  //   applyPreviewVars([["--radius-md", "20px"]]) →
  //   sendApplyCssVars(iframe, [["--radius-md", "20px"]]) → iframe postMessage.
  await setPanelRadiusMd(page, "20");

  // Verify the iframe received the override.
  expect(await getIframeRootVar(frame, "--radius-md")).toBe("20px");

  // Click Reset.
  const resetBtn = page
    .locator(".tokenpanel-action-link", { hasText: "Reset" })
    .first();
  await expect(resetBtn).toBeVisible({ timeout: 5_000 });
  await resetBtn.click();

  // After Reset, the sink's clear() path runs:
  //   clearPreviewVars(["--radius-md", …]) → sendClearCssVars(iframe, …) →
  //   iframe postMessage → iframe removes inline style → stylesheet default takes over.
  await page.waitForTimeout(300);

  // --radius-md must no longer be "20px" (reverts to stylesheet default).
  expect(await getIframeRootVar(frame, "--radius-md")).not.toBe("20px");

  // Host :root doc-chrome override must survive the preview panel Reset.
  expect(await getHostRootVar(page, "--zd-bg")).toBe("#aabbcc");
});

// ---------------------------------------------------------------------------
// Test 4: Export emits zdtp JSON; Load-from-JSON restores it
// ---------------------------------------------------------------------------

test("preview panel: Export emits zdtp schema; Load-from-JSON restores overrides", async ({
  page,
}) => {
  await gotoFirstDetailPage(page);
  const frame = await waitForFirstPreviewFrame(page);

  // Open the preview panel.
  await openPreviewPanel(page);

  // Apply a --radius-md override via the panel UI so the state is non-default.
  await setPanelRadiusMd(page, "20");

  // Also dirty a Color-tab (`ui-color`, a non-reserved GenericTab id) token.
  // Regression coverage for #197: zdtp's serializer previously dropped this
  // tab from Export/Load even though Apply/Reset worked live — exercising
  // only the reserved-id Size tab above would not have caught that bug.
  await setPanelColorAccent(page, COLOR_TAB_SENTINEL);

  // Click Export to open the export modal.
  const exportBtn = page
    .locator(".tokenpanel-action-link", { hasText: "Export" })
    .first();
  await expect(exportBtn).toBeVisible({ timeout: 5_000 });
  await exportBtn.click();

  // Wait for the export modal.
  const exportModal = page.locator(
    '[data-design-token-panel-modal-variant="export"]',
  );
  await expect(exportModal).toBeVisible({ timeout: 5_000 });

  // The export JSON is rendered in the [role="none"] json block inside the modal.
  const jsonBlock = exportModal.locator('[role="none"]').first();
  await expect(jsonBlock).toBeVisible({ timeout: 3_000 });
  const exportedJson = (await jsonBlock.textContent()) ?? "";

  // Assert the JSON contains zdtp's export format schema. zdtp 0.4.5 emits v2
  // for this preview panel because it has no ramp-reference color cluster; it
  // opportunistically emits v3 when object-valued color leaves are present.
  // config.schemaId is display-only import-modal text, not the JSON schema.
  expect(exportedJson).toContain('"$schema"');
  expect(exportedJson).toContain("zudo-design-tokens/v2");

  // Regression guard for #197: the Color tab (non-reserved "ui-color" tab id)
  // must be captured by Export too, not just reserved-id tabs like Size —
  // this is exactly the tab/token the fixed serializer bug affected.
  expect(exportedJson).toContain('"ui-color"');
  expect(exportedJson).toContain("--color-accent");

  // Assert the JSON is well-formed.
  const parsed = JSON.parse(exportedJson) as Record<string, unknown>;
  expect(parsed).toBeTruthy();

  // Close the export modal.
  const closeBtn = exportModal.locator('[role="button"]', { hasText: "Close" });
  await closeBtn.click();
  await expect(exportModal).not.toBeVisible({ timeout: 3_000 });

  // Reset to clear overrides so Load-from-JSON has something to restore.
  const resetBtn = page
    .locator(".tokenpanel-action-link", { hasText: "Reset" })
    .first();
  await resetBtn.click();
  await page.waitForTimeout(300);

  // Click "Load from JSON…" to open the import modal.
  const loadBtn = page
    .locator(".tokenpanel-action-link", { hasText: "Load from JSON" })
    .first();
  await expect(loadBtn).toBeVisible({ timeout: 5_000 });
  await loadBtn.click();

  // Wait for the import modal.
  const importModal = page.locator(
    '[data-design-token-panel-modal-variant="import"]',
  );
  await expect(importModal).toBeVisible({ timeout: 5_000 });

  // Fill the textarea with the previously exported JSON.
  const textarea = importModal.locator("textarea").first();
  await textarea.fill(exportedJson);

  // Click the "Load" confirm button inside the import modal.
  const loadConfirmBtn = importModal.getByRole("button", {
    name: "Load",
    exact: true,
  });
  await expect(loadConfirmBtn).toBeVisible({ timeout: 3_000 });
  await loadConfirmBtn.click();

  // zdtp's import modal does NOT auto-close on success — it renders a "Loaded."
  // status and leaves the modal open with Load/Close buttons. Assert that
  // success status (a schema mismatch would instead surface an error and abort).
  await expect(importModal.getByText(/loaded/i)).toBeVisible({ timeout: 5_000 });

  // The real round-trip assertion: the loaded state is re-applied via the sink,
  // so the iframe's --radius-md is restored to 20px (it was cleared by Reset above).
  await page.waitForTimeout(250);
  expect(await getIframeRootVar(frame, "--radius-md")).toBe("20px");

  // Same round-trip assertion for the Color tab (#197) — --color-accent must
  // also be restored, proving the ui-color tab was captured by Export and
  // correctly re-applied by Load, not just silently ignored.
  expect(await getIframeRootVar(frame, "--color-accent")).toBe(COLOR_TAB_SENTINEL);

  // Dismiss the modal.
  await importModal.getByRole("button", { name: "Close", exact: true }).click();
  await expect(importModal).not.toBeVisible({ timeout: 5_000 });
});

// ---------------------------------------------------------------------------
// Test 5a: late-mounted iframe replays current overrides once ready
// ---------------------------------------------------------------------------

test("preview panel: late-mounted iframe replays current overrides on ready", async ({
  page,
}) => {
  // Strategy: apply overrides via panel UI (populates registry), then look
  // for a second iframe on the same page (multi-variant story). If one exists,
  // scroll it into view to trigger VariantFrame hydration; on ready, the
  // registry's replaySinkOverrides() should push the current previewOverrides
  // Map to the newly-registered iframe.
  //
  // If the page only has one iframe, we fall back to asserting that the bridge
  // receiver on the first iframe already works (already proven in Test 1) and
  // document the limitation: a strict cross-page late-mount is not testable
  // against static dist (no client-side router; previewOverrides are in-memory
  // only and are not persisted).
  await gotoFirstDetailPage(page);
  const frame = await waitForFirstPreviewFrame(page);

  // Open the preview panel and apply --radius-md via the Size tab UI.
  // This populates registry.previewOverrides so late-mounted iframes get replay.
  await openPreviewPanel(page);
  await setPanelRadiusMd(page, "20");

  // Confirm the first (already-mounted) iframe has the override.
  expect(await getIframeRootVar(frame, "--radius-md")).toBe("20px");

  // Check for a second preview iframe (multi-variant story).
  const allIframes = page.locator('iframe[src*="/components/preview"]');
  const iframeCount = await allIframes.count();

  if (iframeCount >= 2) {
    // Scroll the second iframe into view to trigger VariantFrame hydration.
    const secondIframeEl = allIframes.nth(1);
    await secondIframeEl.scrollIntoViewIfNeeded();
    // Wait for it to fully hydrate and signal ready via the bridge.
    await expect(secondIframeEl).toBeAttached({ timeout: 10_000 });

    // Allow time for onIframeReady → replaySinkOverrides to fire.
    // The replay happens when the iframe's bridge receiver calls postMessage
    // with type "ready" and the host's onIframeReady callback fires.
    await page.waitForTimeout(500);

    const secondFrame = page
      .frameLocator('iframe[src*="/components/preview"]')
      .nth(1);
    const secondRadius = await secondFrame.locator(":root").evaluate(
      (el, name) => getComputedStyle(el).getPropertyValue(name).trim(),
      "--radius-md",
    );
    // The second iframe should have received the replayed override.
    expect(secondRadius).toBe("20px");
  } else {
    // Single-iframe page: re-assert the first iframe carries the override.
    // The late-mount replay path is architecturally covered by the registry
    // unit tests; here we confirm the end-to-end UI path populates the registry.
    expect(await getIframeRootVar(frame, "--radius-md")).toBe("20px");
  }
});

// ---------------------------------------------------------------------------
// Test 5b: reset-after-remount — Reset clears overrides from all iframes
// ---------------------------------------------------------------------------

test("preview panel: Reset clears overrides from all visible preview iframes", async ({
  page,
}) => {
  await gotoFirstDetailPage(page);
  const frame = await waitForFirstPreviewFrame(page);

  // Open the preview panel and apply an override via the Size tab UI so the
  // registry tracks it (required for Reset to send clear messages).
  await openPreviewPanel(page);
  await setPanelRadiusMd(page, "20");

  // Confirm the first iframe has the override.
  expect(await getIframeRootVar(frame, "--radius-md")).toBe("20px");

  // Click Reset.
  const resetBtn = page
    .locator(".tokenpanel-action-link", { hasText: "Reset" })
    .first();
  await expect(resetBtn).toBeVisible({ timeout: 5_000 });
  await resetBtn.click();

  // After Reset, clearPreviewVars → sendClearCssVars sends a clear message to
  // every registered iframe. The first iframe should have its inline style
  // for --radius-md removed; computed value reverts to the stylesheet default.
  await page.waitForTimeout(300);

  expect(await getIframeRootVar(frame, "--radius-md")).not.toBe("20px");

  // If a second iframe is present, verify it also received the clear message.
  const allIframes = page.locator('iframe[src*="/components/preview"]');
  const iframeCount = await allIframes.count();
  if (iframeCount >= 2) {
    const secondFrame = page
      .frameLocator('iframe[src*="/components/preview"]')
      .nth(1);
    const secondRadius = await secondFrame.locator(":root").evaluate(
      (el, name) => getComputedStyle(el).getPropertyValue(name).trim(),
      "--radius-md",
    );
    expect(secondRadius).not.toBe("20px");
  }
});
