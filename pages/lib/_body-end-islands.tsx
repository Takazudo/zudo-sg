/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-side body-end islands helper.
//
// Wave 8 (Path A — super-epic #1333 / child epic #1355) drops the local
// SSR-skip wrapper functions in `@takazudo/zudo-doc/ssr-skip` and uses
// zfb's native `<Island ssrFallback={...}>` API directly with the real
// component constructors imported by the host.
//
// The previous indirection (page → wrapper → placeholder div) created an
// orphan-component bug: the real components were `"use client"` modules
// that no page module ever imported transitively, so zfb's island scanner
// never walked page → real-component, the manifest never bound the marker
// to the real constructor, and the bundle never contained the real
// component body. PR #150 to zfb fixed the marker-name alignment but the
// orphan problem stayed — see issue zudolab/zudo-doc#1355 Wave 7 report.
//
// This helper is the page → real-component import chain the scanner
// needs. Each island below is composed with zfb's `<Island>` wrapper,
// which emits `<div data-zfb-island-skip-ssr="<ComponentName>">…</div>`
// at SSR (zfb's `captureComponentName` derives the marker from
// `child.displayName ?? child.name`). Because the page imports this
// file, and this file imports the real components, the scanner walks
// page → helper → real component and registers the constructor under
// the SSR marker name.
//
// Pattern mirrors `_header-with-defaults.tsx`: the JSX-shim widens
// `Island`'s return type to `unknown`, so call-sites cast through
// `as unknown as VNode` at the boundary.

import type { VNode, JSX } from "preact";
import { Island } from "@takazudo/zfb";
import { settings } from "@/config/settings";
import { SidebarResizerInit } from "@takazudo/zudo-doc/sidebar-resizer";

// #113: adopt the package enlarge/ai-chat islands directly (the former
// src/components/{image-enlarge,mermaid-enlarge,ai-chat-modal} forks were
// redundant drift — identical shapes — and collided with the package islands
// once packageOwnedRoutes pulled the package chrome into the scan graph). The
// package components pin their own `displayName` internally, so no manual
// marker assignment is needed here. Mirrors the sibling zudo-doc showcase.
import { AiChatModal } from "@takazudo/zudo-doc/ai-chat-modal";
import { ImageEnlarge, ImageEnlargeSsrFallback } from "@takazudo/zudo-doc/image-enlarge";
import { MermaidEnlarge, MermaidEnlargeSsrFallback } from "@takazudo/zudo-doc/mermaid-enlarge";

import DesignTokenPanelBootstrap from "@/components/design-token-panel-bootstrap";
import PreviewTokenPanelBootstrap from "@/components/preview-token-panel-bootstrap";

// Set explicit `displayName` on each host-defined island so zfb's
// `captureComponentName` produces a stable marker even after the SSR
// pipeline runs the components through a function-name-rewriting layer.
// The marker must match the third-arg literal that zfb's scanner records
// for the same source-level identifier (zfb PR #150). esbuild preserves
// function names by default, but the explicit assignment is a
// belt-and-braces guard for production minification regressions.
(DesignTokenPanelBootstrap as { displayName?: string }).displayName = "DesignTokenPanelBootstrap";
(PreviewTokenPanelBootstrap as { displayName?: string }).displayName = "PreviewTokenPanelBootstrap";

/**
 * Default sr-only label rendered as the AiChatModal SSR fallback. This
 * mirrors the body-label string the deleted `AiChatModalIsland` wrapper
 * produced verbatim so assistive tech can discover the chat entrypoint
 * in the static HTML before JS hydration. English-only for now — the
 * previous default was also English-only; pass `aiChatBodyLabel` to
 * localise.
 */
const DEFAULT_AI_CHAT_BODY_LABEL = "Ask a question about the documentation.";

/** Props for {@link BodyEndIslands}. */
export interface BodyEndIslandsProps {
  /** Base path the AI chat modal uses to construct API URLs. */
  basePath: string;
  /**
   * Sr-only label rendered as the AiChatModal SSR fallback. Defaults to
   * the English string. Pass a locale-translated string for non-default
   * locales so screen readers announce the chat entrypoint correctly
   * before hydration.
   */
  aiChatBodyLabel?: string;
}

