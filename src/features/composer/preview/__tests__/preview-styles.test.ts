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

describe("drag & drop chrome (issue #258)", () => {
  it("carries the pointer-events guard: insert-group children go inert while dragging", () => {
    // The verified Chromium DnD fix — a child-crossing dragleave (null
    // relatedTarget) must not reach a child and wipe the drop highlight.
    expect(COMPOSER_PREVIEW_CSS).toMatch(
      /\.zc-canvas\[data-zc-dragging\]\s+\.zc-insert-group\s*>\s*\*\s*\{\s*pointer-events:\s*none/,
    );
  });

  it("styles the drag grip and the valid/active drop-target states", () => {
    expect(COMPOSER_PREVIEW_CSS).toContain(".zc-chrome-grip");
    expect(COMPOSER_PREVIEW_CSS).toContain("[data-zc-drop-valid]");
    expect(COMPOSER_PREVIEW_CSS).toContain("[data-zc-drop-active]");
  });
});

describe("accent budget — canvas quiet chrome (issue #266)", () => {
  it("mutes insert markers to the guide tone at rest, never accent", () => {
    // The "+" bar and its "⋯" companion were the biggest at-rest orange source
    // (6+ markers in the sample doc). At rest they recede to --sg-composer-guide
    // (chroma ~0.008 → NOT orange) at reduced opacity.
    const insert = blockFor(COMPOSER_PREVIEW_CSS, ".zc-insert");
    expect(insert).toContain("color: var(--sg-composer-guide)");
    expect(insert).toMatch(/opacity:\s*0?\.\d+/);
    expect(insert).not.toContain("var(--color-accent)");
  });

  it("spends accent only on interaction: a marker turns accent on hover/focus", () => {
    expect(COMPOSER_PREVIEW_CSS).toMatch(
      /\.zc-insert:hover,\s*\.zc-insert:focus-visible\s*\{[^}]*color:\s*var\(--color-accent\)/,
    );
  });

  it("keeps selection THE loud element and a plain hover label neutral", () => {
    // The resting/hover chrome chip is neutral; only the SELECTED node's label
    // carries the accent fill — and the 2px accent selection outline stays.
    const chrome = blockFor(COMPOSER_PREVIEW_CSS, ".zc-chrome");
    expect(chrome).not.toContain("background: var(--color-accent)");
    expect(COMPOSER_PREVIEW_CSS).toMatch(
      /\.zc-node\[data-zc-selected\]\s*>\s*\.zc-chrome\s*\{[^}]*background:\s*var\(--color-accent\)/,
    );
    expect(COMPOSER_PREVIEW_CSS).toMatch(
      /\[data-zc-selected\]\s*\{\s*outline:\s*2px solid var\(--color-accent\)/,
    );
  });

  it("makes drop CANDIDATES neutral and only the ACTIVE target accent", () => {
    expect(COMPOSER_PREVIEW_CSS).toMatch(
      /\[data-zc-drop-valid\]\s*\{[^}]*outline:\s*1px dashed var\(--sg-composer-guide\)/,
    );
    expect(COMPOSER_PREVIEW_CSS).toMatch(
      /\[data-zc-drop-active\]\s*\{[^}]*outline:\s*2px solid var\(--color-accent\)/,
    );
  });

  it("drives every functional font-size off the token scale (no sub-12px rem)", () => {
    // Kills the old 0.6875rem (11px) type label and every other hardcoded rem
    // font-size; the label now comes off --text-micro (12px floor).
    expect(COMPOSER_PREVIEW_CSS).not.toMatch(/font-size:\s*0?\.\d+rem/);
    expect(blockFor(COMPOSER_PREVIEW_CSS, ".zc-chrome")).toContain("font-size: var(--text-micro)");
  });

  it("floats the composition on the panel-bg sheet token", () => {
    expect(blockFor(COMPOSER_PREVIEW_CSS, ".zc-canvas")).toContain(
      "background: var(--sg-composer-panel-bg)",
    );
  });
});

describe("end-of-slot add affordance geometry (issue #283)", () => {
  it("sizes the button to the locked spec: min-height 2rem, 7px/12px padding, 6px icon gap", () => {
    expect(COMPOSER_PREVIEW_CSS).toMatch(
      /\.zc-insert-end-btn:not\(\.zc-insert--empty\)\s*\{[^}]*min-height:\s*2rem/,
    );
    expect(COMPOSER_PREVIEW_CSS).toMatch(
      /\.zc-insert-end-btn:not\(\.zc-insert--empty\)\s*\{[^}]*padding-block:\s*var\(--spacing-vsp-2xs\)/,
    );
    expect(COMPOSER_PREVIEW_CSS).toMatch(
      /\.zc-insert-end-btn:not\(\.zc-insert--empty\)\s*\{[^}]*padding-inline:\s*var\(--spacing-hsp-md\)/,
    );
    expect(blockFor(COMPOSER_PREVIEW_CSS, ".zc-insert-end-btn")).toContain(
      "gap: var(--spacing-hsp-xs)",
    );
  });

  it("keeps the empty-slot min-height:3rem from .zc-insert--empty unchanged, and adds the locked breathing padding", () => {
    expect(blockFor(COMPOSER_PREVIEW_CSS, ".zc-insert--empty")).toContain("min-height: 3rem");
    expect(blockFor(COMPOSER_PREVIEW_CSS, ".zc-insert-end-btn.zc-insert--empty")).toContain(
      "padding: var(--spacing-vsp-xs)",
    );
  });

  it("is full-width in column flow and auto-width (compact) in row flow", () => {
    expect(blockFor(COMPOSER_PREVIEW_CSS, ".zc-insert-end--vertical")).toContain("width: 100%");
    expect(blockFor(COMPOSER_PREVIEW_CSS, ".zc-insert-end--horizontal")).toContain("width: auto");
  });

  it("reserves the compact variant's trailing clearance for the overlapping dots companion", () => {
    expect(COMPOSER_PREVIEW_CSS).toMatch(
      /\.zc-insert-end--horizontal \.zc-insert-end-btn:not\(\.zc-insert--empty\)\s*\{[^}]*padding-inline-end:\s*calc\(var\(--spacing-hsp-sm\)\s*\+\s*1\.375rem\s*\+\s*var\(--spacing-hsp-xs\)\)/,
    );
  });

  it("positions the dots companion absolutely over the button's trailing edge at the locked size", () => {
    const block = blockFor(COMPOSER_PREVIEW_CSS, ".zc-insert-menu--end");
    expect(block).toContain("position: absolute");
    expect(block).toContain("inset-inline-end: var(--spacing-hsp-sm)");
    expect(block).toContain("width: 1.375rem");
    expect(block).toContain("height: 1.25rem");
  });

  it("declares NO accent color in the end-affordance geometry rules — toning stays inherited from .zc-insert", () => {
    expect(blockFor(COMPOSER_PREVIEW_CSS, ".zc-insert-end-btn")).not.toContain("var(--color-accent)");
    expect(
      COMPOSER_PREVIEW_CSS.match(/\.zc-insert-end-btn:not\(\.zc-insert--empty\)\s*\{[^}]*\}/)?.[0] ?? "",
    ).not.toContain("var(--color-accent)");
    expect(blockFor(COMPOSER_PREVIEW_CSS, ".zc-insert-menu--end")).not.toContain(
      "var(--color-accent)",
    );
  });
});
