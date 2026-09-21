/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-side body-end islands helper.
//
// Mirrors the sibling zudo-doc showcase's pages/lib/_body-end-islands.tsx,
// minus the doc-site islands this starter has no use for (AI chat, mermaid,
// doc-history, client-router bootstrap): this starter mounts only the
// engine's preview zdtp token panel bootstrap (`toggle-preview-token-panel`),
// which the header trigger `withZudoSg` injects opens.
//
// pages/index.tsx imports this file directly (as well as reaching it through
// `_chrome-bindings.tsx`'s `chromeBindingsModule` wiring), so zfb's island
// scanner is guaranteed to walk page -> this helper -> the real
// PreviewTokenPanelBootstrap component and register its constructor under the
// SSR marker name. `chromeBindingsModule` then makes the injected
// /components/* and /tokens routes render the same marker, so they hydrate
// against that registered constructor too — not just this starter's
// host-owned `/`.

import type { VNode, JSX } from "preact";
import { Island } from "@takazudo/zfb";
import PreviewTokenPanelBootstrap from "@takazudo/zudo-sg/token-tweak/preview-token-panel-bootstrap";

(PreviewTokenPanelBootstrap as { displayName?: string }).displayName = "PreviewTokenPanelBootstrap";

function prehydrationPanelToggleScript(toggleEvent: string): string {
  return `(${function capturePanelToggle(channel: string) {
    const script = document.currentScript as (HTMLScriptElement & {
      __zdtpPrehydrateListener?: EventListener;
    }) | null;
    if (!script || script.dataset.bound === "1") return;
    script.dataset.bound = "1";
    script.dataset.pending = "0";
    const listener = () => {
      script.dataset.pending = String(Number(script.dataset.pending ?? "0") + 1);
    };
    script.__zdtpPrehydrateListener = listener;
    window.addEventListener(channel, listener);
  }.toString()})(${JSON.stringify(toggleEvent)});`;
}

/**
 * The body-end islands this starter mounts. Currently just the preview
 * token panel bootstrap the header trigger opens.
 */
export function BodyEndIslands(): JSX.Element {
  return (
    <>
      {/* Capture pre-hydration clicks; the bootstrap drains this once it loads. */}
      <script
        id="zdtp-preview-prehydrate"
        dangerouslySetInnerHTML={{ __html: prehydrationPanelToggleScript("toggle-preview-token-panel") }}
      />
      {Island({
        when: "load",
        children: <PreviewTokenPanelBootstrap />,
      }) as unknown as VNode}
    </>
  );
}
