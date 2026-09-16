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
// There is deliberately NO Header binding. The engine used to need one: it
// passes the registry-built component tree for its catalog routes' mobile
// drawer, and zudo-doc's header had no input for that, so this module bound a
// host header just to receive it. zudo-doc 5.25.0 (zudolab/zudo-doc#4212, filed
// from this repo) added the `sidebarNodes` prop, and the engine passes it
// directly — so every route now renders the package default header.
//
// Island registration (ADR "route-injection-seam.md", §Host-callables channel):
// client islands reached ONLY through this virtual re-export are NOT guaranteed
// to register on injected routes. That is fine here — the SAME island chains
// (`_body-end-islands.tsx`, and the `SidebarToggle` / `ThemeToggle` modules the
// package header renders, which `_header-with-defaults.tsx` imports from the
// same subpaths) are statically imported by the retained host pages
// (pages/index.tsx, pages/docs/versions.tsx), so their constructors are
// registered globally and the injected routes' SSR markers hydrate against
// those registry entries. If those pages ever stop importing these chains, add
// a static registration path.

import type { ChromeHostBindings } from "@takazudo/zudo-doc/factory-context";
import { settings } from "@/config/settings";
import { BodyEndIslands } from "./_body-end-islands";
import { docHistoryMeta } from "virtual:zudo-sg-doc-history-meta";

// The package chrome calls the BodyEndIslands slot as a bare component; bind the
// host `basePath` here (only consumed by the aiAssistant-gated modal, off in
// this project). `basePath` is a host-owned value the package can't supply, so
// it wins over anything spread from `props`.
const BodyEndIslandsBound: ChromeHostBindings["BodyEndIslands"] = (props) =>
  BodyEndIslands({ ...props, basePath: settings.base ?? "/" });

export const chromeBindings: ChromeHostBindings = {
  BodyEndIslands: BodyEndIslandsBound,
  docHistoryMeta,
};
