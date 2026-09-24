/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-side body-end islands helper.
//
// Mirrors the sibling zudo-doc showcase's pages/lib/_body-end-islands.tsx,
// minus the doc-site islands this starter has no use for (AI chat, mermaid,
// doc-history, client-router bootstrap): this starter mounts only the
// engine's preview zdtp token panel bootstrap (`toggle-preview-token-panel`),
// which the header trigger `withZudoSg` injects opens on engine routes.
//
// pages/index.tsx imports this file directly (as well as reaching it through
// `_chrome-bindings.tsx`'s `chromeBindingsModule` wiring), so zfb's island
// scanner is guaranteed to walk page -> this helper -> the real
// engine-route bootstrap wrapper and register its constructor under the
// SSR marker name. `chromeBindingsModule` then makes the injected
// /components/* and /tokens routes render the same marker, so they hydrate
// against that registered constructor too — not just this starter's
// host-owned `/`.

import type { VNode, JSX } from "preact";
import { Island } from "@takazudo/zfb";
import EngineRoutePreviewTokenPanelBootstrap from "./_engine-route-preview-token-panel-bootstrap";
import { previewTokenPanelCaptureScript } from "@takazudo/zudo-sg/token-tweak";

/**
 * The body-end islands this starter mounts. Currently just the preview
 * token panel bootstrap the header trigger opens.
 */
export function BodyEndIslands(): JSX.Element {
  return (
    <>
      {/* Capture pre-hydration clicks; the bootstrap drains this once it loads. */}
      <script
        dangerouslySetInnerHTML={{ __html: previewTokenPanelCaptureScript() }}
      />
      {Island({
        when: "load",
        children: <EngineRoutePreviewTokenPanelBootstrap />,
      }) as unknown as VNode}
    </>
  );
}
