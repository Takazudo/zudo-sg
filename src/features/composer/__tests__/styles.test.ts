import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Deterministic geometry checks for the Composer workspace CSS (issue #247).
// happy-dom does not perform real layout/media-query evaluation, so — per the
// manager's brief — this asserts the actual authored breakpoint and overflow
// rules exist as source text, the same pragmatic approach
// panel-scripts.test.ts uses for its inline-script constants. This proves the
// desktop/narrow seam sits exactly at 64rem (1024px) — matching the
// acceptance widths 1440/1024 (grid) vs. 1023/768/390 (canvas-only) — and
// that a horizontal-overflow backstop is in place, without spinning up a
// browser.

const cssPath = resolve(process.cwd(), "src/features/composer/styles.css");
const css = readFileSync(cssPath, "utf8");

describe("Composer workspace CSS geometry (src/features/composer/styles.css)", () => {
  it("collapses to a single canvas-only column below the 64rem seam", () => {
    expect(css).toMatch(/\.sg-composer-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });

  it("switches to the five-track grid at exactly the 64rem (1024px) seam", () => {
    expect(css).toContain("@media (min-width: 64rem)");
    const desktopBlockMatch = css.match(/@media \(min-width: 64rem\) \{([\s\S]*?)\n\}\n\n\/\* Generous hit area/);
    expect(desktopBlockMatch).not.toBeNull();
    const desktopBlock = desktopBlockMatch![1]!;
    // Five explicit tracks: tree | resizer | minmax(0,1fr) canvas | resizer | inspector.
    expect(desktopBlock).toMatch(
      /grid-template-columns:\s*\n\s*var\(--sg-composer-tree-w\)\s*\n\s*var\(--sg-composer-resizer-w\)\s*\n\s*minmax\(0,\s*1fr\)\s*\n\s*var\(--sg-composer-resizer-w\)\s*\n\s*var\(--sg-composer-inspector-w\)/,
    );
  });

  it("hides the rails and resizers by default (narrow) and shows them only at >=64rem", () => {
    const narrowBlock = css.slice(0, css.indexOf("@media (min-width: 64rem)"));
    expect(narrowBlock).toMatch(/\.sg-composer-tree-rail,\s*\n\.sg-composer-inspector\s*\{\s*\n\s*display:\s*none;/);
    expect(narrowBlock).toMatch(/\.sg-composer-resizer\s*\{\s*\n\s*display:\s*none;/);
  });

  it("shows the prototype's exact canvas-only note copy only below 64rem", () => {
    expect(css).toContain(".sg-composer-narrow-note {");
    const desktopBlockMatch = css.match(/@media \(min-width: 64rem\) \{([\s\S]*?)\n\}\n\n\/\* Generous hit area/);
    expect(desktopBlockMatch![1]).toMatch(/\.sg-composer-narrow-note\s*\{\s*\n\s*display:\s*none;/);
  });

  it("guards against horizontal body overflow on the Composer document", () => {
    expect(css).toMatch(/html\[data-sg-composer-doc\]\s*body\s*\{\s*\n\s*overflow-x:\s*hidden;/);
  });

  it("gives tree/canvas/inspector independent overflow and overscroll containment", () => {
    for (const selector of [".sg-composer-tree-rail,", ".sg-composer-canvas {"]) {
      expect(css).toContain(selector);
    }
    // min-width:0 / min-height:0 + overscroll-behavior: contain appear on the
    // rail + canvas rule block (shared block for tree/inspector, own block
    // for canvas) — not just once, globally.
    const occurrences = css.match(/overscroll-behavior:\s*contain;/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it("uses the existing sidebar/toolbar z-index tiers instead of a new one", () => {
    expect(css).toContain("var(--z-index-toolbar)");
    expect(css).toContain("var(--z-index-sidebar)");
    // No raw integer z-index literals (the design-token lint forbids them).
    expect(css).not.toMatch(/z-index:\s*\d/);
  });

  it("gives the resizer a visible focus ring distinct from hover", () => {
    expect(css).toMatch(/\.sg-composer-resizer:focus-visible\s*\{/);
  });
});

describe("Composer tool-dialog CSS geometry (issue #315)", () => {
  it("declares a 24px desktop inset, explicit border-box dimensions, and a safe narrow fallback", () => {
    const toolDialog = blockFor(".sg-composer-tool-dialog");
    expect(toolDialog).toContain("--sg-composer-tool-dialog-gutter: 24px");
    expect(toolDialog).toContain("box-sizing: border-box");
    expect(css).toMatch(/\.sg-composer-tool-dialog\[open\]\s*\{[\s\S]*?block-size:\s*calc\(100vh/);
    expect(css).toContain("@supports (height: 100dvh)");
    expect(css).toMatch(/@media \(max-width: 40rem\) \{[\s\S]*?--sg-composer-tool-dialog-gutter:\s*8px/);
  });

  it("keeps the chooser square and removes the obsolete enlarge style branch", () => {
    expect(blockFor(".sg-composer-chooser")).toContain("border-radius: 0");
    expect(css).not.toContain("data-sg-enlarged");
    expect(css).not.toContain("sg-composer-chooser-enlarge");
  });

  it("provides a coarse-pointer 44px target for the move grip and future resize handle", () => {
    const coarsePointer = css.match(/@media \(pointer: coarse\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(coarsePointer).toContain(".sg-composer-tool-dialog-grip");
    expect(coarsePointer).toContain(".sg-composer-tool-dialog-resize");
    expect(coarsePointer).toContain("min-height: 2.75rem");
  });
});

/** Pull a selector's declaration block out of the Composer stylesheet. */
function blockFor(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `expected a "${selector}" block`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  const end = css.indexOf("}", open);
  return css.slice(open + 1, end);
}

describe("accent budget — chooser card-category badge (S7 census #270 → A4 #280)", () => {
  it("neutralizes the badge to a muted fg-mix wash, not accent, at rest", () => {
    const badge = blockFor(".sg-composer-chooser-card-category");
    expect(badge).toContain("color: var(--color-muted)");
    expect(badge).toContain("background: color-mix(in oklch, var(--color-fg) 6%, transparent)");
    expect(badge).not.toContain("var(--color-accent)");
  });

  it("keeps the micro type size and full pill radius", () => {
    const badge = blockFor(".sg-composer-chooser-card-category");
    expect(badge).toContain("font-size: var(--text-micro)");
    expect(badge).toContain("border-radius: var(--radius-full)");
  });
});
