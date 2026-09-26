// Descriptor registry mode (epic #879, E1 / #882): the real `_registry.ts`
// facade, the catalog route, the detail route and its `paths()` rendered from a
// plain-data descriptor fixture. Chrome, layout and zfb runtime are stubbed —
// only the route bodies and the registry wiring are under test.
import type { ComponentChildren, VNode } from "preact";
import { render } from "preact-render-to-string";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SG_ROUTES } from "../../sg-routes.js";

const fixture = vi.hoisted(() => [
  {
    id: "pgen/button",
    slug: "Button_v2",
    category: "Actions",
    title: "Button",
    description: "Clickable action.",
    sourcePath: "src/button.stories.tsx",
    variants: [
      { exportName: "Primary", name: "Primary" },
      { exportName: "Ghost", name: "Ghost", controls: [{ type: "boolean", prop: "disabled", defaultValue: false }] },
    ],
  },
  {
    id: "pgen/card",
    slug: "card",
    category: "Layout",
    title: "Card",
    variants: [{ exportName: "Default", name: "Default" }],
    // Unknown keys are dropped by validation.
    extra: true,
  },
]);

vi.mock("virtual:zudo-sg-registry", () => ({
  storyModules: {},
  storyExportOrder: {},
  storyDescriptors: fixture,
}));

vi.mock("../_context.js", () => ({
  ctx: {
    base: "/",
    routes: DEFAULT_SG_ROUTES,
    registryMode: "descriptor",
    categoryOrder: ["Layout"],
    uiPackageName: null,
    previewCssUrl: "/_zudo-sg/preview.css",
    catalog: { title: "Catalog", intro: null },
    componentDocs: [],
    // Descriptor mode requires externalPreview (issue #884); no manifest here,
    // so tokens is implied disabled too.
    disabledRoutes: ["componentsPreview", "tokens"],
    externalPreviewUrl: "/preview/frame",
    // No token manifest and no zdtpApplyProxy.tabsModule wired in this fixture.
    previewTokenPanel: false,
  },
  withBase: (path: string) => path,
}));

vi.mock("../_chrome.js", () => ({
  chromeProps: ({ pageTitle }: { pageTitle: string }) => ({ title: pageTitle }),
}));

vi.mock("../_preview-app.js", () => ({ default: () => null }));

vi.mock("../../chrome/index.js", () => ({
  StyleguideLayout: ({ children, codePanel, title }: { children: ComponentChildren; codePanel?: unknown; title: string }) => (
    <main data-title={title} data-code-panel={codePanel ? "present" : "absent"}>
      {children}
    </main>
  ),
}));

// Render each island as a named marker so the test can see which ones mount.
vi.mock("@takazudo/zfb", () => ({
  Island: ({ children }: { children: VNode }) => {
    const type = children.type as { displayName?: string; name?: string };
    return <div data-island={type.displayName ?? type.name} data-props={JSON.stringify(children.props)} />;
  },
}));

const getEntry = vi.hoisted(() => vi.fn());
vi.mock("@takazudo/zfb/content", () => ({ getEntry }));
vi.mock("@takazudo/zudo-doc/content-admonition", () => ({ makeAdmonition: () => () => null }));

describe("_registry.ts in descriptor mode", () => {
  it("builds the catalog facade from validated descriptors and leaves the story registry empty", async () => {
    const { registry, storyRegistry } = await import("../_registry.js");
    expect(storyRegistry.storyEntries).toEqual([]);
    expect(registry.getAllSlugs()).toEqual(["Button_v2", "card"]);
    expect(registry.getCategoryGroups().map((g) => g.category)).toEqual(["Layout", "Actions"]);
    expect(registry.getStoryBySlug("card")).not.toHaveProperty("extra");
  });
});

describe("components-slug paths()", () => {
  it("returns the descriptor slugs verbatim", async () => {
    const { paths } = await import("../components-slug.js");
    expect(paths()).toEqual([
      { params: { slug: "Button_v2" }, props: { slug: "Button_v2" } },
      { params: { slug: "card" }, props: { slug: "card" } },
    ]);
  });
});

describe("components-index route (descriptor mode)", () => {
  it("renders tiles from CatalogEntry fields with a labelled missing-thumbnail note", async () => {
    const { default: ComponentsIndexRoute } = await import("../components-index.js");
    const html = render(<ComponentsIndexRoute />);

    expect(html).toContain('href="/components/Button_v2"');
    expect(html).toContain('data-name="button"');
    expect(html).toContain('data-keywords="button clickable action. actions"');
    expect(html).toContain('<h3 class="sg-tile-title">Card</h3>');
    expect(html).toContain("2 variant");
    // Neither fixture entry declares a `thumbnail`, so both tiles fall back to
    // the default missing-thumbnail note.
    expect(html.match(/data-sg-thumb-note/g)).toHaveLength(2);
    expect(html.match(/No thumbnail provided/g)).toHaveLength(2);
    expect(html).not.toContain("<img");
    expect(html).toContain("listed from");
    expect(html).not.toContain(".stories.tsx");
    // categoryOrder puts Layout before Actions.
    expect(html.indexOf('data-category="Layout"')).toBeLessThan(html.indexOf('data-category="Actions"'));
  });
});

describe("components-slug route (descriptor mode)", () => {
  it("renders the header and workbench from the descriptor, without a CodePanel or doc", async () => {
    const { default: ComponentsSlugRoute } = await import("../components-slug.js");
    const html = render(<ComponentsSlugRoute slug="Button_v2" params={{ slug: "Button_v2" }} />);

    expect(html).toContain('data-title="Button"');
    expect(html).toContain('data-code-panel="absent"');
    expect(html).not.toContain('data-island="CodePanel"');
    expect(html).toContain('data-island="DetailWorkbench"');
    expect(html).toContain("Clickable action.");
    expect(html).toContain("Actions");
    expect(html).toContain("&quot;exportName&quot;:&quot;Ghost&quot;");
    expect(html).toContain("&quot;prop&quot;:&quot;disabled&quot;");
    expect(html).not.toContain("Live demo");
    expect(getEntry).not.toHaveBeenCalled();
    // The host's externalPreview replaces the (disabled) in-engine preview route.
    expect(html).toContain("&quot;previewUrl&quot;:&quot;/preview/frame&quot;");
    // Descriptor mode mounts no CodePanel island (S2b); the workbench toolbar
    // must not offer a dead toggle for it, and tokenPanel follows the (here,
    // unwired) previewTokenPanel flag (#886/#872).
    expect(html).toContain("&quot;toolbar&quot;:{&quot;codePanel&quot;:false,&quot;tokenPanel&quot;:false}");
  });

  it("renders not-found for an unknown slug", async () => {
    const { default: ComponentsSlugRoute } = await import("../components-slug.js");
    expect(render(<ComponentsSlugRoute slug="nope" params={{ slug: "nope" }} />)).toContain("Story not found: nope");
  });
});

// components-preview.tsx no longer branches on descriptor mode (issue #884):
// resolveRoutesPluginOptions requires externalPreview there, which implies
// componentsPreview disabled, so the routes plugin never injects this
// entrypoint in descriptor mode at all. Generic componentsPreview rendering
// is covered by components-preview.test.tsx.
