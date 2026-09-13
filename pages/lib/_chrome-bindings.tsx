/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-callables channel for the package-owned routes (#113).
//
// `settings.chromeBindingsModule` points the zudo-doc routes plugin at this
// module; it re-exports `chromeBindings` into `virtual:zudo-doc-chrome-bindings`,
// which the injected chrome shim spreads into
// `createChrome(routeCtx, { ...chromeBindings, DocHistory })`. Every slot we
// omit keeps its package default (byte-identical to the un-bound injected path).
//
// We override BodyEndIslands. The package default explicitly excludes
// the host token-panel bootstraps (it ships only the settings-derived package
// islands), but this project mounts TWO custom zdtp panels — the doc-chrome
// panel (`toggle-sg-doc-tweak`, opened by the header Design Tokens icon) and the
// preview panel (`toggle-preview-token-panel`) — plus image/mermaid enlarge and
// the sidebar-resizer init. All of that lives in `_body-end-islands.tsx`, so we
// thread it verbatim here to preserve doc-page behaviour.
//
// docHistoryMeta supplies the slug-keyed metadata written by the doc-history
// preBuild hook so the package can render Created / Updated / Author. The host
// plugin serializes it for the renderer, keeping node:fs out of the page graph.
//
// We also override Header, for the @takazudo/zudo-sg catalog routes only. The
// engine passes the registry-built component tree as `sidebarNodesOverride`
// (plus `currentSlug`) on its sidebar routes so the mobile drawer shows the
// component tree; zudo-doc's package header has no such input. Those calls go
// to the host `HeaderWithDefaults` (what the pre-engine host catalog pages
// rendered). Every other caller — the zudo-doc doc/404 routes and the engine's
// root-menu /tokens page — gets the package default header built from the same
// route context, so their output is unchanged by this binding.
//
// Island registration (ADR "route-injection-seam.md", §Host-callables channel):
// client islands reached ONLY through this virtual re-export are NOT guaranteed
// to register on injected routes. That is fine here — the SAME island chains
// (`_body-end-islands.tsx`, and `_header-with-defaults.tsx`'s SidebarToggle /
// ThemeToggle) are statically imported by the retained host pages
// (pages/index.tsx, pages/docs/versions.tsx), so their constructors are
// registered globally and the injected routes' SSR markers hydrate against
// those registry entries. If those pages ever stop importing these chains, add
// a static registration path.

import type { ChromeContext, ChromeHostBindings } from "@takazudo/zudo-doc/factory-context";
import { createHeaderWithDefaults } from "@takazudo/zudo-doc/header-with-defaults";
import { createRouteContext, type RouteContextPayload } from "@takazudo/zudo-doc/route-context";
import { routeContext } from "virtual:zudo-doc-route-context";
import { settings } from "@/config/settings";
import { BodyEndIslands } from "./_body-end-islands";
import { HeaderWithDefaults, type HeaderWithDefaultsProps } from "./_header-with-defaults";
import { docHistoryMeta } from "virtual:zudo-sg-doc-history-meta";

// The package chrome calls the BodyEndIslands slot as a bare component; bind the
// host `basePath` here (only consumed by the aiAssistant-gated modal, off in
// this project). `basePath` is a host-owned value the package can't supply, so
// it wins over anything spread from `props`.
const BodyEndIslandsBound: ChromeHostBindings["BodyEndIslands"] = (props) =>
  BodyEndIslands({ ...props, basePath: settings.base ?? "/" });

type PackageHeader = ReturnType<typeof createHeaderWithDefaults>;
let packageHeader: PackageHeader | undefined;

const HeaderBound: ChromeHostBindings["Header"] = (props) => {
  if (props.sidebarNodesOverride) return HeaderWithDefaults(props as HeaderWithDefaultsProps);
  // Built lazily with createChrome's context composition. The doc routes' extra
  // DesignTokenPanelBootstrap binding only feeds a header gate that
  // `designTokenPanel: false` (zfb.config.ts) already closes, so doc-route HTML
  // stays identical to the unbound package header (diffed in #664).
  packageHeader ??= createHeaderWithDefaults({
    ...createRouteContext(routeContext as unknown as RouteContextPayload),
    components: {},
    hostBindings: chromeBindings,
  } as ChromeContext);
  return packageHeader(props as Parameters<PackageHeader>[0]);
};

export const chromeBindings: ChromeHostBindings = {
  Header: HeaderBound,
  BodyEndIslands: BodyEndIslandsBound,
  docHistoryMeta,
};
