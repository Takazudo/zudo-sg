import { chromium } from "@playwright/test";

const prototypeUrl = process.env.COMPOSER_PROTOTYPE_URL ?? "http://127.0.0.1:4173/";

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 920 }, colorScheme: "dark" });
const errors = [];
let checkCount = 0;
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

function assert(condition, message) {
  checkCount += 1;
  if (!condition) throw new Error(message);
}

await page.goto(prototypeUrl, { waitUntil: "load" });
await page.evaluate(() => {
  localStorage.clear();
  const legacyRoot = JSON.parse(JSON.stringify(state.root));
  legacyRoot.slots.children[0].props.heading = "Legacy state should not load";
  delete legacyRoot.slots.children[0].props.variant;
  const split = legacyRoot.slots.children[1].slots.children.find((node) => node.type === "SplitLayout");
  delete split.props.minHeight;
  localStorage.setItem("zudo-sg-composer-prototype-v1", JSON.stringify({
    root: legacyRoot,
    selectedId: "split-main",
    mode: "edit",
    viewport: "desktop",
    expandedIds: ["root", "container-main", "split-main"],
    panelWidths: { left: 288, right: 336 },
  }));
});
await page.reload({ waitUntil: "load" });

assert((await page.locator("#node-count").textContent()) === "14", "Initial sample should contain 14 components");
assert(!await page.getByText("Legacy state should not load", { exact: true }).isVisible(), "Legacy v1 state should be ignored after the manifest schema change");
assert(!/undefined|NaN/.test(await page.evaluate(() => generateSource())), "Fresh export should not contain missing legacy prop values");
assert(await page.locator('[data-tree-node-id="split-main"] [data-select-node="split-main"]').getAttribute("aria-pressed") === "true", "SplitLayout should start selected");
assert(await page.getByText("Left column", { exact: true }).first().isVisible(), "Named left slot should be visible");
assert(await page.getByText("Right column", { exact: true }).first().isVisible(), "Named right slot should be visible");

const stackDisclosure = page.locator('[data-toggle-node="stack-right"]');
await stackDisclosure.focus();
await page.keyboard.press("Enter");
assert(await page.locator('[data-toggle-node="stack-right"]').getAttribute("aria-expanded") === "false", "Keyboard should collapse a container row");
assert(await page.evaluate(() => document.activeElement?.dataset.toggleNode === "stack-right"), "Disclosure focus should survive tree rerender");
await page.keyboard.press("Enter");
assert(await page.locator('[data-toggle-node="stack-right"]').getAttribute("aria-expanded") === "true", "Keyboard should expand a container row");

await page.locator('[data-select-node="copy-intro"]').focus();
await page.keyboard.press("Enter");
assert(await page.evaluate(() => document.activeElement?.dataset.selectNode === "copy-intro"), "Selection focus should survive tree rerender");
const bodyControl = page.locator('#inspector textarea[data-prop="children"]');
await bodyControl.fill("Updated by the Composer interaction check.");
assert(await page.locator("#composition-canvas").getByText("Updated by the Composer interaction check.", { exact: true }).isVisible(), "Prop edit should update canvas");

