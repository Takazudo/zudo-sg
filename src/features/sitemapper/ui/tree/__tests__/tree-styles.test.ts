import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/features/sitemapper/styles/tree.css"), "utf8");

describe("Sitemapper tree styles", () => {
  it("pins semantic indent and guide variables to spacing tokens", () => {
    expect(css).toContain("--sg-sitemapper-tree-indent: var(--spacing-hsp-lg)");
    expect(css).toContain("--sg-sitemapper-tree-guide: var(--spacing-hsp-md)");
    expect(css).toContain("margin-inline-start: var(--sg-sitemapper-tree-indent)");
    expect(css).toContain("inset-inline-start: var(--sg-tree-guide)");
  });

  it("restores at least 44px hit targets for coarse pointers", () => {
    const coarseStart = css.indexOf("@media (pointer: coarse)");
    expect(coarseStart).toBeGreaterThanOrEqual(0);
    const coarse = css.slice(coarseStart);
    expect(coarse).toContain("min-height: 2.75rem");
    expect(coarse).toContain("min-width: 2.75rem");
    expect(coarse).toContain(".sg-sitemapper-tree-select");
    expect(coarse).toContain(".sg-sitemapper-tree-action");
  });

  it("keeps hover styling behind a hover-capable media query", () => {
    const hoverStart = css.indexOf("@media (hover: hover)");
    expect(hoverStart).toBeGreaterThanOrEqual(0);
    const beforeHover = css.slice(0, hoverStart);
    expect(beforeHover).not.toMatch(/:hover/);
  });
});