/**
 * The default body-end islands a doc page may mount: the AI chat modal
 * (`<dialog>` overlay) and the image-enlarge dialog (mounted lazily based
 * on viewport scan). Each is feature-gated — the AI chat modal (and its
 * sr-only landmark heading) on `settings.aiAssistant`, and image-enlarge
 * on `settings.imageEnlarge` — so a feature-off consumer ships neither the
 * island marker nor a misleading landmark (zudolab/zudo-doc#2058).
 *
 * Optional feature islands (e.g. the design token panel bootstrap) are not
 * listed here: they are injected at the body-end-islands composition
 * anchors only when their feature is selected, so a feature-off scaffold
 * carries no trace of them.
 *
 * Each island is wrapped in `<Island ssrFallback>` so the heavy
 * component is NOT evaluated server-side — they depend on
 * `dialog.showModal()`, `localStorage`, `ResizeObserver`, runtime
 * fetch, etc. The hydration runtime swaps each placeholder on the
 * client.
 *
 * When `settings.aiAssistant` is enabled, the
 * `<h2 class="sr-only">AI Assistant</h2>` heading is emitted in the SSG
 * output so screen readers and crawlers can discover the chat section
 * landmark before JS hydration.
 */
export function BodyEndIslands({
  basePath,
  aiChatBodyLabel = DEFAULT_AI_CHAT_BODY_LABEL,
}: BodyEndIslandsProps): JSX.Element {
  // Gated on `settings.aiAssistant` (zudolab/zudo-doc#2058): when the AI
  // assistant feature is off, neither the AiChatModal island marker nor the
  // sr-only "AI Assistant" landmark heading should reach the SSG output —
  // otherwise feature-off consumers ship a dead island marker plus a
  // misleading screen-reader landmark for a section that never hydrates.
  // Same feature-gating pattern as the other optional body-end islands.
  //
  // KNOWN CAVEAT: zfb's island scanner walks the static `"use client"`
  // import chain, so gating this JSX removes the SSR marker and heading but
  // may NOT strip the AiChatModal bundle from the build output. Marker
  // removal is the agreed first fix (#2058); bundle stripping is out of scope.
  //
  // The sr-only <p> fallback keeps the body label in static HTML for screen
  // readers before JS hydration; sr-only keeps it invisible to sighted users.
  const aiAssistant = settings.aiAssistant ? (
    <>
      {/* Emits the "AI Assistant" heading in the SSG output so screen
          readers can discover the chat section landmark before JS
          hydration. */}
      <h2 class="sr-only">AI Assistant</h2>
      {
        Island({
          ssrFallback: <p class="sr-only">{aiChatBodyLabel}</p>,
          children: <AiChatModal basePath={basePath} />,
        }) as unknown as VNode
      }
    </>
  ) : null;

  // Gated on `settings.imageEnlarge` (zudolab/zudo-doc#2058). Same caveat as
  // the AI assistant gating: removing this JSX drops the SSR dialog shell and
  // island marker, but the bundle may persist via the static import scan.
  //
  // Wave 11 (zudolab/zudo-doc#1355): the SSR fallback is the empty, closed
  // `<dialog class="zd-enlarge-dialog ...">` shell so the dist HTML carries
  // one dialog from the start. Without this the smoke "exactly one
  // zd-enlarge-dialog element" assertion sees zero (skip-ssr placeholders are
  // empty divs) and the no-JS path has no dialog at all. Hydration replaces
  // this shell with the real ImageEnlarge component when the page goes idle.
  const imageEnlarge = settings.imageEnlarge
    ? (Island({
        when: "idle",
        ssrFallback: <ImageEnlargeSsrFallback />,
        children: <ImageEnlarge />,
      }) as unknown as VNode)
    : null;

  // Gated on `settings.mermaid`. Mirrors the imageEnlarge block: the SSR
  // fallback is an empty, closed `<dialog class="zd-mermaid-dialog ...">` so
  // the dist HTML carries one dialog from the start and hydration (when="idle")
  // swaps in the real component. Unlike images (SSR-wrapped by the MDX paragraph
  // override), mermaid renders client-side, so this island injects the enlarge
  // button into each rendered diagram container itself.
  const mermaidEnlarge = settings.mermaid
    ? (Island({
        when: "idle",
        ssrFallback: <MermaidEnlargeSsrFallback />,
        children: <MermaidEnlarge />,
      }) as unknown as VNode)
    : null;

  return (
    <>
      {aiAssistant}
      {imageEnlarge}
      {mermaidEnlarge}

      {/* zdtp doc-chrome panel bootstrap: hydrates on load so configurePanel()
          runs early and the toggle-sg-doc-tweak listener is live before the user
          clicks the header Design Tokens icon. The inline script is the
          pre-hydration shim that queues the first click (zudolab/zudo-doc#1627
          Part B). Listens on "toggle-sg-doc-tweak" — the doc-chrome panel's
          explicit toggle channel — NOT the reserved "toggle-design-token-panel"
          (which zdtp 0.3.0 binds only to its empty default; see
          Takazudo/zudo-sg#84/#85). Guard names: __zdtpToggleShimInstalled /
          __zdtpReadyClicks.

          Re-verified against zdtp 0.4.3 (#117): this shim is NOT the "0.3.0
          default-instance" toggleEvent workaround (that one is the explicit
          `toggleEvent: "toggle-sg-doc-tweak"` choice in
          design-token-panel-config.ts, fixed upstream in 0.3.2 but still
          required here since two simultaneous instances still need distinct
          channels). This shim solves a SEPARATE, still-current problem: the
          `<Island when="load">` bootstrap below doesn't hydrate (and register
          zdtp's own toggle listener) until the window "load" event, so a click
          on the header icon before then would otherwise be lost. Kept as-is. */}
      <script
        dangerouslySetInnerHTML={{ __html: "(function(){\nif(window.__zdtpToggleShimInstalled)return;\nwindow.__zdtpToggleShimInstalled=true;\nvar pending=false;\nfunction shim(){pending=true;}\nwindow.addEventListener('toggle-sg-doc-tweak',shim);\nwindow.__zdtpReadyClicks=function(){\nwindow.removeEventListener('toggle-sg-doc-tweak',shim);\ndelete window.__zdtpReadyClicks;\nif(pending){pending=false;window.dispatchEvent(new CustomEvent('toggle-sg-doc-tweak'));}\n};\n})();" }}
      />
      {Island({
        when: "load",
        children: <DesignTokenPanelBootstrap />,
      }) as unknown as VNode}

      {/* zdtp preview panel bootstrap: hydrates on load so configurePanel() runs
          early for the 2nd (preview-iframe) instance. Guard names are DISTINCT
          from the doc-chrome panel (__zdtpPreviewToggleShimInstalled /
          __zdtpPreviewReadyClicks) so both panels hydrate independently without
          cross-talk. Listens on "toggle-preview-token-panel". Re-verified
          against zdtp 0.4.3 alongside the doc-chrome shim above (#117) — kept
          for the same pre-hydration click-queue reason. */}
      <script
        dangerouslySetInnerHTML={{ __html: "(function(){\nif(window.__zdtpPreviewToggleShimInstalled)return;\nwindow.__zdtpPreviewToggleShimInstalled=true;\nvar pending=false;\nfunction shim(){pending=true;}\nwindow.addEventListener('toggle-preview-token-panel',shim);\nwindow.__zdtpPreviewReadyClicks=function(){\nwindow.removeEventListener('toggle-preview-token-panel',shim);\ndelete window.__zdtpPreviewReadyClicks;\nif(pending){pending=false;window.dispatchEvent(new CustomEvent('toggle-preview-token-panel'));}\n};\n})();" }}
      />
      {Island({
        when: "load",
        children: <PreviewTokenPanelBootstrap />,
      }) as unknown as VNode}

      {/* SidebarResizerInit: attach drag handle to #desktop-sidebar on load.
          Idempotent — safe on every page, including styleguide routes that
          render this component directly (without the DocBodyEnd wrapper). On
          doc routes DocBodyEnd also emits this component, but the init
          script's idempotency guard makes repeated calls safe. */}
      {settings.sidebarResizer && <SidebarResizerInit />}
    </>
  );
}