await page.locator('[data-add-parent="split-main"][data-add-slot="right"]').click();
assert(await page.locator("#component-dialog").getAttribute("open") !== null, "Component chooser should open");
assert((await page.locator("#add-target-label").textContent()).includes("Right column"), "Chooser should retain the right-slot target");
assert(await page.evaluate(() => document.activeElement?.id === "component-search"), "Chooser should focus search on open");
await page.locator('[data-category="Layout"]').focus();
await page.keyboard.press("Enter");
assert(await page.evaluate(() => document.activeElement?.dataset.category === "Layout"), "Category focus should survive filter rerender");
await page.locator("#component-search").fill("no-such-component");
assert(await page.getByText("No matching components", { exact: true }).isVisible(), "Chooser should show an empty-search state");
await page.keyboard.press("Escape");
assert(!await page.locator("#component-dialog").evaluate((element) => element.open), "Escape should close the chooser");
assert(await page.evaluate(() => document.activeElement?.dataset.addParent === "split-main" && document.activeElement?.dataset.addSlot === "right"), "Closing the chooser should return focus to its trigger");
assert((await page.locator("#node-count").textContent()) === "14", "Cancelling the chooser must not mutate the target slot");
await page.locator('[data-add-parent="split-main"][data-add-slot="right"]').click();
await page.locator("#component-search").fill("SectionHeading");
await page.locator('[data-add-type="SectionHeading"]').focus();
await page.keyboard.press("Enter");
const addedNodeId = await page.evaluate(() => document.activeElement?.dataset.selectNode ?? "");
assert(addedNodeId.startsWith("sectionheading-"), "Adding by keyboard should focus the new selected tree row");
assert((await page.locator("#node-count").textContent()) === "15", "Adding should increment component count");
assert((await page.locator("#inspector-title").textContent()) === "Properties", "Inspector shell should remain mounted");
await page.locator('#inspector textarea[data-prop="heading"]').fill("A heading in the right slot");
assert(await page.locator("#composition-canvas").getByText("A heading in the right slot", { exact: true }).isVisible(), "New component props should be editable");

const rightSlot = page.locator('[data-slot-owner="split-main"][data-slot-name="right"]');
let rightChildren = rightSlot.locator(":scope > .canvas-node");
assert((await rightChildren.count()) === 2, "Right slot should contain two direct components");
assert((await rightChildren.nth(1).getAttribute("data-node-id")).startsWith("sectionheading-"), "Added component should append to target slot");
await page.locator('[data-move-node="up"]').focus();
await page.keyboard.press("Enter");
assert(await page.evaluate((id) => document.activeElement?.dataset.selectNode === id, addedNodeId), "Moving by keyboard should focus the moved tree row");
rightChildren = rightSlot.locator(":scope > .canvas-node");
assert((await rightChildren.nth(0).getAttribute("data-node-id")).startsWith("sectionheading-"), "Move up should change canvas/source order");
await page.locator("[data-remove-node]").focus();
await page.keyboard.press("Enter");
assert(await page.evaluate(() => document.activeElement?.dataset.selectNode === "split-main"), "Removing by keyboard should focus the selected parent row");
assert((await page.locator("#node-count").textContent()) === "14", "Removing should restore component count");

await page.locator('[data-select-node="split-main"]').click();
const heightControl = page.locator('#inspector input[data-prop="minHeight"]');
await heightControl.fill("");
assert(await heightControl.getAttribute("aria-invalid") === "true", "Invalid number should be marked invalid");
assert((await page.locator('[data-node-id="split-main"] .demo-split').getAttribute("style")).includes("min-height:220px"), "Invalid number must not overwrite last valid value");
await heightControl.fill("400");
assert((await page.locator('[data-node-id="split-main"] .demo-split').getAttribute("style")).includes("min-height:400px"), "Valid number should update preview");

await page.locator('[data-select-node="grid-benefits"]').click();
await page.locator('#inspector select[data-prop="min"]').selectOption("11rem");
await page.locator('#inspector input[data-prop="fill"]').check();
const gridStyle = await page.locator('[data-node-id="grid-benefits"] .demo-grid').getAttribute("style");
assert(gridStyle.includes("--grid-min:176px") && gridStyle.includes("--grid-mode:auto-fill"), "Select and boolean props should both affect the grid preview");

const leftResizer = page.locator("#left-resizer");
const initialWidth = Number(await leftResizer.getAttribute("aria-valuenow"));
await leftResizer.focus();
await page.keyboard.press("ArrowRight");
assert(Number(await leftResizer.getAttribute("aria-valuenow")) === initialWidth + 10, "Keyboard resizer should move by 10px");
const box = await leftResizer.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + 100);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 24, box.y + 100, { steps: 4 });
await page.mouse.up();
assert(Number(await leftResizer.getAttribute("aria-valuenow")) >= initialWidth + 30, "Pointer drag should resize left panel");
const resizedWidth = await leftResizer.getAttribute("aria-valuenow");

