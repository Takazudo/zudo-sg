/* Deterministic interaction contract for the Composer round-2 interaction
 * prototype (issue #242 / epic #243 waves 6-8).
 * Run from the repository (uses the repo's @playwright/test dependency):
 *   python3 -m http.server 4174 --bind 127.0.0.1 --directory .
 *   COMPOSER_INTERACTIONS_URL=http://127.0.0.1:4174/ node interaction-check.mjs
 * Sections are isolated with try/catch; results always print; no screenshots
 * are written. NOTE: never call page.screenshot() during a native HTML5 drag
 * — it wedges Chromium's input pipeline (verified empirically). */
import { chromium } from '@playwright/test';

const URL = process.env.COMPOSER_INTERACTIONS_URL ?? 'http://127.0.0.1:4174/';

const results = [];
const check = (name, ok, extra = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + String(extra).slice(0, 140) : ''}`);
};

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => results.push(`PAGEERROR  ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') results.push(`CONSOLE-ERROR  ${m.text()}`); });

// localStorage persistence runs in a deferred effect — settle before reading
const treeState = async () => {
  await page.waitForTimeout(200);
  return page.evaluate(() => JSON.parse(localStorage.getItem('composer-composition1')).tree);
};
const section = async (name, fn) => {
  try { await fn(); } catch (e) { results.push(`SECTION-ERROR  [${name}] ${e.message.split('\n')[0]}`); }
};

await page.goto(URL);
await page.waitForSelector('.c-hero');

await section('regression-core', async () => {
  await page.click('.page h2.c-heading');
  check('R1: select shows inspector', (await page.textContent('.insp-type')).includes('Heading'));
  await page.selectOption('#pf-level', 'h3');
  check('R1: prop tweak re-renders', await page.locator('.page h3.c-heading').count() === 1);
  await page.selectOption('#pf-level', 'h2');
});

await section('insert-points', async () => {
  const rootBars = await page.locator('.c-root > .insert-bar').count();
  check('insert bar before first root child exists', rootBars === 2, `root bars=${rootBars}`);
  await page.locator('.c-root > .insert-bar').first().click();
  await page.waitForSelector('.overlay .dialog');
  await page.locator('.ch-card', { hasText: 'Horizontal rule' }).click();
  await page.waitForSelector('.overlay', { state: 'detached' });
  let t = await treeState();
  check('insert-before-first adds at index 0', t.children[0].type === 'Divider', t.children.map((c) => c.type).join(','));
  await page.locator('.ibtn.danger').click();
  t = await treeState();
  check('cleanup delete worked', t.children[0].type === 'Hero');
});

await section('chooser-preview-expand', async () => {
  await page.locator('.c-root > .insert-end .add-btn').click();
  await page.waitForSelector('.overlay .dialog');
  await page.locator('.ch-card', { hasText: 'Bordered surface' }).hover();
  check('chooser hover previews Card live', await page.locator('.chp-stage .c-card').count() === 1);
  check('container preview has sample child', await page.locator('.chp-stage .chp-sample-child').count() === 1);
  const smallBox = await page.locator('.dialog').boundingBox();
  await page.click('.dlg-expand');
  const bigBox = await page.locator('.dialog').boundingBox();
  check('expand grows dialog', bigBox.width > smallBox.width + 200 && bigBox.height > smallBox.height + 100,
    `small=${Math.round(smallBox.width)}x${Math.round(smallBox.height)} big=${Math.round(bigBox.width)}x${Math.round(bigBox.height)}`);
  await page.click('.dlg-head .dlg-x:not(.dlg-expand)');
  await page.waitForSelector('.overlay', { state: 'detached' });
});

