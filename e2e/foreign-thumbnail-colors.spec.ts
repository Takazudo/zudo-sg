import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const engineCss = readFileSync("packages/styleguide/styles.css", "utf8");

for (const scheme of ["light", "dark"] as const) {
  for (const order of ["host-first", "engine-first"] as const) {
    test(`foreign thumbnail retains host colors: ${scheme}, ${order}`, async ({ page }) => {
      const hostCss = `
        :root {
          color-scheme: ${scheme};
          --host-bg: rgb(23, 45, 67);
          --host-fg: rgb(210, 220, 230);
          --host-dark-bg: rgb(42, 52, 62);
          --host-dark-fg: rgb(241, 231, 221);
          --color-bg: light-dark(var(--host-bg), var(--host-dark-bg));
          --color-fg: light-dark(var(--host-fg), var(--host-dark-fg));
          --sg-bg: rgb(111, 122, 133);
          --palette-neutral-0: rgb(250, 0, 0);
          --palette-neutral-3: rgb(0, 250, 0);
        }
        .sample { background: var(--color-bg); color: var(--color-fg); }
      `;
      const css = order === "host-first"
        ? `<style>${hostCss}</style><style>${engineCss}</style>`
        : `<style>${engineCss}</style><style>${hostCss}</style>`;
      await page.setContent(`${css}
        <div class="sg-thumb" data-sg-preview-scope><div class="sample">Thumbnail</div></div>
        <div class="sample">Outside control</div>`);
      const expectedBg = scheme === "light" ? "rgb(23, 45, 67)" : "rgb(42, 52, 62)";
      const expectedFg = scheme === "light" ? "rgb(210, 220, 230)" : "rgb(241, 231, 221)";
      const colors = await page.locator(".sample").evaluateAll((samples) =>
        samples.map((sample) => {
          const style = getComputedStyle(sample);
          return { background: style.backgroundColor, foreground: style.color };
        }),
      );
      expect(colors).toEqual([
        { background: expectedBg, foreground: expectedFg },
        { background: expectedBg, foreground: expectedFg },
      ]);
      await expect(page.locator(".sg-thumb")).toHaveCSS("background-color", "rgb(111, 122, 133)");
    });
  }
}
