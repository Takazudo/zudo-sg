/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Catalogue gallery contracts (#540).
//
// The framing model is split across TypeScript (which viewport width a
// category gets, how the snapshot is scoped) and CSS (the scale, the fit rule,
// the palette restore), so this file checks BOTH halves and the seam between
// them — the same shape as src/features/styleguide/__tests__/root-theme-contract.test.ts.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "preact-render-to-string";
import { afterEach, describe, expect, it, vi } from "vitest";
import { storyEntries } from "@/styleguide/data/registry";
import {
  ATOM_SCALE_CATEGORIES,
  ComponentThumb,
  THUMB_OPT_OUTS,
  THUMB_VIEWPORT_W,
  THUMB_VIEWPORT_W_ATOM,
  scopeThumbHtml,
  thumbIdPrefix,
  thumbScale,
  thumbViewportWidth,
} from "../component-thumb";
import {
  ATTR_TILE_SIZE,
  DEFAULT_TILE_SIZE,
  LS_TILE_SIZE,
  TILE_SIZES,
  TILE_SIZE_RESTORE_SCRIPT,
  applyTileSize,
  isTileSize,
  readTileSize,
} from "../tile-size";

const read = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const galleryCss = read("src/features/styleguide/catalog/gallery.css");
const previewCss = read("src/styles/preview.css");
const globalCss = read("src/styles/global.css");

/** The `--color-*` declarations inside the first block matching `selector`. */
function paletteBlock(css: string, selector: string): string[] {
  const start = css.indexOf(selector);
  expect(start, `${selector} not found`).toBeGreaterThan(-1);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css
    .slice(open + 1, close)
    .split(";")
    .map((line) => line.replace(/\/\*[\s\S]*?\*\//g, "").trim())
    .filter((line) => line.startsWith("--color-"))
    .map((line) => line.replace(/\s+/g, " "));
}

describe("thumbnail geometry", () => {
  it("lays atom-scale categories out at the narrow virtual viewport", () => {
    for (const category of ATOM_SCALE_CATEGORIES) {
      expect(thumbViewportWidth(category)).toBe(THUMB_VIEWPORT_W_ATOM);
    }
    expect(thumbViewportWidth("Landing")).toBe(THUMB_VIEWPORT_W);
    expect(thumbViewportWidth("Navigation")).toBe(THUMB_VIEWPORT_W);
    expect(THUMB_VIEWPORT_W_ATOM).toBeLessThan(THUMB_VIEWPORT_W);
  });

  it("scales a virtual viewport down onto the track it was sized for", () => {
    const [compact, large] = TILE_SIZES;
    // At the nominal track width the component lays out at exactly its virtual
    // width — that is what "scaled, never squeezed" means here.
    expect(thumbScale(compact.trackMin, THUMB_VIEWPORT_W)).toBeCloseTo(272 / 720, 6);
    expect(thumbScale(large.trackMin, THUMB_VIEWPORT_W)).toBeCloseTo(400 / 720, 6);
    // Atoms reach 1:1 in Large rather than being blown up past their layout.
    expect(thumbScale(large.trackMin, THUMB_VIEWPORT_W_ATOM)).toBe(1);
    // Every combination shrinks or holds; none magnifies.
    for (const { trackMin } of TILE_SIZES) {
      for (const viewport of [THUMB_VIEWPORT_W, THUMB_VIEWPORT_W_ATOM]) {
        expect(thumbScale(trackMin, viewport)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("keeps the CSS scale formula and track sizes in step with TILE_SIZES", () => {
    expect(galleryCss).toContain(
      "--sg-thumb-scale: calc(var(--sg-tile-min-n) / var(--sg-thumb-vw-n))",
    );
    expect(galleryCss).toMatch(
      new RegExp(`--sg-tile-min-n:\\s*${TILE_SIZES[0].trackMin};`),
    );
    expect(galleryCss).toMatch(
      new RegExp(
        `\\[data-sg-tile-size="${TILE_SIZES[1].id}"\\][\\s\\S]*?--sg-tile-min-n:\\s*${TILE_SIZES[1].trackMin};`,
      ),
    );
    expect(galleryCss).toMatch(
      new RegExp(`--sg-thumb-vw-n:\\s*${THUMB_VIEWPORT_W};`),
    );
  });

  it("decides fit at full scale by giving both boxes the same aspect ratio", () => {
    // The tile slot and the virtual viewport share `16 / 10`, so the viewport's
    // height is the exact pre-image of the slot's. That is what lets
    // `align-content: safe center` centre a component that fits and fall back
    // to `start` — top-anchored, never cropped at both ends — for one that
    // does not, with no measurement and no JavaScript.
    expect(galleryCss.match(/aspect-ratio:\s*16\s*\/\s*10;/g)).toHaveLength(2);
    const inner = galleryCss.slice(galleryCss.indexOf(".sg-thumb-inner"));
    expect(inner).toContain("align-content: start;");
    expect(inner).toContain("align-content: safe center;");
    expect(inner.indexOf("align-content: start;")).toBeLessThan(
      inner.indexOf("align-content: safe center;"),
    );
    expect(inner).toContain("transform: scale(var(--sg-thumb-scale))");
    expect(inner).toContain("width: calc(100% / var(--sg-thumb-scale))");
  });
});

describe("palette scope", () => {
  it("restores exactly the tokens the preview document restores", () => {
    const previewTokens = paletteBlock(previewCss, "html[data-sg-preview-doc] {");
    const thumbTokens = paletteBlock(
      galleryCss,
      ".sg-thumb[data-sg-preview-scope] {",
    );
    expect(previewTokens.length).toBeGreaterThan(0);
    expect(thumbTokens).toEqual(previewTokens);
  });

  it("scopes the restore above the :root the host @theme emits", () => {
    // Class + attribute = (0,2,0), which beats `:root` (0,1,0) regardless of
    // @import order — the same trick `preview.css` plays with (0,1,1).
    expect(galleryCss).toContain(".sg-thumb[data-sg-preview-scope] {");
    expect(globalCss).toContain(
      '@import "../features/styleguide/catalog/gallery.css";',
    );
  });
});

describe("snapshot scoping", () => {
  it("namespaces ids and every attribute that references one", () => {
    const html =
      '<input id="nav-toggle"><label for="nav-toggle">x</label>' +
      '<div aria-labelledby="a b" aria-controls="nav-drawer"></div>';
    const out = scopeThumbHtml(html, "sgt-site-nav-");
    expect(out).toContain('id="sgt-site-nav-nav-toggle"');
    expect(out).toContain('for="sgt-site-nav-nav-toggle"');
    expect(out).toContain('aria-labelledby="sgt-site-nav-a sgt-site-nav-b"');
    expect(out).toContain('aria-controls="sgt-site-nav-nav-drawer"');
  });

  it("namespaces fragment references without mangling empty or absolute ones", () => {
    const out = scopeThumbHtml(
      '<a href="#top">t</a><a href="#">n</a><a href="/docs">d</a>' +
        '<svg><rect fill="url(#grad)" /></svg>',
      "p-",
    );
    expect(out).toContain('href="#p-top"');
    expect(out).toContain('href="#"');
    expect(out).toContain('href="/docs"');
    expect(out).toContain("url(#p-grad)");
  });

  it("drops script blocks so no story can ship bytes that run on the catalogue", () => {
    const out = scopeThumbHtml(
      '<div><script type="application/json" data-search-index>[{"a":1}]</script><p>kept</p></div>',
      "p-",
    );
    expect(out).not.toContain("<script");
    expect(out).not.toContain("data-search-index");
    expect(out).toContain("<p>kept</p>");
  });

  it("leaves attributes that merely end in id alone", () => {
    expect(scopeThumbHtml('<b data-testid="x"></b>', "p-")).toContain(
      'data-testid="x"',
    );
  });

  it("gives each story its own namespace", () => {
    expect(thumbIdPrefix("site-nav")).not.toBe(thumbIdPrefix("nav-enhancer"));
  });
});

describe("every catalogue tile shows something", () => {
  const rendered = storyEntries.map((entry) => ({
    entry,
    html: render(<ComponentThumb entry={entry} />),
  }));

  it("covers the whole registry", () => {
    expect(rendered.length).toBe(72);
  });

  it("renders every component inline, or names the reason it cannot", () => {
    const blanks: string[] = [];
    for (const { entry, html } of rendered) {
      if (THUMB_OPT_OUTS[entry.slug]) {
        expect(html).toContain("sg-thumb-note");
        expect(html).toContain(THUMB_OPT_OUTS[entry.slug]);
        continue;
      }
      // An opt-out that was never declared — a thrown render fell back to the
      // note path — is exactly the "unexplained blank tile" this guards.
      if (html.includes("sg-thumb-note")) {
        blanks.push(`${entry.slug}: ${html}`);
        continue;
      }
      const inner = html.slice(html.indexOf("sg-thumb-inner"));
      if (!inner.includes("<")) blanks.push(`${entry.slug}: empty`);
    }
    expect(blanks).toEqual([]);
  });

  it("keeps every snapshot out of the tab order and the a11y tree", () => {
    for (const { html } of rendered) {
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain("inert");
      expect(html).toContain("data-sg-preview-scope");
    }
  });

  it("carries the atom-scale viewport only where it is needed", () => {
    for (const { entry, html } of rendered) {
      const isAtom = ATOM_SCALE_CATEGORIES.includes(entry.meta.category);
      expect(html.includes(`--sg-thumb-vw-n: ${THUMB_VIEWPORT_W_ATOM}`)).toBe(
        isAtom,
      );
    }
  });

  it("emits unique ids across the whole catalogue", () => {
    const ids = rendered.flatMap(({ html }) =>
      [...html.matchAll(/\sid="([^"]*)"/g)].map((match) => match[1]),
    );
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("tile size", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.removeAttribute(ATTR_TILE_SIZE);
    localStorage.clear();
  });

  it("defaults to the compact track", () => {
    expect(DEFAULT_TILE_SIZE).toBe(TILE_SIZES[0].id);
    expect(readTileSize()).toBe(DEFAULT_TILE_SIZE);
  });

  it("round-trips a stored choice", () => {
    applyTileSize("large");
    expect(document.documentElement.getAttribute(ATTR_TILE_SIZE)).toBe("large");
    expect(readTileSize()).toBe("large");
  });

  it("rejects a value that is not an option", () => {
    localStorage.setItem(LS_TILE_SIZE, "enormous");
    expect(isTileSize("enormous")).toBe(false);
    expect(readTileSize()).toBe(DEFAULT_TILE_SIZE);
  });

  it("degrades to the default when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    expect(readTileSize()).toBe(DEFAULT_TILE_SIZE);
  });

  it("still applies the size when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    expect(() => applyTileSize("large")).not.toThrow();
    expect(document.documentElement.getAttribute(ATTR_TILE_SIZE)).toBe("large");
  });

  it("builds the restore script from the same constants", () => {
    expect(TILE_SIZE_RESTORE_SCRIPT).toContain(JSON.stringify(LS_TILE_SIZE));
    expect(TILE_SIZE_RESTORE_SCRIPT).toContain(JSON.stringify(ATTR_TILE_SIZE));
    for (const { id } of TILE_SIZES) {
      expect(TILE_SIZE_RESTORE_SCRIPT).toContain(JSON.stringify(id));
    }
    expect(TILE_SIZE_RESTORE_SCRIPT).toContain("catch");
  });
});
