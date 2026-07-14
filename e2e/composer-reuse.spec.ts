import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  captureUnexpectedBrowserErrors,
  inspectComposerDatabase,
  openComposerLibrary,
  prepareLegacyMigration,
  replaceComposerRecords,
  resetComposerPersistence,
  type BrowserCompositionRecord,
} from "./support/composer-persistence";
import {
  SOURCE_RECORD_ID,
  boundConsumerRecord,
  globalTemplateRecord,
  legacyV1Record,
  patternRecord,
  patternTargetRecord,
  privatePatternRecord,
  reuseDocument,
} from "./support/composer-reuse";

const PATTERN_SCOPE_COPY =
  "Whole-Composition scope: publishing immediately makes this entire Composition, including every root component, a reusable Pattern. It does not publish the selected subtree.";

async function seedRecords(page: Page, records: readonly BrowserCompositionRecord[]): Promise<void> {
  await resetComposerPersistence(page);
  await openComposerLibrary(page);
  await replaceComposerRecords(page, records);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Composition library" })).toBeVisible();
}

async function openRecord(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: `Open ${name}` }).click();
  await expect(page).toHaveURL(/#\/composition\/indexeddb\/[^/]+$/);
  await expect(page.frameLocator(".sg-composer-canvas-frame iframe").locator("[data-composer-canvas]")).toBeVisible();
}

async function currentRecord(page: Page, id: string): Promise<BrowserCompositionRecord> {
  const record = (await inspectComposerDatabase(page)).records.find((candidate) => candidate.id === id);
  expect(record, `expected persisted record ${id}`).toBeDefined();
  return record!;
}

function chooser(page: Page): Locator {
  return page.locator("dialog.sg-composer-chooser");
}

async function addProseToConsumer(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Add component to document root" }).click();
  const dialog = chooser(page);
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder("Search components…").fill("ProseP");
  await dialog.getByRole("button", { name: "ProseP", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".sg-composer-save-status")).toHaveAttribute("data-sg-status", "saved");
}

async function openLinkedSource(page: Page): Promise<void> {
  const treeSourceLink = page
    .locator('.sg-composer-tree [data-sg-linked-frame="resolved"]')
    .getByRole("button", { name: "Open source" });
  await expect(treeSourceLink).toHaveCount(1);
  await treeSourceLink.click();
  await expect(page.getByText("Site shell", { exact: true })).toBeVisible();
}

async function dialogRect(page: Page, dialog: Locator) {
  return dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      overflowY: style.overflowY,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight,
      documentWidth: document.documentElement.scrollWidth,
    };
  });
}

async function resizeInspectorTo320px(page: Page): Promise<void> {
  const resizer = page.getByRole("separator", { name: "Resize inspector panel" });
  await expect(resizer).toBeVisible();
  await resizer.focus();

  // A fresh Inspector starts at its 220px floor. Drive the public keyboard
  // separator from its 480px desktop maximum back to 320px in ten 16px steps.
  await resizer.press("End");
  await expect(resizer).toHaveAttribute("aria-valuenow", "480");
  for (let step = 0; step < 10; step += 1) await resizer.press("ArrowRight");
  await expect(resizer).toHaveAttribute("aria-valuenow", "320");
}

async function assertReuseControlsFitDesktopAnd320pxInspector(page: Page, action: Locator): Promise<void> {
  const inspector = page.locator(".sg-composer-inspector");
  await expect(inspector).toBeVisible();
  await expect(action).toBeVisible();
  await expect(action).toBeInViewport();

  const [geometry, actionGeometry] = await Promise.all([
    inspector.evaluate((element) => {
      const inspectorRect = element.getBoundingClientRect();
      return {
        inspectorWidth: inspectorRect.width,
        inspectorClientWidth: element.clientWidth,
        inspectorScrollWidth: element.scrollWidth,
        inspectorLeft: inspectorRect.left,
        inspectorRight: inspectorRect.right,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    }),
    action.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    }),
  ]);

  // The test resized this desktop Inspector through its public separator to
  // 320px. Check both the page and that narrow rail instead of a screenshot.
  expect(geometry.inspectorWidth).toBeCloseTo(320, 0);
  expect(geometry.inspectorScrollWidth).toBeLessThanOrEqual(geometry.inspectorClientWidth);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(actionGeometry.left).toBeGreaterThanOrEqual(geometry.inspectorLeft);
  expect(actionGeometry.right).toBeLessThanOrEqual(geometry.inspectorRight);
}

