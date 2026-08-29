import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMPONENT_TOKENS } from "@takazudo/zudo-doc/component-tokens";
import { describe, expect, it } from "vitest";

const globalCss = readFileSync(
  resolve(process.cwd(), "src/styles/global.css"),
  "utf8",
);

describe("root zudo-doc 5 theme contract", () => {
  it("defines every tracking role used by the package component-token surface", () => {
    const componentDefaults = COMPONENT_TOKENS.map(({ default: value }) => value);

    expect(componentDefaults).toContain("var(--tracking-normal)");
    expect(globalCss).toMatch(/--tracking-tight:\s*-0\.025em;/);
    expect(globalCss).toMatch(/--tracking-normal:\s*normal;/);
    expect(globalCss).toMatch(/--tracking-wide:\s*0\.05em;/);
    expect(globalCss).toMatch(/--tracking-wider:\s*0\.1em;/);
  });

  it("defines the transition role consumed without a fallback by package chrome", () => {
    expect(globalCss).toMatch(/--zd-transition-slow:\s*200ms;/);
  });

  it("keeps local theme authority and the load-bearing package CSS order", () => {
    expect(globalCss).not.toContain('@import "@takazudo/zudo-doc/theme.css"');
    const orderedImports = [
      '@import "@zudo-sg/ui/styles/tokens.css"',
      '@import "@zudo-sg/ui/styles/colors.css"',
      '@import "@takazudo/zudo-doc/safelist.css"',
      '@import "@takazudo/zudo-doc/content.css"',
      '@import "@takazudo/zudo-doc/features.css"',
      '@import "../features/styleguide/styles.css"',
      '@import "../features/sitemapper/styles.css"',
    ];
    const positions = orderedImports.map((entry) => globalCss.indexOf(entry));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