await page.locator('[data-mode="preview"]').click();
assert(await page.locator("#app-shell").getAttribute("data-mode") === "preview", "Preview mode should be active");
assert(await page.locator(".canvas-add").first().evaluate((element) => getComputedStyle(element).display) === "none", "Preview should remove add controls");
assert(await page.locator("#inspector input").first().isDisabled(), "Preview inspector should be read-only");
await page.locator('[data-node-id="cta-explore"] .demo-button').click();
assert(new URL(page.url()).hash === "#components", "Preview should allow rendered links to activate normally");
await page.evaluate(() => history.replaceState(null, "", location.pathname));
await page.locator('[data-mode="edit"]').click();
assert(await page.locator("#app-shell").getAttribute("data-mode") === "edit", "Edit mode should restore without losing state");

await page.locator("#export-button").click();
const source = await page.locator("#export-code").textContent();
assert(source.includes("Updated by the Composer interaction check."), "Export should contain edited prop value");
assert(source.includes("left={") && source.includes("right={"), "Export should express named slots explicitly");
assert(source.includes('from "@zudo-sg/ui"') && source.includes("layout-primitives"), "Export should distinguish production and prototype imports");
const heroSource = source.match(/<Hero[\s\S]*?\/>/)?.[0] ?? "";
assert(heroSource.includes('variant="primary"') && !heroSource.includes("align=") && !heroSource.includes("minHeight="), "Exported Hero props should match the production Hero contract");
await page.locator('[data-close-dialog="export-dialog"]').first().click();

const darkBackground = await page.locator("body").evaluate((element) => getComputedStyle(element).backgroundColor);
await page.locator("#theme-toggle").click();
await page.waitForTimeout(200);
assert(await page.locator("html").getAttribute("data-theme") === "light", "Theme toggle should enable the light palette");
const lightBackground = await page.locator("body").evaluate((element) => getComputedStyle(element).backgroundColor);
assert(lightBackground !== darkBackground, "Light and dark semantic surfaces should differ");
await page.locator("#theme-toggle").click();

await page.setViewportSize({ width: 768, height: 900 });
assert(await page.locator(".panel--tree").evaluate((element) => getComputedStyle(element).display) === "none", "Narrow layout should hide desktop editing panels");
assert(await page.locator(".small-screen-note").isVisible(), "Narrow layout should explain canvas-only mode");
assert(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), "Narrow layout should not overflow horizontally");
await page.setViewportSize({ width: 1440, height: 920 });
assert(await page.locator(".panel--tree").isVisible(), "Desktop layout should restore three-pane editing");
assert(await leftResizer.getAttribute("aria-valuenow") === resizedWidth, "Responsive canvas-only view should preserve panel width");

assert(errors.length === 0, `Browser errors detected: ${errors.join(" | ")}`);

const blockedContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await blockedContext.addInitScript(() => {
  const denied = () => { throw new DOMException("Storage disabled", "SecurityError"); };
  Object.defineProperty(Storage.prototype, "getItem", { configurable: true, value: denied });
  Object.defineProperty(Storage.prototype, "setItem", { configurable: true, value: denied });
});
const blockedPage = await blockedContext.newPage();
const blockedErrors = [];
blockedPage.on("pageerror", (error) => blockedErrors.push(error.message));
await blockedPage.goto(prototypeUrl, { waitUntil: "load" });
assert((await blockedPage.locator("#node-count").textContent()) === "14", "Blocked storage must not prevent startup");
assert((await blockedPage.locator("#save-status").textContent()).includes("Not saved"), "Blocked storage should be reported honestly");
await blockedPage.locator("#theme-toggle").click();
assert(await blockedPage.locator("html").getAttribute("data-theme") === "light", "Theme switching should still work when persistence is blocked");
assert(blockedErrors.length === 0, `Blocked-storage page errors detected: ${blockedErrors.join(" | ")}`);
await blockedContext.close();

console.log(JSON.stringify({
  verdict: "PASS",
  checks: checkCount,
  nodeCount: await page.locator("#node-count").textContent(),
  leftPanelWidth: await leftResizer.getAttribute("aria-valuenow"),
  sourceLines: source.split("\n").length,
}, null, 2));

await browser.close();