test.describe("Composer reuse cross-feature acceptance", () => {
  test("creates a live Global-template consumer, protects its source, and recovers both detach paths", async ({
    page,
  }) => {
    const errors = captureUnexpectedBrowserErrors(page);
    await seedRecords(page, [
      globalTemplateRecord(),
      boundConsumerRecord("broken-consumer", "Broken consumer"),
    ]);

    await expect(page.getByText("Global template · Main content", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "New composition" }).first().click();
    const newDialog = page.getByRole("dialog", { name: "New composition" });
    await expect(newDialog).toBeVisible();
    await newDialog.getByRole("button", { name: /Site shell/ }).click();
    await newDialog.getByLabel("Name").fill("Bound consumer");
    await newDialog.getByRole("button", { name: "Create composition" }).click();
    await expect(page.getByText("Linked Global template", { exact: true })).toBeVisible();

    const consumerId = decodeURIComponent(page.url().split("/").at(-1) ?? "");
    const newConsumer = await currentRecord(page, consumerId);
    expect(reuseDocument(newConsumer)).toMatchObject({
      schemaVersion: 2,
      root: [],
      binding: { sourceRecordId: SOURCE_RECORD_ID, outletId: "main-content" },
    });

    await addProseToConsumer(page);
    const consumerAfterAdd = await currentRecord(page, consumerId);
    expect(reuseDocument(consumerAfterAdd).root).toHaveLength(1);

    // Use the public persistence boundary to create a source/local raw-id
    // collision. The rendered nodes must remain distinct by owner-qualified
    // identity; this is not a private renderer test seam.
    const collisionRecords = (await inspectComposerDatabase(page)).records.map((entry) => {
      if (entry.id !== consumerId) return entry;
      const document = reuseDocument(entry);
      return {
        ...entry,
        document: {
          ...document,
          root: document.root.map((node, index) => index === 0 ? { ...node, id: "source-header" } : node),
        },
      };
    });
    await replaceComposerRecords(page, collisionRecords);
    await page.reload();
    const canvas = page.frameLocator(".sg-composer-canvas-frame iframe");
    await expect(canvas.locator('[data-zc-node-id="source-header"][data-zc-owner="global-template"]')).toHaveCount(1);
    await expect(canvas.locator('[data-zc-node-id="source-header"][data-zc-owner="local"]')).toHaveCount(1);
    await expect(page.locator('[data-sg-tree-node-id="source-header"]')).toHaveCount(1);

    await openLinkedSource(page);
    await page.locator('[data-sg-tree-node-id="source-header"] .sg-composer-tree-select').click();
    const heading = page.locator("#sg-composer-inspector").getByLabel("Heading");
    await heading.fill("Updated source heading");
    await heading.press("Tab");
    await expect(page.locator(".sg-composer-save-status")).toHaveAttribute("data-sg-status", "saved");

    await page.getByRole("button", { name: "Library", exact: true }).click();
    await openRecord(page, "Bound consumer");
    await expect(canvas.getByText("Updated source heading", { exact: true })).toBeVisible();
    const stillLinked = await currentRecord(page, consumerId);
    expect(reuseDocument(stillLinked)).toMatchObject({
      binding: { sourceRecordId: SOURCE_RECORD_ID, outletId: "main-content" },
      root: [{ id: "source-header" }],
    });

    // Global-template publication remains distinct from Pattern publication,
    // and clearing it goes through the same provider-owned dependency scan as
    // deletion; a live consumer prevents an optimistic unpublish.
    await openLinkedSource(page);
    await expect(page.getByText(/Global templates are published from Structure by choosing a real empty component slot/i)).toBeVisible();
    await expect(page.getByText("Template outlet: Main content. Managed from Structure.")).toBeVisible();
    await page.getByRole("button", { name: "Unpublish Global template" }).click();
    const unpublishConfirm = page.getByRole("group", { name: "Unpublish Global template?" });
    await expect(unpublishConfirm).toBeVisible();
    await expect(unpublishConfirm.getByRole("button", { name: "Cancel" })).toBeFocused();
    await unpublishConfirm.getByRole("button", { name: "Unpublish Global template" }).click();
    await expect(page.locator("[data-sg-reuse-feedback]")).toContainText("Cannot unpublish this Global template while");
    expect(reuseDocument(await currentRecord(page, SOURCE_RECORD_ID)).publication)
      .toMatchObject({ kind: "global-template" });
    await page.getByRole("button", { name: "Library", exact: true }).click();
    await openRecord(page, "Bound consumer");

    await page.getByRole("button", { name: "Export JSX", exact: true }).click();
    const exportDialog = page.getByRole("dialog", { name: /Export/ });
    await expect(exportDialog).toContainText("Resolved standalone snapshot");
    await expect(exportDialog.getByRole("button", { name: "Copy resolved standalone snapshot" })).toBeEnabled();
    await exportDialog.getByRole("button", { name: "Close", exact: true }).click();

    // A resolved detach snapshots only this consumer and reissues the mixed
    // shell/local ids. The other consumer keeps the source deletion guard live.
    await page.locator('[data-sg-linked-frame="resolved"]').getByRole("button", { name: "Detach" }).click();
    await expect(page.getByText("Linked Global template", { exact: true })).toHaveCount(0);
    const detached = reuseDocument(await currentRecord(page, consumerId));
    expect(detached.binding).toBeUndefined();
    expect(detached.root).toHaveLength(3);
    expect(detached.root.flatMap((node) => [node.id, ...Object.values(node.slots).flat().map((child) => child.id)]))
      .not.toContain("source-header");

    await page.getByRole("button", { name: "Library", exact: true }).click();
    await page.getByRole("button", { name: "Delete Site shell" }).click();
    await page.getByRole("button", { name: "Delete composition", exact: true }).click();
    await expect(page.getByRole("button", { name: "Open Site shell" })).toBeVisible();
    expect(await currentRecord(page, SOURCE_RECORD_ID)).toBeDefined();

    // Model an external source loss after the guarded normal delete. The
    // consumer must block output until the explicit local-only recovery.
    const withoutSource = (await inspectComposerDatabase(page)).records
      .filter((entry) => entry.id !== SOURCE_RECORD_ID);
    await replaceComposerRecords(page, withoutSource);
    await openRecord(page, "Broken consumer");
    const treeUnavailableFrame = page.locator('.sg-composer-tree [data-sg-linked-frame="blocked"]');
    await expect(treeUnavailableFrame).toHaveCount(1);
    await expect(treeUnavailableFrame).toContainText("Linked template unavailable");
    await page.getByRole("button", { name: "Export JSX", exact: true }).click();
    await expect(page.getByRole("dialog", { name: /Export/ })).toContainText("Copy JSX is blocked");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Remove broken binding" }).click();
    await expect(page.getByText("Linked template unavailable", { exact: true })).toHaveCount(0);
    const repaired = reuseDocument(await currentRecord(page, "broken-consumer"));
    expect(repaired.binding).toBeUndefined();
    expect(repaired.root).toEqual([]);
    expect(errors).toEqual({ pageErrors: [], consoleErrors: [] });
  });

  test("inserts a multi-root Pattern as fresh local nodes and leaves it independent from its source", async ({
    page,
  }) => {
    const errors = captureUnexpectedBrowserErrors(page);
    await seedRecords(page, [patternRecord(), patternTargetRecord()]);
    await openRecord(page, "Pattern target");
    await page.getByRole("button", { name: "Expand Stack" }).click();
    await page.getByRole("button", { name: "Add component to Content in Stack" }).click();
    const dialog = chooser(page);
    await dialog.getByRole("tab", { name: "Patterns" }).click();
    await dialog.getByRole("button", { name: /Marketing block/ }).click();
    await expect(dialog.getByRole("button", { name: "Insert Pattern" })).toBeEnabled();
    await dialog.getByRole("button", { name: "Insert Pattern" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator(".sg-composer-save-status")).toHaveAttribute("data-sg-status", "saved");

    const target = reuseDocument(await currentRecord(page, "pattern-target"));
    const inserted = target.root[0]!.slots.content!;
    expect(inserted).toHaveLength(2);
    expect(inserted.map((node) => node.id)).not.toEqual(["pattern-heading", "pattern-cta"]);

    await page.getByRole("button", { name: "Library", exact: true }).click();
    await page.getByRole("button", { name: "Delete Marketing block" }).click();
    await page.getByRole("button", { name: "Delete composition", exact: true }).click();
    await expect(page.getByRole("button", { name: "Open Marketing block" })).toHaveCount(0);
    await openRecord(page, "Pattern target");
    const afterSourceDelete = reuseDocument(await currentRecord(page, "pattern-target"));
    expect(afterSourceDelete.root[0]!.slots.content!.map((node) => node.id)).toEqual(inserted.map((node) => node.id));
    expect(errors).toEqual({ pageErrors: [], consoleErrors: [] });
  });

  test("publishes, discovers, inserts, and unpublishes a private multi-root Pattern without changing its inserted copy", async ({
    page,
  }) => {
    const errors = captureUnexpectedBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await seedRecords(page, [privatePatternRecord(), patternTargetRecord()]);
    await openRecord(page, "Marketing block");
    await resizeInspectorTo320px(page);

    const sourceBeforePublication = reuseDocument(await currentRecord(page, "marketing-pattern"));
    expect(sourceBeforePublication.publication).toBeUndefined();
    expect(sourceBeforePublication.root).toHaveLength(2);

    const publish = page.getByRole("button", { name: "Publish as Pattern" });
    await expect(publish).toHaveAccessibleName("Publish as Pattern");
    await expect(publish).toHaveAccessibleDescription(PATTERN_SCOPE_COPY);
    await expect(page.getByText(PATTERN_SCOPE_COPY)).toBeVisible();
    await assertReuseControlsFitDesktopAnd320pxInspector(page, publish);
    await publish.focus();
    await page.keyboard.press("Enter");

    await expect(page.getByText("Published as Pattern")).toBeVisible();
    await expect(page.getByText(
      "Available as a reusable Pattern in this document. The Composer save status reports whether this change is durably saved.",
    )).toBeVisible();
    const unpublish = page.getByRole("button", { name: "Unpublish Pattern" });
    await expect(unpublish).toBeFocused();
    await assertReuseControlsFitDesktopAnd320pxInspector(page, unpublish);

    // The accepted UI state is not the persistence authority. Wait for the
    // existing status indicator, then read the real IndexedDB source record
    // before treating the Pattern as catalog-ready.
    await expect(page.locator(".sg-composer-save-status")).toHaveAttribute("data-sg-status", "saved");
    await expect.poll(async () => reuseDocument(await currentRecord(page, "marketing-pattern")).publication?.kind)
      .toBe("pattern");
    await expect(page.locator(".sg-composer-save-status")).toHaveAttribute("data-sg-status", "saved");

    await page.getByRole("button", { name: "Library", exact: true }).click();
    await openRecord(page, "Pattern target");
    await page.getByRole("button", { name: "Expand Stack" }).click();
    await page.getByRole("button", { name: "Add component to Content in Stack" }).click();
    const insertDialog = chooser(page);
    await insertDialog.getByRole("tab", { name: "Patterns" }).click();
    await expect(insertDialog.getByRole("button", { name: /Marketing block/ })).toBeVisible();
    await insertDialog.getByRole("button", { name: /Marketing block/ }).click();
    await expect(insertDialog.getByRole("button", { name: "Insert Pattern" })).toBeEnabled();
    await insertDialog.getByRole("button", { name: "Insert Pattern" }).click();
    await expect(insertDialog).not.toBeVisible();
    await expect(page.locator(".sg-composer-save-status")).toHaveAttribute("data-sg-status", "saved");
    await expect.poll(async () => {
      const target = reuseDocument(await currentRecord(page, "pattern-target"));
      return target.root[0]?.slots.content?.length ?? 0;
    }).toBe(2);
    await expect(page.locator(".sg-composer-save-status")).toHaveAttribute("data-sg-status", "saved");

    const insertedTarget = reuseDocument(await currentRecord(page, "pattern-target"));
    const inserted = insertedTarget.root[0]!.slots.content!;
    const insertedNodeIds = inserted.map((node) => node.id);
    const insertedContent = inserted.map((node) => ({ componentId: node.componentId, props: node.props }));
    expect(insertedNodeIds).toHaveLength(2);
    expect(insertedNodeIds).not.toEqual(sourceBeforePublication.root.map((node) => node.id));
    expect(insertedContent).toEqual(sourceBeforePublication.root.map((node) => ({
      componentId: node.componentId,
      props: node.props,
    })));

    await page.getByRole("button", { name: "Library", exact: true }).click();
    await openRecord(page, "Marketing block");
    const unpublishPattern = page.getByRole("button", { name: "Unpublish Pattern" });
    await unpublishPattern.focus();
    await page.keyboard.press("Enter");
    const confirmation = page.getByRole("group", { name: "Unpublish Pattern?" });
    const cancel = confirmation.getByRole("button", { name: "Cancel" });
    await expect(cancel).toBeFocused();
    await expect(confirmation.getByText(
      "This immediately removes this Composition’s reusable Pattern status. It does not delete the Composition.",
    )).toBeVisible();
    await assertReuseControlsFitDesktopAnd320pxInspector(page, cancel);
    await page.keyboard.press("Enter");
    await expect(unpublishPattern).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(cancel).toBeFocused();
    const confirm = confirmation.getByRole("button", { name: "Unpublish Pattern" });
    await page.keyboard.press("Tab");
    await expect(confirm).toBeFocused();
    await page.keyboard.press("Space");
    await expect(publish).toBeFocused();
    await assertReuseControlsFitDesktopAnd320pxInspector(page, publish);
    await expect(page.locator(".sg-composer-save-status")).toHaveAttribute("data-sg-status", "saved");
    await expect.poll(async () => reuseDocument(await currentRecord(page, "marketing-pattern")).publication)
      .toBeUndefined();
    await expect(page.locator(".sg-composer-save-status")).toHaveAttribute("data-sg-status", "saved");

    // Reopen the target's catalog after the persisted unpublish. The source
    // must be absent while the locally cloned forest remains byte-for-byte
    // independent from the source's publication lifecycle.
    await page.getByRole("button", { name: "Library", exact: true }).click();
    await openRecord(page, "Pattern target");
    await page.getByRole("button", { name: "Expand Stack" }).click();
    await page.getByRole("button", { name: "Add component to Content in Stack" }).click();
    const reopenedCatalog = chooser(page);
    await reopenedCatalog.getByRole("tab", { name: "Patterns" }).click();
    await expect(reopenedCatalog).toContainText("No published Patterns are available.");
    await expect(reopenedCatalog.getByRole("button", { name: /Marketing block/ })).toHaveCount(0);

    const targetAfterUnpublish = reuseDocument(await currentRecord(page, "pattern-target"));
    const persistedInserted = targetAfterUnpublish.root[0]!.slots.content!;
    expect(persistedInserted.map((node) => node.id)).toEqual(insertedNodeIds);
    expect(persistedInserted.map((node) => ({ componentId: node.componentId, props: node.props })))
      .toEqual(insertedContent);
    expect(errors).toEqual({ pageErrors: [], consoleErrors: [] });
  });

  test("measures the New and Add dialog geometry, reset behavior, and v1 migration in a real browser", async ({
    page,
  }) => {
    await prepareLegacyMigration(page, JSON.stringify(legacyV1Record()));
    await openComposerLibrary(page);
    const migrated = (await inspectComposerDatabase(page)).records.find((entry) => entry.id === "legacy-v1");
    expect(migrated).toBeDefined();
    const migratedDocument = reuseDocument(migrated!);
    expect(migratedDocument.schemaVersion).toBe(2);
    expect(migratedDocument).not.toHaveProperty("binding");
    expect(migratedDocument).not.toHaveProperty("publication");

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "New composition" }).first().click();
    const newDialog = page.getByRole("dialog", { name: "New composition" });
    await expect(newDialog).toBeVisible();
    const newInitial = await dialogRect(page, newDialog);
    expect(newInitial).toMatchObject({ left: 24, top: 24, width: 1232, height: 852 });
    await newDialog.getByLabel("Search Global templates").fill("no matching template");
    await expect(newDialog).toContainText("No eligible Global templates are available from this provider.");
    const resize = newDialog.getByRole("button", { name: "Resize dialog" });
    await resize.focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowUp");
    const resized = await dialogRect(page, newDialog);
    expect(resized.width).toBeLessThan(newInitial.width);
    expect(resized.height).toBeLessThan(newInitial.height);
    await page.keyboard.press("Home");
    await expect.poll(() => dialogRect(page, newDialog)).toMatchObject({ left: 24, top: 24, width: 1232, height: 852 });
    await newDialog.getByRole("button", { name: "Cancel" }).click();

    await openRecord(page, "Legacy composition");
    await page.getByRole("button", { name: "Add component to document root" }).click();
    const addDialog = chooser(page);
    await expect(addDialog).toBeVisible();
    await expect(addDialog.getByRole("button", { name: "Resize dialog" })).toHaveCount(0);
    const addInitial = await dialogRect(page, addDialog);
    const moveGrip = addDialog.getByRole("button", { name: "Move dialog" });
    await moveGrip.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");
    const moved = await dialogRect(page, addDialog);
    expect(moved.width).toBe(addInitial.width);
    expect(moved.height).toBe(addInitial.height);
    expect(moved.left).toBeGreaterThan(addInitial.left);
    expect(moved.top).toBeGreaterThan(addInitial.top);
    await page.keyboard.press("Home");
    await expect.poll(() => dialogRect(page, addDialog)).toMatchObject({ left: 24, top: 24, width: 1232, height: 852 });
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Library", exact: true }).click();
    await page.getByRole("button", { name: "New composition" }).first().click();
    const narrow = await dialogRect(page, page.getByRole("dialog", { name: "New composition" }));
    expect(narrow).toMatchObject({ left: 8, top: 8, width: 374, height: 828 });
    expect(narrow.documentWidth).toBeLessThanOrEqual(narrow.viewportWidth);
  });
});
