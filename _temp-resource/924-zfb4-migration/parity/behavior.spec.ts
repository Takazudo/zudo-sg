import { expect, test } from '@playwright/test';
import { setAppearanceTheme } from '../../../e2e/helpers/appearance';

test('root search filters, theme restores, iframe handshake, controls and live CSS', async ({page}, info) => {
  test.skip(info.project.name !== 'root');
  await page.goto('/');
  await page.locator('[data-open-search]').click();
  await expect(page.locator('[data-search-dialog]')).toBeVisible();
  await page.locator('[data-search-input]').fill('overview');
  await expect(page.locator('[data-search-results] a').first()).toBeVisible();
  await page.locator('[data-search-input]').fill('zzzz-no-such-document-946');
  await expect(page.locator('[data-search-results] a')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await setAppearanceTheme(page, 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.addInitScript(() => {
    (window as any).__p1messages = [];
    addEventListener('message', e => { if (e.origin === location.origin) (window as any).__p1messages.push(e.data?.type); });
  });
  await page.goto('/components/cta-button');
  const iframe = page.locator('iframe[src*="/components/preview"]').first();
  await iframe.scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => (window as any).__p1messages)).toEqual(expect.arrayContaining(['sg:ready', 'sg:height']));
  const frame = page.frameLocator('iframe[src*="/components/preview"]').first();
  const label = page.getByLabel('Label', {exact: true}).first();
  const oldStory = await frame.getByRole('link', {name: 'Browse products'}).elementHandle();
  expect(oldStory).not.toBeNull();
  await label.fill('P1 live control');
  const rendered = frame.getByRole('link', {name: 'P1 live control'});
  await expect(rendered).toBeVisible();
  await expect.poll(() => oldStory!.evaluate(el => el.isConnected)).toBe(false);
  await frame.locator('html').evaluate(() => {
    (window as any).__p1ApplyMessages = [];
    addEventListener('message', e => {if (e.origin === location.origin) (window as any).__p1ApplyMessages.push(e.data?.type);});
  });
  await page.locator('#sg-preview-tokens-trigger').click();
  const panel = page.locator('.tokenpanel-shell').first();
  await expect(panel).toBeVisible();
  await panel.getByRole('tab', {name: 'Color', exact: true}).click();
  const color = panel.getByLabel('--color-accent value');
  await color.fill('rgb(1, 2, 3)');
  await color.dispatchEvent('input');
  await expect.poll(() => frame.locator('html').evaluate(() => (window as any).__p1ApplyMessages)).toContain('apply-css-vars');
  await expect(rendered).toHaveCSS('background-color', 'rgb(1, 2, 3)');
  await page.locator('#sg-preview-tokens-trigger').click();
  await expect(panel).not.toBeVisible();
  const editor = page.locator('[data-sg-code-region="live-css"] [contenteditable="true"]');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText('a[href="/products"] { background-color: rgb(4, 5, 6); }');
  await expect(rendered).toHaveCSS('background-color', 'rgb(4, 5, 6)');
});

test('demo native view transition finishes, drawer closes, query renders', async ({page}, info) => {
  test.skip(info.project.name !== 'demo');
  await page.addInitScript(() => {
    const original = document.startViewTransition.bind(document);
    (window as any).__p1vt = {started: 0, finished: 0};
    document.startViewTransition = ((...args: any[]) => {
      const transition = (original as any)(...args);
      (window as any).__p1vt.started++;
      transition.finished.then(() => (window as any).__p1vt.finished++);
      return transition;
    }) as typeof document.startViewTransition;
  });
  await page.goto('/');
  await page.setViewportSize({width: 390, height: 844});
  await page.locator('[data-nav-hamburger]').click();
  await expect(page.locator('[data-nav-toggle]')).toBeChecked();
  const company = page.locator('#zui-nav-drawer details[data-nav-item]').filter({has: page.locator('a[href="/company"]')}).first();
  if (!(await company.evaluate(el => (el as HTMLDetailsElement).open))) await company.locator('summary').first().click();
  await page.locator('#zui-nav-drawer a[href="/company"], #zui-nav-drawer a[href="/company/"]').first().click();
  await expect(page).toHaveURL(/\/company\/?$/);
  await expect(page.locator('[data-nav-toggle]')).not.toBeChecked();
  await expect.poll(() => page.evaluate(() => (window as any).__p1vt.finished)).toBeGreaterThan(0);
  await page.goto('/search?q=product');
  await expect(page.locator('main')).toContainText(/product/i);
  await expect(page.locator('[data-search-root]')).toHaveAttribute('data-search-enhanced', 'true');
  await expect(page.locator('[data-search-root] [data-search-input]')).toHaveValue('product');
  await expect(page.locator('[data-search-list] a')).not.toHaveCount(0);
  await page.locator('[data-search-root] [data-search-input]').fill('zzzz-p1-no-result');
  await expect(page.locator('[data-search-list] a')).toHaveCount(0);
});
