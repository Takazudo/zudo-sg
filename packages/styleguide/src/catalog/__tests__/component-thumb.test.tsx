/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// @vitest-environment happy-dom
// Catalogue gallery contracts (#540, moved into the engine package by #653).
//
// The framing model is split across TypeScript (which viewport width a
// category gets, how the snapshot is scoped) and CSS (the scale and fit rule),
// so this file checks BOTH halves and the seam between
// them.
//
// This package must not reach into a host's real story registry (`@/…` is a
// host-only alias — see scripts/check-no-host-alias.mjs), so the rendering
// tests below build synthetic `StoryEntry` fixtures instead of importing a
// real 72-component catalogue. A host that wires the real registry through
// `ComponentThumb` is responsible for its own "every tile shows something"
// regression coverage against its actual story set.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "preact-render-to-string";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Story, StoryModule } from "../../stories/types.js";
import { createRegistry } from "../../registry/registry.js";
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
} from "../component-thumb.js";
import {
  ATTR_TILE_SIZE,
  DEFAULT_TILE_SIZE,
  LS_TILE_SIZE,
  TILE_SIZES,
  TILE_SIZE_RESTORE_SCRIPT,
  applyTileSize,
  isTileSize,
  readTileSize,
} from "../tile-size.js";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../");
const galleryCss = readFileSync(resolve(PKG_ROOT, "styles.css"), "utf8");

/** Build a minimal one-variant story fixture. */
function story(name: string, render_: Story["render"] = () => <button>x</button>): Story {
  return { name, render: render_ };
}

function storyModule(title: string, category: string, variants: Record<string, Story>): StoryModule {
  return { default: { title, category, description: "", usage: "" }, ...variants };
}

function fixtureRegistry(modules: Readonly<Record<string, StoryModule>>) {
  return createRegistry(modules);
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
    expect(thumbScale(compact!.trackMin, THUMB_VIEWPORT_W)).toBeCloseTo(272 / 720, 6);
    expect(thumbScale(large!.trackMin, THUMB_VIEWPORT_W)).toBeCloseTo(400 / 720, 6);
    // Atoms reach 1:1 in Large rather than being blown up past their layout.
    expect(thumbScale(large!.trackMin, THUMB_VIEWPORT_W_ATOM)).toBe(1);
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
      new RegExp(`--sg-tile-min-n:\\s*${TILE_SIZES[0]!.trackMin};`),
    );
    expect(galleryCss).toMatch(
      new RegExp(
        `\\[data-sg-tile-size="${TILE_SIZES[1]!.id}"\\][\\s\\S]*?--sg-tile-min-n:\\s*${TILE_SIZES[1]!.trackMin};`,
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
    expect(galleryCss.match(/aspect-ratio:\s*16\s*\/\s*10;/g)?.length).toBeGreaterThanOrEqual(2);
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
  it("leaves host semantic colors to the host", () => {
    expect(galleryCss).not.toContain(".sg-thumb[data-sg-preview-scope] {");
    expect(galleryCss).not.toContain("--palette-neutral-");
    expect(galleryCss).not.toContain("--palette-accent-");
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

  it("drops style blocks, which are both invalid here and page-global", () => {
    const out = scopeThumbHtml(
      '<div><style>.zui-nav-story-frame nav { position: absolute; }</style><nav>kept</nav></div>',
      "p-",
    );
    expect(out).not.toContain("<style");
    expect(out).not.toContain("zui-nav-story-frame");
    expect(out).toContain("<nav>kept</nav>");
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

describe("ComponentThumb rendering", () => {
  const modules: Record<string, StoryModule> = {
    "./a.stories.tsx": storyModule("Alpha", "Layout", {
      Primary: story("Primary", () => <div class="alpha">alpha</div>),
    }),
    "./b.stories.tsx": storyModule("Beta", "Typography", {
      Primary: story("Primary", () => <span class="beta">beta</span>),
    }),
    "./c.stories.tsx": storyModule("Gamma (throws)", "Layout", {
      Primary: story("Primary", () => {
        throw new Error("boom");
      }),
    }),
  };
  const registry = fixtureRegistry(modules);
  const entries = registry.storyEntries;

  it("renders every component inline, or names the reason it cannot", () => {
    for (const entry of entries) {
      const html = render(<ComponentThumb entry={entry} />);
      if (entry.meta.title.includes("throws")) {
        expect(html).toContain("sg-thumb-note");
        expect(html).toContain("Preview unavailable: boom");
      } else {
        expect(html).toContain("sg-thumb-inner");
        expect(html).not.toContain("sg-thumb-note");
      }
    }
  });

  it("keeps every snapshot out of the tab order and the a11y tree", () => {
    for (const entry of entries) {
      const html = render(<ComponentThumb entry={entry} />);
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain("inert");
      expect(html).toContain("data-sg-preview-scope");
    }
  });

  it("carries the atom-scale viewport only where the category needs it", () => {
    for (const entry of entries) {
      const html = render(<ComponentThumb entry={entry} />);
      const isAtom = ATOM_SCALE_CATEGORIES.includes(entry.meta.category);
      expect(html.includes(`--sg-thumb-vw-n: ${THUMB_VIEWPORT_W_ATOM}`)).toBe(isAtom);
    }
  });

  it("emits unique ids across every tile it renders", () => {
    const ids = entries.flatMap((entry) => {
      const html = render(<ComponentThumb entry={entry} />);
      return [...html.matchAll(/\sid="([^"]*)"/g)].map((match) => match[1]);
    });
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("honors a declared opt-out without ever calling render", () => {
    const renderSpy = vi.fn(() => <div>never</div>);
    const optOutModules: Record<string, StoryModule> = {
      "./d.stories.tsx": storyModule("Delta", "Layout", {
        Primary: story("Primary", renderSpy),
      }),
    };
    const entry = fixtureRegistry(optOutModules).storyEntries[0]!;
    (THUMB_OPT_OUTS as Record<string, string>)[entry.slug] = "manually opted out";
    try {
      const html = render(<ComponentThumb entry={entry} />);
      expect(html).toContain("manually opted out");
      expect(renderSpy).not.toHaveBeenCalled();
    } finally {
      delete (THUMB_OPT_OUTS as Record<string, string>)[entry.slug];
    }
  });
});

describe("tile size", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.removeAttribute(ATTR_TILE_SIZE);
    localStorage.clear();
  });

  it("defaults to the compact track", () => {
    expect(DEFAULT_TILE_SIZE).toBe(TILE_SIZES[0]!.id);
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
