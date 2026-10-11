import { renderSsr } from "@zudo-sg/demo-ui/src/test-utils/zudo-react.ts";
import { expect, it, vi } from "vitest";
import { ThemeControl } from "@zudo-sg/demo-ui/src/shared/theme-control/theme-control.tsx";
import NavEnhancer from "@zudo-sg/demo-ui/src/chrome/nav-enhancer/nav-enhancer.tsx";
import MobileNavEnhancer from "@zudo-sg/demo-ui/src/chrome/mobile-nav-enhancer/mobile-nav-enhancer.tsx";
import ContextSwitcherEnhancer from "@zudo-sg/demo-ui/src/chrome/context-switcher-enhancer/context-switcher-enhancer.tsx";
import SearchToggleEnhancer from "@zudo-sg/demo-ui/src/chrome/search-toggle-enhancer/search-toggle-enhancer.tsx";

vi.mock("@takazudo/zfb/content", () => ({ getCollection: () => [] }));
vi.mock("../../components/router/client-router-bootstrap", () => ({
  default: function ClientRouterBootstrap() { return null; },
}));
import ClientRouterBootstrap from "../../components/router/client-router-bootstrap";
import DefaultLayout from "../default";

it("registers real page Island boundaries while preserving the chrome persistence hooks", () => {
  const html = renderSsr(<DefaultLayout line="energy"><p>Content</p></DefaultLayout>, {
    build: "demo-test",
    components: [ThemeControl, NavEnhancer, MobileNavEnhancer, ContextSwitcherEnhancer,
      SearchToggleEnhancer, ClientRouterBootstrap],
  });
  expect(html.match(/data-zfb-island-skip-ssr="ThemeControl"/g)).toHaveLength(2);
  expect(html.match(/data-zfb-island-skip-ssr=/g)).toHaveLength(7);
  // Both ThemeControl instances and all five body-end islands activate on load.
  expect(html.match(/data-when="load"/g)).toHaveLength(7);
  expect(html.match(/data-when="visible"/g)).toBeNull();
  expect(html.match(/data-zfb-island-skip-ssr="ThemeControl" data-when="load"/g)).toHaveLength(2);
  // A body-end render-null placeholder is not the header's visibility target.
  // Browse must bind before interaction without requiring a scroll to this island.
  expect(html).toMatch(/data-zfb-island-skip-ssr="ContextSwitcherEnhancer" data-when="load"/);
  expect(html).toContain('data-zfb-transition-persist="header-energy"');
  expect(html).toContain('data-zfb-transition-persist="sidebar-energy"');
  expect(html).toContain('id="zui-nav-toggle"');
  expect(html).toContain('id="zd-page-loading-overlay"');
});
