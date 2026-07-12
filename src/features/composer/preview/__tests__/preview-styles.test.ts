// The preview document's palette scope, proved two ways:
//   1. STRUCTURALLY — every custom property the block restores is confined to
//      `html[data-composer-preview-doc]`. That is what guarantees the HOST is
//      unchanged: without the attribute, not one of these rules can match.
//   2. IN A LIVE DOCUMENT — with the stylesheet installed and the attribute set,
//      the restored `--color-*` tokens resolve on the root; strip the attribute
//      and they are gone.

import { afterEach, describe, expect, it } from "vitest";
import { COMPOSER_PREVIEW_CSS, COMPOSER_PREVIEW_DOC_ATTR } from "../preview-styles";

/** The `--color-*` names the host `@theme` re-asserts, which must be restored. */
const RESTORED_TOKENS = [
  "--color-bg",
  "--color-surface",
  "--color-fg",
  "--color-muted",
  "--color-accent",
  "--color-accent-hover",
  "--color-success",
  "--color-danger",
  "--color-warning",
  "--color-info",
];

/** The palette block: everything between the scoped selector and its `}`. */
function paletteBlock(): string {
  const selector = `html[${COMPOSER_PREVIEW_DOC_ATTR}] {`;
  const start = COMPOSER_PREVIEW_CSS.indexOf(selector);
  expect(start, "the scoped palette block must exist").toBeGreaterThanOrEqual(0);
  const end = COMPOSER_PREVIEW_CSS.indexOf("}", start);
  return COMPOSER_PREVIEW_CSS.slice(start + selector.length, end);
}

afterEach(() => {
  for (const style of [...document.querySelectorAll("style[data-test-preview-css]")]) {
    style.remove();
  }
  document.documentElement.removeAttribute(COMPOSER_PREVIEW_DOC_ATTR);
});

describe("preview palette scope — structure", () => {
  it("restores every re-asserted semantic color token", () => {
    const block = paletteBlock();
    for (const token of RESTORED_TOKENS) {
      expect(block, `${token} must be restored`).toContain(`${token}:`);
    }
  });

  it("restores them from the canonical --palette-* rungs, not hard-coded colors", () => {
    const block = paletteBlock();
    expect(block).toContain("var(--palette-base-0)");
    expect(block).toContain("var(--palette-accent-2)");
    // light-dark() is what makes the theme switch work off `color-scheme`.
    expect(block.match(/light-dark\(/g)?.length).toBe(RESTORED_TOKENS.length);
  });

  it("declares NOTHING outside the preview document's scope — the host is untouched", () => {
    // Every custom-property declaration in the whole stylesheet must live inside
    // the `html[data-composer-preview-doc]` block. A stray `:root { --color-… }`
    // here would leak preview tokens into the host chrome the moment this CSS is
    // ever folded into the shared bundle.
    const outsideThePaletteBlock = COMPOSER_PREVIEW_CSS.replace(paletteBlock(), "");
    expect(outsideThePaletteBlock).not.toMatch(/^\s*--[\w-]+\s*:/m);
    expect(COMPOSER_PREVIEW_CSS).not.toContain(":root");
  });

  it("keys every affordance z-index off the --z-index-local-* tier family", () => {
    const zIndexValues = [...COMPOSER_PREVIEW_CSS.matchAll(/z-index:\s*([^;]+);/g)].map(
      (match) => match[1]!.trim(),
    );
    expect(zIndexValues.length).toBeGreaterThan(0);
    for (const value of zIndexValues) {
      expect(value).toMatch(/^var\(--z-index-local-\d+\)$/);
    }
  });

  it("floats the chrome ABOVE the node box so a shrink-wrapped component is never covered", () => {
    expect(COMPOSER_PREVIEW_CSS).toMatch(/\.zc-chrome\s*\{[^}]*position:\s*absolute/);
    expect(COMPOSER_PREVIEW_CSS).toMatch(/\.zc-chrome\s*\{[^}]*bottom:\s*100%/);
    // Selection is an outline, which is out-of-flow: it can never reflow a node.
    expect(COMPOSER_PREVIEW_CSS).toMatch(/\[data-zc-selected\]\s*\{\s*outline:/);
  });

  it("reveals the chrome with pure CSS hover — no Preact hover state exists", () => {
    expect(COMPOSER_PREVIEW_CSS).toContain(".zc-node:hover > .zc-chrome");
  });
});

describe("preview palette scope — live document", () => {
  function install(): void {
    const style = document.createElement("style");
    style.setAttribute("data-test-preview-css", "");
    // The restored tokens reference Tier-1 `--palette-*` rungs, which the real
    // preview gets from the global bundle. Seed two of them here so the
    // computed values are observable.
    style.textContent = `:root { --palette-base-0: #ffffff; --palette-base-10: #101010; }\n${COMPOSER_PREVIEW_CSS}`;
    document.head.append(style);
  }

  it("resolves the restored tokens on the preview document root", () => {
    install();
    document.documentElement.setAttribute(COMPOSER_PREVIEW_DOC_ATTR, "");
    const value = getComputedStyle(document.documentElement).getPropertyValue("--color-bg");
    // The var() chain resolves all the way down to the seeded Tier-1 rungs, and
    // stays a light-dark() pair so `color-scheme` still picks the mode.
    expect(value).toBe("light-dark(#ffffff, #101010)");
  });

  it("resolves NOTHING on a host document that lacks the attribute", () => {
    install();
    // Same stylesheet, no attribute → the scoped rule cannot match.
    const value = getComputedStyle(document.documentElement).getPropertyValue("--color-bg");
    expect(value.trim()).toBe("");
  });
});
