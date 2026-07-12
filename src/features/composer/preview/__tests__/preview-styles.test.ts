// The preview document's palette scope, proved two ways:
//   1. STRUCTURALLY — every custom property the block restores is confined to
//      `html[data-composer-preview-doc]`. That is what guarantees the HOST is
//      unchanged: without the attribute, not one of these rules can match.
//   2. IN A LIVE DOCUMENT — with the stylesheet installed and the attribute set,
//      the restored `--color-*` tokens resolve on the root; strip the attribute
//      and they are gone.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { COMPOSER_PREVIEW_CSS, COMPOSER_PREVIEW_DOC_ATTR } from "../preview-styles";

/**
 * The SOURCE OF TRUTH for which semantic tokens a chrome-free preview document
 * has to restore: the styleguide's own preview scope
 * (`html[data-sg-preview-doc]`), which solves the identical problem for
 * `/components/preview`.
 *
 * Deriving the expected set from that file rather than hand-copying it is the
 * whole point. The set is not arbitrary — it is exactly the collision set of
 * `--color-*` names the host `@theme` in `global.css` re-asserts to `--zd-*`
 * values the preview document does not have. When that collision set changes,
 * `preview.css` gets updated (it is the styleguide's live scope), and this test
 * then FAILS until the Composer's scope is updated too. A hand-copied list here
 * could not catch that — it would drift in silence and the previewed components
 * would quietly lose a color.
 */
const PREVIEW_CSS_PATH = resolve(__dirname, "../../../../styles/preview.css");

function declaredTokens(block: string): string[] {
  return [...block.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((match) => match[1]!).sort();
}

/** Pull a selector's declaration block out of a stylesheet. */
function blockFor(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `expected a "${selector}" block`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  const end = css.indexOf("}", open);
  return css.slice(open + 1, end);
}

/** The Composer preview's palette block. */
function paletteBlock(): string {
  return blockFor(COMPOSER_PREVIEW_CSS, `html[${COMPOSER_PREVIEW_DOC_ATTR}]`);
}

/** The styleguide preview's palette block — the source of truth. */
function styleguidePaletteBlock(): string {
  return blockFor(readFileSync(PREVIEW_CSS_PATH, "utf8"), "html[data-sg-preview-doc]");
}

afterEach(() => {
  for (const style of [...document.querySelectorAll("style[data-test-preview-css]")]) {
    style.remove();
  }
  document.documentElement.removeAttribute(COMPOSER_PREVIEW_DOC_ATTR);
});

describe("preview palette scope — structure", () => {
  it("restores EXACTLY the tokens the styleguide's preview scope restores", () => {
    // The drift guard. If the host `@theme`'s re-assertion set ever grows and
    // `src/styles/preview.css` is updated for it, this fails until the Composer
    // preview's scope is updated to match — instead of the previewed components
    // silently losing a color inside the Composer only.
    expect(declaredTokens(paletteBlock())).toEqual(declaredTokens(styleguidePaletteBlock()));
  });

  it("restores each token to the same VALUE the styleguide scope uses", () => {
    // Same tokens is not enough — they must resolve to the same palette rungs.
    const normalize = (block: string): string[] =>
      block
        .split("\n")
        .map((line) => line.trim().replace(/\s+/g, " "))
        .filter((line) => line.startsWith("--"))
        .sort();
    expect(normalize(paletteBlock())).toEqual(normalize(styleguidePaletteBlock()));
  });

  it("restores them from the canonical --palette-* rungs, not hard-coded colors", () => {
    const block = paletteBlock();
    expect(block).toContain("var(--palette-base-0)");
    expect(block).toContain("var(--palette-accent-2)");
    // light-dark() is what makes the theme switch work off `color-scheme`.
    const tokenCount = declaredTokens(block).length;
    expect(tokenCount).toBeGreaterThan(0);
    expect(block.match(/light-dark\(/g)?.length).toBe(tokenCount);
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
