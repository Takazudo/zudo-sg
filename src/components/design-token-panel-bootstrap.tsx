"use client";

// STOPGAP (#206): hand-rolled dynamic-import gate.
//
// The static side-effect import that used to live here
// (`import "@/lib/design-token-panel-bootstrap"`) pulled the whole
// @takazudo/zdtp bundle into the eagerly-loaded islands entry chunk, so zdtp
// downloaded on every page even though the panel is opened rarely. Instead this
// island now stays statically imported + `<Island when="load">`-mounted (so the
// SSR skip-marker stays registered — do NOT reintroduce the orphan-component
// bug documented in the header of pages/lib/_body-end-islands.tsx; PR #150 /
// zudolab/zudo-doc#1355), but at hydration it only registers a byte-cheap
// window loader. The heavy `@/lib/design-token-panel-bootstrap` module (and
// zdtp with it) is dynamic-imported on demand — the first time the doc-chrome
// toggle shim calls the loader.
//
// Remove this gate once the upstream zfb conditional-island feature ships
// (sibling sub #205), which can gate the heavy module natively.

import type { JSX } from "preact";

// Module-scoped cached promise so the heavy chunk downloads at most once.
// Failure semantics (see #206): a rejected import logs, resets the cache so the
// next toggle retries, and is swallowed (no re-throw) to avoid an unhandled
// rejection — the queued `pending` click in the shim is left intact because the
// bootstrap module's `__zdtpReadyClicks` replay only runs on a successful load.
let loadPromise: Promise<unknown> | null = null;
function lazyLoadDesignTokenPanel(): Promise<unknown> {
  if (!loadPromise) {
    loadPromise = import("@/lib/design-token-panel-bootstrap").catch((err) => {
      console.error(
        "[zdtp] failed to load the design token panel; retrying on next toggle",
        err,
      );
      loadPromise = null;
    });
  }
  return loadPromise;
}

function DesignTokenPanelBootstrap(): JSX.Element | null {
  // At hydration register the per-instance loader on window WITHOUT importing
  // the heavy module. The doc-chrome shim in _body-end-islands.tsx calls this
  // (plain `window.*`, no bundler aliases) on the first `toggle-sg-doc-tweak`.
  if (typeof window !== "undefined") {
    (
      window as { __zdtpLazyLoad?: () => Promise<unknown> }
    ).__zdtpLazyLoad = lazyLoadDesignTokenPanel;
  }
  return null;
}
DesignTokenPanelBootstrap.displayName = "DesignTokenPanelBootstrap";

export default DesignTokenPanelBootstrap;
