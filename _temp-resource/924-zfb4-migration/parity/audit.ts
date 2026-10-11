import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, type Browser } from '@playwright/test';

// Visit every emitted HTML route, not just one representative of each island.
export async function auditIslands(browser: Browser, origin: string, site: {id: string; dist: string}, repo: string, output: string) {
  const routes = JSON.parse(await readFile(resolve(repo, site.dist, '__zfb/routes.json'), 'utf8')).routes;
  const report: unknown[] = [];
  const names = new Set<string>();
  const failures: string[] = [];
  for (const route of routes.filter((r: {extension: string}) => r.extension === 'html')) {
    const html = await readFile(resolve(repo, site.dist, route.output.replace(/^\//, '')), 'utf8');
    if (!/data-zfb-island(?:-skip-ssr)?=/.test(html)) continue;
    const page = await browser.newPage({viewport: {width: 1280, height: 900}});
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      // Chromium reports the intentional 404 document itself as a resource error.
      // Keep every asset error and every other console error fatal.
      const expected404 = route.url === '/404'
        && m.location().url.replace(/\/$/, '') === (origin + route.url)
        && m.text() === 'Failed to load resource: the server responded with a status of 404 (Not Found)';
      if (!expected404) errors.push(m.text());
    });
    try {
      const response = await page.goto(origin + route.url, {waitUntil: 'networkidle'});
      expect(response?.status()).toBe(route.url === "/404" ? 404 : 200);
      const islands = page.locator('[data-zfb-island], [data-zfb-island-skip-ssr]');
      for (let i = 0; i < await islands.count(); i++) {
        const island = islands.nth(i);
        const name = (await island.getAttribute('data-zfb-island') ?? await island.getAttribute('data-zfb-island-skip-ssr'))!;
        names.add(name);
        // Render-null enhancers can have no box even after a successful mount.
        // Avoid Playwright actionability waits on those inert placeholders.
        if (await island.getAttribute('data-zfb-island-mounted') === null
          && await island.getAttribute('data-when') === 'visible') {
          await island.evaluate(el => el.scrollIntoView({block: 'center'}));
        }
        await expect(island, `${site.id}${route.url}: ${name}`).toHaveAttribute('data-zfb-island-mounted', /.*/, {timeout: 15000});
      }
      expect(errors, `${site.id}${route.url} console`).toEqual([]);
      report.push({path: route.url, islands: await islands.evaluateAll(els => els.map(el => el.getAttribute('data-zfb-island') ?? el.getAttribute('data-zfb-island-skip-ssr'))), errors});
      console.log(`mounted ${site.id}${route.url}`);
    } catch (e) {
      failures.push(`${site.id}${route.url}: ${String(e)}`);
      report.push({path: route.url, errors, failure: String(e)});
    } finally { await page.close(); }
  }
  await mkdir(output, {recursive: true});
  const baseline = (await readFile(resolve(output, '../baseline/inventories', `${site.id}-islands.txt`), 'utf8')).trim().split('\n').filter(Boolean).map(s => s.match(/="(.*)"/)![1]);
  const actual = [...names].sort();
  await writeFile(resolve(output, `${site.id}-islands.json`), JSON.stringify({baseline, actual, missing: baseline.filter(n => !names.has(n)), added: actual.filter(n => !baseline.includes(n)), routes: report, failures}, null, 2) + '\n');
  if (failures.length) throw new Error(failures.join('\n'));
}
