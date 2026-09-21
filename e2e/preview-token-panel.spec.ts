import { expect, test, type Page, type FrameLocator, type Locator } from "@playwright/test";

// ---------------------------------------------------------------------------
// H6 integration spec — Preview Token Panel (sg-preview-design-tokens/v1)
//
// Driving approach (hybrid):
//   Programmatic for iframe bridge verification: postMessage to the iframe
//   directly (mirrors what sendApplyCssVars does internally). Tests that the
//   iframe's bridge receiver is installed and working. Used for Test 1 (iframe
//   receiver + host isolation) and Test 2 (doc-chrome panel removal).
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
//   window.sgPreview: the project wrapper preserves the owner-autoload helpers
//   through lazy dynamic imports. Panel opening still uses the instance's
//   explicit CustomEvent channel — kept explicit (rather than the reserved
//   "toggle-design-token-panel") now that the doc-chrome panel is gone, because
//   it is the engine's own contract, not a dual-instance workaround.
//
// All five assertion groups required by issue #80 (H6) are present.
// ---------------------------------------------------------------------------

// Bridge constants — must match src/features/styleguide/token-tweak/
// iframe-css-vars-bridge.ts (project-owned; zudo-doc removed its own
// reusable iframe bridge as a repository-owned implementation detail,
// zudolab/zudo-doc#2761 — see that module's header comment).
const BRIDGE_SOURCE = "zudo-sg-token-tweak-bridge";

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
 * The CustomEvent path is registered by the native lazy bootstrap and verifies
 * that the "toggle-preview-token-panel" instance channel remains wired.
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
 * Click a panel header action ("Reset", "Export", "Load from JSON", …) by its
 * visible text, in either open panel (doc or preview).
 *
 * zdtp 0.5.1 collapses `.tokenpanel-header` actions into a "Panel actions"
 * popover once the panel's own container width drops below 1135px
 * (`@container tokenpanel`) — both zdtp instances this project docks are
 * narrower than that, so the header links are always hidden and the popover
 * is the only path. Handle both layouts: click the header link directly if
 * it's visible, otherwise open the popover first.
 *
 * Both branches must stay scoped. `.tokenpanel-action-link` is NOT unique to
 * the header: each tab body carries its own "Reset Font" / "Reset Size" /
 * "Reset Spacing" link with the same class, and `hasText` is a substring
 * match — so an unscoped `hasText: "Reset"` also matches those and would
 * silently reset one tab instead of the whole panel. `> ` restricts the
 * direct branch to the header's own action row (the popover is a nested
 * `div`, so it is excluded here and matched separately below). Likewise the
 * trigger is matched by `.tokenpanel-actions-menu-btn`, not by its
 * `aria-label` — the popover it opens carries the identical
 * `aria-label="Panel actions"`.
 */
async function clickPanelAction(page: Page, label: string): Promise<void> {
  const directLink = page
    .locator(".tokenpanel-header > .tokenpanel-action-link", { hasText: label })
    .first();
  if (await directLink.isVisible()) {
    await directLink.click();
    return;
  }

  const menuBtn = page.locator(".tokenpanel-actions-menu-btn").first();
  await expect(menuBtn).toBeVisible({ timeout: 5_000 });
  await menuBtn.click();

  const popoverLink = page
    .locator(".tokenpanel-actions-popover .tokenpanel-action-link", {
      hasText: label,
    })
    .first();
  await expect(popoverLink).toBeVisible({ timeout: 5_000 });
  await popoverLink.click();
}