await section('inline-edit', async () => {
  await page.click('.page h2.c-heading');
  await page.click('.page h2.c-heading');
  await page.waitForSelector('.page h2.c-heading[contenteditable]');
  await page.keyboard.type(' INLINE');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.page h2.c-heading:not([contenteditable])');
  const t1 = await treeState();
  check('inline edit commits to tree', JSON.stringify(t1).includes('Why a Composer? INLINE'));
  const domText = (await page.textContent('.page h2.c-heading')).trim();
  check('no doubled text after commit', domText === 'Why a Composer? INLINE', domText);
  check('inspector reflects inline edit', (await page.inputValue('#pf-text')).includes('INLINE'));

  await page.click('.page h2.c-heading');
  await page.waitForSelector('.page h2.c-heading[contenteditable]');
  await page.keyboard.type(' XXX');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.page h2.c-heading:not([contenteditable])');
  const t2 = await treeState();
  check('escape cancels inline edit', !JSON.stringify(t2).includes('XXX'));
  check('escape restores original text', (await page.textContent('.page h2.c-heading')).trim() === 'Why a Composer? INLINE');

  // dblclick inside an active edit session must NOT revert typing (word-select)
  await page.click('.page h2.c-heading');
  await page.waitForSelector('.page h2.c-heading[contenteditable]');
  await page.keyboard.type(' KEEP');
  await page.dblclick('.page h2.c-heading[contenteditable]');
  await page.waitForTimeout(200);
  const stillEditing = await page.locator('.page h2.c-heading[contenteditable]').count() === 1;
  const keptText = await page.evaluate(() => document.querySelector('.page h2.c-heading').innerText);
  check('dblclick mid-edit keeps uncommitted typing', stillEditing && keptText.includes('KEEP'), keptText);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.page h2.c-heading:not([contenteditable])');

  await page.dblclick('.page p.c-text >> nth=0');
  await page.waitForSelector('p.c-text[contenteditable]');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Second line');
  await page.locator('.panel-head').first().click();
  await page.waitForSelector('p.c-text[contenteditable]', { state: 'detached' });
  const t3 = await treeState();
  check('multiline inline edit keeps newline', JSON.stringify(t3).includes('\\nSecond line'));
});

await section('drag-move', async () => {
  await page.click('.c-btn >> nth=0');
  check('selected node shows drag grip', await page.locator('.nsh-controls .ctl-grip').count() === 1);
  check('selected node shows ... menu hint', await page.locator('.nsh-controls .ctl-btn').count() === 2);
  const shellBox = await page.locator('.nsh-selected').boundingBox();
  const btnBox = await page.locator('.c-btn >> nth=0').boundingBox();
  check('fit component outline hugs the component', Math.abs(shellBox.width - btnBox.width) < 16,
    `shell=${Math.round(shellBox.width)} btn=${Math.round(btnBox.width)}`);

  const g = await page.locator('.nsh-controls .ctl-grip').boundingBox();
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + 60, g.y + 60, { steps: 6 });
  await page.waitForTimeout(250);
  const droppableCount = await page.locator('.droppable').count();
  check('drop targets highlighted during drag', droppableCount > 5, `droppable=${droppableCount}`);
  const target = page.locator('.slotbox').nth(1).locator('> .insert-bar').first();
  const tb = await target.boundingBox();
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 10 });
  // synthetic input fires no stationary dragover ticks; a 2px wiggle stands in
  await page.mouse.move(tb.x + tb.width / 2 + 2, tb.y + tb.height / 2, { steps: 2 });
  await page.waitForTimeout(250);
  check('hovered drop target gets dropover style', await page.locator('.dropover').count() === 1,
    `dropover=${await page.locator('.dropover').count()}`);
  await page.mouse.up();
  await page.waitForTimeout(150);
  // flush any lingering native drag session (headless quirk)
  await page.keyboard.press('Escape');
  await page.mouse.move(5, 5);
  const t = await treeState();
  const cols = t.children.find((c) => c.type === 'Section').children[0];
  check('drag moves Button into Right column', cols.children[1].children[0].type === 'Button',
    cols.children[1].children.map((c) => c.type).join(','));
  check('Button removed from source Row', cols.children[0].children[2].children.length === 1,
    cols.children[0].children[2].children.map((c) => c.type).join(','));
  check('drag state cleared after drop', await page.locator('.is-dragging').count() === 0);
});

await section('drag-copy-alt', async () => {
  // Synthesized DragEvents: a second NATIVE drag with Alt held wedges headless
  // Chromium's hit-testing (verified empirically). This still exercises the
  // app's real handlers including the altKey=copy branch.
  await page.locator('.slotbox').nth(1).locator('.c-btn').click({ force: true });
  await page.waitForSelector('.nsh-controls .ctl-grip');
  const copied = await page.evaluate(async () => {
    const grip = document.querySelector('.nsh-controls .ctl-grip');
    const dt = new DataTransfer();
    grip.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    await new Promise((r) => setTimeout(r, 80)); // let the deferred setDrag land
    const bar = document.querySelectorAll('.slotbox')[0].querySelector(':scope > .insert-bar');
    bar.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt, altKey: true }));
    const hadDropover = !!document.querySelector('.dropover') ? true : 'pending';
    await new Promise((r) => setTimeout(r, 50));
    bar.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt, altKey: true }));
    grip.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    return hadDropover;
  });
  const t = await treeState();
  const cols = t.children.find((c) => c.type === 'Section').children[0];
  const leftHasButton = cols.children[0].children[0].type === 'Button';
  const rightStillHasButton = cols.children[1].children.some((c) => c.type === 'Button');
  check('alt-drag copies (source kept)', leftHasButton && rightStillHasButton,
    `L=${cols.children[0].children.map((c) => c.type).join(',')} R=${cols.children[1].children.map((c) => c.type).join(',')} dropover=${copied}`);
  check('drag state cleared after synthetic drop', await page.locator('.is-dragging').count() === 0);
});

