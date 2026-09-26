// #886/#872: the `/tokens` "Preview tokens" button must only render when
// `ctx.previewTokenPanel` is true — with no `zdtpApplyProxy.tabsModule` wired,
// `PreviewTokenPanelBootstrap` no-ops silently and the button would dispatch to
// nothing.
import { render } from "preact-render-to-string";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SG_ROUTES } from "../../sg-routes.js";

const previewTokenPanel = vi.hoisted(() => ({ value: false }));

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
}));

vi.mock("virtual:zudo-sg-tokens", () => ({ tokensManifest: null }));
vi.mock("@takazudo/zudo-doc/color-scheme-utils", () => ({ resolveRampRef: () => "" }));
vi.mock("../../registry/index.js", () => ({ TOKENS_SLUG: "sg-tokens" }));
vi.mock("../../token-dashboard/index.js", () => ({
  buildUiTokenTabs: () => [],
  createTokenDashboards: () => null,
}));

vi.mock("../_chrome.js", () => ({
  chromeProps: ({ pageTitle }: { pageTitle: string }) => ({ title: pageTitle }),
  routeCtx: {},
  settings: {},
}));

vi.mock("../../chrome/index.js", () => ({
  StyleguideLayout: ({ children }: { children: unknown }) => <main>{children as never}</main>,
}));

vi.mock("../../token-tweak/preview-tokens-button.js", () => ({
  default: () => <button data-testid="preview-tokens-button" />,
}));

vi.mock("@takazudo/zfb", () => ({
  Island: ({ children }: { children: unknown }) => <div data-island="PreviewTokensButton">{children as never}</div>,
}));

describe("/tokens route — Preview tokens button gating (#886/#872)", () => {
  it("renders the button when the preview token panel is wired", async () => {
    previewTokenPanel.value = true;
    vi.resetModules();
    const { default: TokensRoute } = await import("../tokens.js");
    const html = render(<TokensRoute />);
    expect(html).toContain('data-island="PreviewTokensButton"');
  });

  it("renders nothing for the button when the preview token panel is not wired", async () => {
    previewTokenPanel.value = false;
    vi.resetModules();
    const { default: TokensRoute } = await import("../tokens.js");
    const html = render(<TokensRoute />);
    expect(html).not.toContain('data-island="PreviewTokensButton"');
  });
});