/**
 * Navigate to the "Size" tab in the currently-open panel and set --radius-md
 * to a specific rem value using the text input (aria-label: "--radius-md value").
 * The row's unit is rem (it is authored as rem in packages/demo-ui/styles/tokens.css),
 * so typing "20" commits "20rem" — see #580.
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
 * project-owned iframe-css-vars-bridge postMessage API. Tests the iframe
 * receiver only; does NOT populate the panel's previewOverrides registry Map.
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
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await gotoFirstDetailPage(page);
  const frame = await waitForFirstPreviewFrame(page);

  // Confirm the panel is not yet mounted before opening.
  await expect(page.locator(".tokenpanel-shell").first()).not.toBeAttached();

  // Open the preview panel via the toggle event (verifies event channel wiring).
  await openPreviewPanel(page);
  await expect(page.locator(".tokenpanel-shell")).toHaveCount(1);
  await expect(page.locator("#sg-preview-tweak-root .tokenpanel-shell")).toBeVisible();

  // Apply overrides via the bridge postMessage API.
  // This tests that the iframe's bridge receiver (installIframeReceiver) is
  // installed and that inline style writes are reflected via getComputedStyle.
  const brandOverride = BRAND_SENTINEL;
  const radiusOverride = "20px";

  // Capture the host <html> baseline BEFORE applying. The host :root legitimately
  // defines base @zudo-sg/demo-ui tokens (src/styles/global.css aliases them onto the
  // doc chrome), so these are NOT empty — the correct isolation assertion is that
  // the preview override does not CHANGE the host value, not that it equals "".
  const hostBrandBefore = await getHostRootVar(page, "--color-accent");
  const hostRadiusBefore = await getHostRootVar(page, "--radius-md");

  await applyVarsToFirstIframe(page, [
    ["--color-accent", brandOverride],
    ["--radius-md", radiusOverride],
  ]);

  // Assert iframe :root has the overrides applied. The postMessage receiver
  // runs asynchronously, so poll the observable state instead of relying on
  // the helper's short scheduling settle under parallel browser load.
  await expect.poll(() => getIframeRootVar(frame, "--color-accent"))
    .toBe(brandOverride);
  await expect.poll(() => getIframeRootVar(frame, "--radius-md"))
    .toBe(radiusOverride);

  // Assert host <html> is UNCHANGED by the preview override — the applySink
  // routes writes to iframes only, never to the host :root.
  expect(await getHostRootVar(page, "--color-accent")).toBe(hostBrandBefore);
  expect(await getHostRootVar(page, "--radius-md")).toBe(hostRadiusBefore);
  // …and specifically never picked up the iframe sentinel values.
  expect(await getHostRootVar(page, "--color-accent")).not.toBe(brandOverride);
  expect(await getHostRootVar(page, "--radius-md")).not.toBe(radiusOverride);
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// Test 2: the doc-chrome token panel is GONE — only the preview panel remains
// ---------------------------------------------------------------------------

test("no doc-chrome token panel: the legacy toggle channel mounts nothing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await gotoFirstDetailPage(page);
  const frame = await waitForFirstPreviewFrame(page);

  const beforeBrand = await getIframeRootVar(frame, "--color-accent");

  // The header trigger and its prehydration capture script are both gone.
  await expect(page.locator("#sg-doc-tweak-trigger")).toHaveCount(0);
  await expect(page.locator("#zdtp-doc-prehydrate")).toHaveCount(0);

  // Dispatching the retired channel must be inert: no panel mounts, and the
  // preview panel (which listens on its own channel) does not open either.
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("toggle-sg-doc-tweak"));
  });
  await page.waitForTimeout(500);
  await expect(page.locator("#sg-doc-tweak-root")).toHaveCount(0);
  await expect(page.locator(".tokenpanel-shell")).toHaveCount(0);

  // …and nothing about the iframe changed.
  expect(await getIframeRootVar(frame, "--color-accent")).toBe(beforeBrand);
  expect(errors).toEqual([]);
});

test("package-owned docs do not mount the package token-panel bootstrap", async ({ page }) => {
  await page.goto("/docs/overview");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator([
    '[data-zfb-island$="DesignTokenPanelBootstrap"]',
    '[data-zfb-island-skip-ssr$="DesignTokenPanelBootstrap"]',
  ].join(","))).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Test 3: Reset clears only preview overrides; host chrome untouched
// ---------------------------------------------------------------------------

test("preview panel: Reset clears preview overrides; host chrome state is untouched", async ({
  page,
}) => {
  await gotoFirstDetailPage(page);
  const frame = await waitForFirstPreviewFrame(page);

  // Write a host-chrome inline override to the host :root so we can verify it
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
  //   applyPreviewVars([["--radius-md", "20rem"]]) →
  //   sendApplyCssVars(iframe, [["--radius-md", "20rem"]]) → iframe postMessage.
  await setPanelRadiusMd(page, "20");

  // Verify the iframe received the override.
  expect(await getIframeRootVar(frame, "--radius-md")).toBe("20rem");

  // Click Reset.
  await clickPanelAction(page, "Reset");

  // After Reset, the sink's clear() path runs:
  //   clearPreviewVars(["--radius-md", …]) → sendClearCssVars(iframe, …) →
  //   iframe postMessage → iframe removes inline style → stylesheet default takes over.
  await page.waitForTimeout(300);

  // --radius-md must no longer be "20rem" (reverts to stylesheet default).
  expect(await getIframeRootVar(frame, "--radius-md")).not.toBe("20rem");

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
  await clickPanelAction(page, "Export");

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
  await clickPanelAction(page, "Reset");
  await page.waitForTimeout(300);

  // Click "Load from JSON…" to open the import modal.
  await clickPanelAction(page, "Load from JSON");

  // Wait for the import modal.
  const importModal = page.locator(
    '[data-design-token-panel-modal-variant="import"]',
  );
  await expect(importModal).toBeVisible({ timeout: 5_000 });

  // Fill the textarea with the previously exported JSON.
  const textarea = importModal.locator("textarea").first();
  await textarea.fill(exportedJson);

  // zdtp 0.8.0 gates loading behind its scoped import flow: analyze the JSON
  // first, then leave the default tabs/options selected and load it.
  await importModal
    .getByRole("button", { name: "Analyze", exact: true })
    .click();
  await expect(
    importModal.getByRole("heading", { name: "Import scope", exact: true }),
  ).toBeVisible({ timeout: 5_000 });

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
  // so the iframe's --radius-md is restored to 20rem (it was cleared by Reset above).
  await page.waitForTimeout(250);
  expect(await getIframeRootVar(frame, "--radius-md")).toBe("20rem");

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
  expect(await getIframeRootVar(frame, "--radius-md")).toBe("20rem");

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
    expect(secondRadius).toBe("20rem");
  } else {
    // Single-iframe page: re-assert the first iframe carries the override.
    // The late-mount replay path is architecturally covered by the registry
    // unit tests; here we confirm the end-to-end UI path populates the registry.
    expect(await getIframeRootVar(frame, "--radius-md")).toBe("20rem");
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
  expect(await getIframeRootVar(frame, "--radius-md")).toBe("20rem");

  // Click Reset.
  await clickPanelAction(page, "Reset");

  // After Reset, clearPreviewVars → sendClearCssVars sends a clear message to
  // every registered iframe. The first iframe should have its inline style
  // for --radius-md removed; computed value reverts to the stylesheet default.
  await page.waitForTimeout(300);

  expect(await getIframeRootVar(frame, "--radius-md")).not.toBe("20rem");

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
    expect(secondRadius).not.toBe("20rem");
  }
});

// ---------------------------------------------------------------------------
// Header token trigger (#816) — the withZudoSg()-injected header-right button
// that opens this same preview token panel from anywhere on the four engine
// routes. See packages/styleguide/src/config/index.ts (withHeaderTokenTrigger)
// and packages/styleguide/src/routes/_chrome.tsx (the data-sg-engine-route
// marker its inline sync() script looks for).
// ---------------------------------------------------------------------------

const HEADER_TRIGGER = "#sg-preview-tokens-trigger";

/**
 * Click a link and wait for the client-router swap to finish. The header is
 * `data-zfb-transition-persist`, so a plain click + locator assertion can
 * race the swap's DOM mutation; waiting for `zfb:after-swap` (the event the
 * trigger's own inline sync() script also listens for) matches production
 * timing. Mirrors the identically-named helper in detail-workbench.spec.ts /
 * preview-fidelity.spec.ts (not shared — each e2e spec file is self-contained).
 *
 * Takes a Locator, not a selector string: several call sites need a scoped
 * locator (e.g. `.first()` on a selector matching many elements), and
 * re-resolving from a bare selector at click time would violate Playwright's
 * strict mode on those pages.
 */
