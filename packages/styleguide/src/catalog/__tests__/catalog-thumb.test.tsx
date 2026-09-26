/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Mode-neutral catalog thumbnail contracts (epic #879, E3). `CatalogThumb`
// branches on `entry.source` before touching anything story-shaped, so a
// descriptor entry must never reach the module-mode SSR renderer
// (`preact-render-to-string`) — see the "renderer isolation" block below,
// which proves that with a spy rather than by reading the source.

import { render } from "preact-render-to-string";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DescriptorCatalogEntry, ModuleCatalogEntry } from "../../registry/catalog.js";
import { createRegistry } from "../../registry/registry.js";
import type { Story, StoryModule } from "../../stories/types.js";
import { CatalogThumb } from "../catalog-thumb.js";
import { DESCRIPTOR_THUMB_MISSING_NOTE, DescriptorThumb } from "../descriptor-thumb.js";

function descriptorEntry(overrides: Partial<DescriptorCatalogEntry> = {}): DescriptorCatalogEntry {
  return {
    slug: "widget",
    id: "pgen/widget",
    title: "Widget",
    description: "",
    category: "Layout",
    variants: [{ exportName: "Default", name: "Default" }],
    source: "descriptor",
    ...overrides,
  };
}

function moduleEntry(): ModuleCatalogEntry {
  const modules: Record<string, StoryModule> = {
    "./a.stories.tsx": {
      default: { title: "Alpha", category: "Layout", description: "", usage: "" },
      Primary: { name: "Primary", render: () => <div class="alpha">alpha</div> } as Story,
    },
  };
  const entry = createRegistry(modules).storyEntries[0]!;
  return {
    slug: entry.slug,
    id: entry.path,
    title: entry.meta.title,
    description: "",
    category: entry.meta.category,
    variants: [],
    source: "module",
    storyEntry: entry,
  };
}

describe("DescriptorThumb", () => {
  it("renders an image with a base-prefixed src and dimensions inside an aria-hidden + inert wrapper, with no iframe", () => {
    const entry = descriptorEntry({
      thumbnail: { kind: "image", src: "/thumbs/widget.png", width: 320, height: 200, alt: "Widget preview" },
    });
    const html = render(<DescriptorThumb entry={entry} base="/docs" />);

    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("inert");
    expect(html).not.toContain("<iframe");
    expect(html).toContain("<img");
    expect(html).toContain('src="/docs/thumbs/widget.png"');
    expect(html).toContain('width="320"');
    expect(html).toContain('height="200"');
    expect(html).toContain('alt="Widget preview"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
  });

  it("leaves a non-root-absolute src untouched", () => {
    const entry = descriptorEntry({
      thumbnail: { kind: "image", src: "https://cdn.example.com/w.png", width: 10, height: 10 },
    });
    const html = render(<DescriptorThumb entry={entry} base="/docs" />);
    expect(html).toContain('src="https://cdn.example.com/w.png"');
  });

  it("defaults alt to an empty string and the base to no prefix", () => {
    const entry = descriptorEntry({ thumbnail: { kind: "image", src: "/w.png", width: 10, height: 10 } });
    const html = render(<DescriptorThumb entry={entry} />);
    expect(html).toMatch(/\balt(="")?[\s/]/);
    expect(html).toContain('src="/w.png"');
  });

  it("renders a placeholder's note instead of an image", () => {
    const entry = descriptorEntry({ thumbnail: { kind: "placeholder", note: "Coming soon" } });
    const html = render(<DescriptorThumb entry={entry} />);
    expect(html).toContain("sg-thumb-note");
    expect(html).toContain("Coming soon");
    expect(html).not.toContain("<img");
  });

  it("renders the default missing-thumbnail note when no thumbnail is declared", () => {
    const html = render(<DescriptorThumb entry={descriptorEntry()} />);
    expect(html).toContain(DESCRIPTOR_THUMB_MISSING_NOTE);
    expect(html).not.toContain("<img");
  });
});

describe("CatalogThumb dispatch", () => {
  it("renders a descriptor entry through DescriptorThumb", () => {
    const entry = descriptorEntry({ thumbnail: { kind: "placeholder", note: "x" } });
    expect(render(<CatalogThumb entry={entry} />)).toContain("x");
  });

  it("renders a module entry through ComponentThumb, forwarding no base", () => {
    const html = render(<CatalogThumb entry={moduleEntry()} />);
    expect(html).toContain("sg-thumb-inner");
    expect(html).toContain("alpha");
  });

  it("forwards `base` to the descriptor branch for a root-absolute image src", () => {
    const entry = descriptorEntry({ thumbnail: { kind: "image", src: "/w.png", width: 10, height: 10 } });
    const html = render(<CatalogThumb entry={entry} base="/docs" />);
    expect(html).toContain('src="/docs/w.png"');
  });
});

describe("renderer isolation", () => {
  afterEach(() => {
    vi.doUnmock("preact-render-to-string");
    vi.resetModules();
  });

  it("never calls preact-render-to-string's render for a descriptor entry, but still does for a module entry", async () => {
    const renderSpy = vi.fn(() => "<div>spied</div>");
    vi.doMock("preact-render-to-string", () => ({ render: renderSpy }));
    vi.resetModules();

    const [{ CatalogThumb: FreshCatalogThumb }, { render: realRender }] = await Promise.all([
      import("../catalog-thumb.js"),
      vi.importActual<typeof import("preact-render-to-string")>("preact-render-to-string"),
    ]);

    const html = realRender(<FreshCatalogThumb entry={descriptorEntry({ thumbnail: { kind: "placeholder", note: "x" } })} />);
    expect(renderSpy).not.toHaveBeenCalled();
    expect(html).toContain("x");

    realRender(<FreshCatalogThumb entry={moduleEntry()} />);
    expect(renderSpy).toHaveBeenCalled();
  });
});
