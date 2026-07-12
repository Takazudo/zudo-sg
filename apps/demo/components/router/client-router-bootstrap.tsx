"use client";

// SPA ClientRouter browser-side bootstrap island.
//
// `<ClientRouter />` mounted in layouts/default.tsx's <head> only emits the
// opt-in meta tags + announcer stylesheet during SSR — the click/form-submit
// intercept registration in `@takazudo/zfb-runtime/client-router` is guarded
// by `if (typeof document !== "undefined")`, so it never runs server-side. A
// "use client" island is what gets this module evaluated in the browser.
//
// Mounted body-end with `<Island when="load" ssrFallback={null}>` (layouts/
// default.tsx) so the intercept is registered before the first click.

// Side-effect imports only — evaluating this module in the browser is what
// triggers the `typeof document !== "undefined"` init guard.
import "@takazudo/zfb-runtime/client-router";
// Re-syncs the persistent nav rail's active-section state after a soft nav.
import "./nav-sync";

import type { JSX } from "preact";

/**
 * Renders nothing — this component exists only as an island marker so zfb's
 * scanner walks page → layout → ClientRouterBootstrap and includes the
 * client-router bundle in the client build.
 */
function ClientRouterBootstrap(): JSX.Element | null {
  return null;
}

// Stable marker name across production minification.
ClientRouterBootstrap.displayName = "ClientRouterBootstrap";

export default ClientRouterBootstrap;