async function clickAndWaitForSwap(page: Page, target: Locator): Promise<void> {
  const swapped = page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error("Timed out waiting for zfb:after-swap")),
        10_000,
      );
      document.addEventListener(
        "zfb:after-swap",
        () => {
          window.clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
    });
  });
  await target.click();
  await swapped;
}

test("header trigger: visible on a component detail page; opens the same preview panel", async ({
  page,
}) => {
  await gotoFirstDetailPage(page);
  const frame = await waitForFirstPreviewFrame(page);

  const trigger = page.locator(HEADER_TRIGGER);
  await expect(trigger).toBeVisible();

  await expect(page.locator(".tokenpanel-shell")).not.toBeAttached();
  await trigger.click();
  await expect(page.locator(".tokenpanel-shell").first()).toBeVisible({
    timeout: 10_000,
  });

  // Same isolation contract as Test 1: an edit through the header-opened
  // panel reaches the preview iframe's :root, never the host <html>.
  const hostBrandBefore = await getHostRootVar(page, "--color-accent");
  await applyVarsToFirstIframe(page, [["--color-accent", BRAND_SENTINEL]]);
  await expect.poll(() => getIframeRootVar(frame, "--color-accent")).toBe(
    BRAND_SENTINEL,
  );
  expect(await getHostRootVar(page, "--color-accent")).toBe(hostBrandBefore);
});