await section('node-context-menu', async () => {
  await page.click('.c-badge');
  await page.locator('.nsh-controls .ctl-btn').nth(1).click();
  await page.waitForSelector('.ctx-menu');
  const items = await page.locator('.ctx-item').allTextContents();
  check('node menu has copy/cut/duplicate/delete',
    ['Copy', 'Cut', 'Duplicate', 'Delete'].every((l) => items.join(' ').includes(l)), items.join(' | '));
  await page.locator('.ctx-item', { hasText: 'Copy' }).first().click();
  await page.waitForSelector('.ctx-menu', { state: 'detached' });
  check('copy shows clipboard chip', (await page.locator('.uh-clip').textContent()).includes('Badge'));
});

await section('insert-menu-paste', async () => {
  const endDots = page.locator('.slotbox').nth(0).locator('> .insert-end .ip-dots');
  await endDots.click({ force: true });
  await page.waitForSelector('.ctx-menu');
  const insertItems = await page.locator('.ctx-item').allTextContents();
  check('insert menu offers paste with type', insertItems.some((s) => s.includes('Paste "Badge"')), insertItems.join(' | '));
  await page.locator('.ctx-item', { hasText: 'Paste' }).click();
  await page.waitForTimeout(120);
  let t = await treeState();
  const leftCol = t.children.find((c) => c.type === 'Section').children[0].children[0];
  check('paste inserts Badge at left column end', leftCol.children[leftCol.children.length - 1].type === 'Badge',
    leftCol.children.map((c) => c.type).join(','));

  await page.locator('.slotbox').nth(1).locator('.c-badge').click();
  await page.locator('.nsh-controls .ctl-btn').nth(1).click();
  await page.waitForSelector('.ctx-menu');
  await page.locator('.ctx-item', { hasText: 'Cut' }).click();
  await page.waitForTimeout(120);
  t = await treeState();
  const cardKids = t.children.find((c) => c.type === 'Section').children[0].children[1].children.find((c) => c.type === 'Card').children;
  check('cut removes node', !cardKids.some((c) => c.type === 'Badge'), cardKids.map((c) => c.type).join(','));
});

await section('preview-mode', async () => {
  await page.locator('.seg button', { hasText: 'Preview' }).click();
  check('preview hides insert points', await page.locator('.insert-bar, .insert-end').count() === 0);
  check('preview hides controls', await page.locator('.nsh-controls').count() === 0);
  // inspector is read-only in preview: no actions, disabled fields
  await page.locator('.trow', { hasText: 'Heading' }).first().click();
  await page.waitForSelector('.insp-type');
  check('preview inspector hides actions', await page.locator('.insp-actions').count() === 0);
  check('preview inspector disables props', await page.locator('#pf-text').isDisabled());
  check('preview inspector shows read-only note', await page.locator('.insp-ro-note').count() === 1);
  await page.locator('.seg button', { hasText: 'Edit' }).click();
});

await section('export-integrity', async () => {
  await page.click('.util-header .btn-primary');
  await page.waitForSelector('.code-view');
  const jsx = await page.textContent('.code-view');
  check('export still has slot structure', jsx.includes('<Columns.Left>') && jsx.includes('<Columns.Right>'));
  check('export has no stray undefined', !jsx.includes('undefined'));
  check('multiline text exported as JSX expression', jsx.includes('={"') && jsx.includes('\\nSecond line'),
    (jsx.match(/text=\{[^}]{0,60}/) || ['no expression attr found'])[0]);
  await page.click('.dlg-head .dlg-x');
});

await section('fresh-page-empty-clipboard', async () => {
  const page2 = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  page2.on('pageerror', (e) => results.push(`PAGEERROR(p2)  ${e.message}`));
  await page2.goto(URL);
  await page2.waitForSelector('.c-hero');
  await page2.locator('.c-root > .insert-end .ip-dots').click({ force: true });
  await page2.waitForSelector('.ctx-menu');
  check('paste disabled with empty clipboard', await page2.locator('.ctx-item:disabled').count() === 1);
  await page2.keyboard.press('Escape');
  check('escape closes context menu', await page2.locator('.ctx-menu').count() === 0);
  await page2.close();
});

await browser.close();
console.log(results.join('\n'));
const bad = results.filter((r) => !r.startsWith('PASS'));
console.log(`\n${results.length - bad.length}/${results.length} passed, ${bad.length} problems`);
process.exit(bad.length ? 1 : 0);
