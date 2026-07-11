"use client";

// STOPGAP (#206): hand-rolled dynamic-import gate — preview (@zudo-sg/ui) panel.
//
// Mirrors design-token-panel-bootstrap.tsx: the static side-effect import that
// used to live here (`import "@/lib/preview-token-panel-bootstrap"`) pulled
// @takazudo/zdtp into the eagerly-loaded islands entry chunk. This island stays
// statically imported + `<Island when="load">`-mounted so the SSR skip-marker
// stays registered (do NOT reintroduce the orphan-component bug — see the
// header of pages/lib/_body-end-islands.tsx; PR #150 / zudolab/zudo-doc#1355),
// but at hydration it only registers a byte-cheap window loader. The heavy
// `@/lib/preview-token-panel-bootstrap` module (and zdtp with it) is
// dynamic-imported on demand — the first time the preview toggle shim calls it.
//
// Remove this gate once the upstream zfb conditional-island feature ships
// (sibling sub #205), which can gate the heavy module natively.

import type { JSX } from "preact";

// Module-scoped cached promise so the heavy chunk downloads at most once.
// Failure semantics (see #206): a rejected import logs, resets the cache so the
// next toggle retries, and is swallowed (no re-throw) to avoid an unhandled
// rejection — the queued `pending` click in the shim is left intact because the
// bootstrap module's `__zdtpPreviewReadyClicks` replay only runs on a
// successful load.
let loadPromise: Promise<unknown> | null = null;
function lazyLoadPreviewTokenPanel(): Promise<unknown> {
  if (!loadPromise) {
    loadPromise = import("@/lib/preview-token-panel-bootstrap").catch((err) => {
      console.error(
        "[zdtp] failed to load the preview token panel; retrying on next toggle",
        err,
      );
      loadPromise = null;
    });
  }
  return loadPromise;
}

function PreviewTokenPanelBootstrap(): JSX.Element | null {
  // At hydration register the per-instance loader on window WITHOUT importing
  // the heavy module. The preview shim in _body-end-islands.tsx calls this
  // (plain `window.*`, no bundler aliases) on the first
  // `toggle-preview-token-panel`.
  if (typeof window !== "undefined") {
    const w = window as {
      __zdtpPreviewLazyLoad?: () => Promise<unknown>;
      __zdtpPreviewPending?: boolean;
    };
    w.__zdtpPreviewLazyLoad = lazyLoadPreviewTokenPanel;
    // Reconcile with a click buffered before this loader registered — same
    // pre-hydration race as the doc-chrome instance (#204 review). Latent for
    // the preview trigger today (its button hydrates in the same island pass),
    // but fixed here so a scheduling change can't silently drop the first click.
    if (w.__zdtpPreviewPending) {
      lazyLoadPreviewTokenPanel();
    }
  }
  return null;
}
PreviewTokenPanelBootstrap.displayName = "PreviewTokenPanelBootstrap";

export default PreviewTokenPanelBootstrap;