test("header trigger: visible on /tokens and /components — the two iframe-less engine routes", async ({
  page,
}) => {
  // Regression guard for F6 (issue #813): /tokens has zero preview iframes
  // and /components renders every component inline server-side, so an
  // iframe-presence-based visibility predicate would wrongly hide the
  // trigger on exactly the two pages that already offer the panel.
  await page.goto("/tokens");
  await expect(page.locator('iframe[src*="/components/preview"]')).toHaveCount(0);
  await expect(page.locator(HEADER_TRIGGER)).toBeVisible();

  await page.goto("/components");
  await expect(page.locator(HEADER_TRIGGER)).toBeVisible();
});

test("header trigger: present but hidden on /docs/overview", async ({ page }) => {
  await page.goto("/docs/overview");
  const trigger = page.locator(HEADER_TRIGGER);
  await expect(trigger).toBeAttached();
  await expect(trigger).toBeHidden();
});

// The issue asks for the same "present but hidden" assertion on `/`, but
// pages/index.tsx renders its own header via HeaderWithDefaults, which reads
// settings.headerRightItems straight from src/config/settings.ts — a
// different array than the one withHeaderTokenTrigger() appends to (the
// zudo-doc routes-plugin's own settings, which only feeds the
// package-injected routes: /docs/*, /components*, /tokens, /404). Confirmed
// against the built output: dist/index.html has zero occurrences of
// "sg-preview-tokens-trigger", while dist/docs/overview/index.html has it
// twice (button + inline script). So on `/` the trigger is absent from the
// DOM entirely, not present-and-hidden — this test asserts the real
// behaviour instead of forcing the issue's literal wording.
test("header trigger: absent from / — its header does not receive the injected headerRightItems", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(HEADER_TRIGGER)).toHaveCount(0);
});

test("header trigger: SPA navigation toggles visibility in both directions", async ({
  page,
}) => {
  await page.goto("/docs/overview");
  const trigger = page.locator(HEADER_TRIGGER);
  await expect(trigger).toBeHidden();

  // docs/overview -> components (catalog) -> a component detail page, both
  // hops via the client router (not page.goto) so the trigger's
  // AFTER_NAVIGATE_EVENT listener — not just its DOMContentLoaded path — is
  // what reveals it. The header carries data-zfb-transition-persist, so this
  // also proves the sync() re-run survives the persisted-node navigation.
  await clickAndWaitForSwap(
    page,
    page.locator('[data-header-nav] a[data-nav-category="components"]'),
  );
  await expect(trigger).toBeVisible();

  const firstCard = page.locator("[data-sg-card]").first();
  await expect(firstCard).toBeAttached();
  const detailHref = await firstCard.getAttribute("href");
  expect(detailHref).toBeTruthy();
  await clickAndWaitForSwap(page, firstCard);
  // trailingSlash normalizes the client-router URL, so match with or without one.
  await expect(page).toHaveURL(
    new RegExp(detailHref!.replace(/\//g, "\\/") + "\\/?$"),
  );
  await expect(trigger).toBeVisible();

  // …and the reverse hop: component page -> /docs/overview hides it again.
  // This is the direction a naive implementation strands, since the header
  // node itself is reused (persisted) rather than re-created.
  await clickAndWaitForSwap(
    page,
    page.locator('[data-header-nav] a[data-nav-category="overview"]'),
  );
  await expect(page).toHaveURL(/\/docs\/overview\/?$/);
  await expect(trigger).toBeHidden();
});
