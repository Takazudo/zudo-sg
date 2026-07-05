/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-callables channel for the package-owned routes (#113).
//
// `settings.chromeBindingsModule` points the zudo-doc routes plugin at this
// module; it re-exports `chromeBindings` into `virtual:zudo-doc-chrome-bindings`,
// which the injected chrome shim spreads into
// `createChrome(routeCtx, { DocHistory, ...chromeBindings })`. Every slot we
// omit keeps its package default (byte-identical to the un-bound injected path).
//
// We override ONE slot: BodyEndIslands. The package default explicitly excludes
// the host token-panel bootstraps (it ships only the settings-derived package
// islands), but this project mounts TWO custom zdtp panels — the doc-chrome
// panel (`toggle-sg-doc-tweak`, opened by the header Design Tokens icon) and the
// preview panel (`toggle-preview-token-panel`) — plus image/mermaid enlarge and
// the sidebar-resizer init. All of that lives in `_body-end-islands.tsx`, so we
// thread it verbatim here to preserve doc-page behaviour.
//
// Island registration (ADR "route-injection-seam.md", §Host-callables channel):
// client islands reached ONLY through this virtual re-export are NOT guaranteed
// to register on injected routes. That is fine here — the SAME
// `_body-end-islands.tsx` island chain is statically imported by the retained
// host pages (pages/index.tsx, pages/components/*, pages/docs/versions.tsx), so
// the DesignTokenPanelBootstrap / PreviewTokenPanelBootstrap / ImageEnlarge /
// MermaidEnlarge constructors are registered globally and the injected routes'
// SSR markers hydrate against those registry entries. If the styleguide pages
// ever stop importing this chain, add a static registration path.

import type { ChromeHostBindings } from "@takazudo/zudo-doc/factory-context";
import { settings } from "@/config/settings";
import { BodyEndIslands } from "./_body-end-islands";

// The package chrome calls the BodyEndIslands slot as a bare component; bind the
// host `basePath` here (only consumed by the aiAssistant-gated modal, off in
// this project). `basePath` is a host-owned value the package can't supply, so
// it wins over anything spread from `props`.
const BodyEndIslandsBound: ChromeHostBindings["BodyEndIslands"] = (props) =>
  BodyEndIslands({ ...props, basePath: settings.base ?? "/" });

export const chromeBindings: ChromeHostBindings = {
  BodyEndIslands: BodyEndIslandsBound,
};
