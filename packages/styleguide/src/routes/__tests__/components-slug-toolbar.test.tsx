// #886: the detail route (`components-slug.tsx`) must opt the two toolbar
// groups that default OFF (#883, issue #872) back in explicitly — `codePanel`
// only in module mode (where the CodePanel island above is actually mounted),
// `tokenPanel` following `ctx.previewTokenPanel`. Descriptor mode is covered
// by `descriptor-routes.test.tsx`; this file is module mode.
import type { ComponentChildren, VNode } from "preact";
import { render } from "preact-render-to-string";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SG_ROUTES } from "../../sg-routes.js";

const previewTokenPanel = vi.hoisted(() => ({ value: false }));

function moduleEntry() {
  return {
    slug: "button",
    id: "ui/src/button",
    title: "Button",
    description: "Clickable action.",
    category: "Actions",
    variants: [{ exportName: "Default", name: "Default" }],
    source: "module" as const,
    storyEntry: {
      path: "ui/src/button",
      slug: "button",
      meta: { title: "Button", category: "Actions", usage: "<Button />" },
      variants: [{ exportName: "Default", name: "Default", story: { render: () => null } }],
    },
  };
}

vi.mock("../_context.js", () => ({
  get ctx() {
    return {
      base: "/",
      routes: DEFAULT_SG_ROUTES,
      registryMode: "module",
      categoryOrder: [],
      uiPackageName: null,
      previewCssUrl: "/_zudo-sg/preview.css",
      catalog: { title: "Catalog", intro: null },
      componentDocs: [],
      disabledRoutes: [],
      externalPreviewUrl: null,
      previewTokenPanel: previewTokenPanel.value,
    };
  },
  withBase: (path: string) => path,
}));

vi.mock("../_registry.js", () => ({
  registry: { getStoryBySlug: () => moduleEntry() },
}));

vi.mock("../_chrome.js", () => ({
  chromeProps: ({ pageTitle }: { pageTitle: string }) => ({ title: pageTitle }),
}));

vi.mock("../../chrome/index.js", () => ({
  StyleguideLayout: ({ children, title }: { children: ComponentChildren; title: string }) => (
    <main data-title={title}>{children}</main>
  ),
}));

vi.mock("../../code-panel/index.js", () => ({
  CodePanel: () => null,
}));

vi.mock("../../registry/index.js", () => ({
  resolveComponentDoc: () => null,
}));

vi.mock("@takazudo/zfb/content", () => ({ getEntry: () => undefined }));
vi.mock("@takazudo/zudo-doc/content-admonition", () => ({ makeAdmonition: () => () => null }));

// Render each island as a marker carrying its props, so the toolbar/selection/
// theme props passed to DetailWorkbench are inspectable from the SSR output.
vi.mock("@takazudo/zfb", () => ({
  Island: ({ children }: { children: VNode }) => {
    const type = children.type as { displayName?: string; name?: string };
    return <div data-island={type.displayName ?? type.name} data-props={JSON.stringify(children.props)} />;
  },
}));

describe("components-slug route — DetailWorkbench toolbar wiring (module mode, #886)", () => {
  it("passes codePanel: true (a CodePanel island is mounted) and tokenPanel following ctx.previewTokenPanel", async () => {
    previewTokenPanel.value = true;
    vi.resetModules();
    const { default: ComponentsSlugRoute } = await import("../components-slug.js");
    const html = render(<ComponentsSlugRoute slug="button" params={{ slug: "button" }} />);

    expect(html).toContain('data-island="DetailWorkbench"');
    expect(html).toContain('&quot;toolbar&quot;:{&quot;codePanel&quot;:true,&quot;tokenPanel&quot;:true}');
    expect(html).toContain('&quot;selection&quot;:{&quot;mode&quot;:&quot;all&quot;}');
    expect(html).toContain('&quot;theme&quot;:{&quot;mode&quot;:&quot;toolbar&quot;}');
  });

  it("passes tokenPanel: false when the panel is not wired", async () => {
    previewTokenPanel.value = false;
    vi.resetModules();
    const { default: ComponentsSlugRoute } = await import("../components-slug.js");
    const html = render(<ComponentsSlugRoute slug="button" params={{ slug: "button" }} />);

    expect(html).toContain('&quot;toolbar&quot;:{&quot;codePanel&quot;:true,&quot;tokenPanel&quot;:false}');
  });
});
