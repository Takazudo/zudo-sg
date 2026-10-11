// Static server boundary: real client imports keep every Island target visible
// to zfb's scanner, including the engine preview panel on package-owned routes.

import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { Island } from "@takazudo/zfb";
import { settings } from "@/config/settings";
import { SidebarResizerInit } from "@takazudo/zudo-doc/sidebar-resizer";
import { PageLoadingOverlay } from "@takazudo/zudo-doc/page-loading";
import { AFTER_NAVIGATE_EVENT, BEFORE_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";

// #113: adopt the package enlarge/ai-chat islands directly (the former
// src/components/{image-enlarge,mermaid-enlarge,ai-chat-modal} forks were
// redundant drift — identical shapes — and collided with the package islands
// once packageOwnedRoutes pulled the package chrome into the scan graph). The
// package components pin their own `displayName` internally, so no manual
// marker assignment is needed here. Mirrors the sibling zudo-doc showcase.
import { AiChatModal } from "@takazudo/zudo-doc/ai-chat-modal";
import { ImageEnlarge, ImageEnlargeSsrFallback } from "@takazudo/zudo-doc/image-enlarge";
import { MermaidEnlarge, MermaidEnlargeSsrFallback } from "@takazudo/zudo-doc/mermaid-enlarge";

import ClientRouterBootstrap from "@/components/client-router-bootstrap";
import PreviewTokenPanelBootstrap from "@takazudo/zudo-sg/token-tweak/preview-token-panel-bootstrap";
import { previewTokenPanelCaptureScript } from "@takazudo/zudo-sg/token-tweak";

/**
 * Default sr-only label rendered as the AiChatModal SSR fallback. This
 * mirrors the body-label string the deleted `AiChatModalIsland` wrapper
 * produced verbatim so assistive tech can discover the chat entrypoint
 * in the static HTML before JS hydration. English-only for now — the
 * previous default was also English-only; pass `aiChatBodyLabel` to
 * localise.
 */
const DEFAULT_AI_CHAT_BODY_LABEL = "Ask a question about the documentation.";

const SIDEBAR_SCROLL_RESTORE_SCRIPT = `(${function sidebarScrollRestore(
  beforeEvent: string,
  afterEvent: string,
) {
  const w = window as Window & { __zdSidebarScrollRestoreInstalled?: boolean };
  if (w.__zdSidebarScrollRestoreInstalled) return;
  w.__zdSidebarScrollRestoreInstalled = true;

  let savedScrollTop = 0;
  let restoreTimer: ReturnType<typeof setTimeout> | undefined;
  const sidebar = () => document.querySelector<HTMLElement>("#desktop-sidebar");

  document.addEventListener(beforeEvent, () => {
    if (restoreTimer !== undefined) {
      clearTimeout(restoreTimer);
      restoreTimer = undefined;
    }
    savedScrollTop = sidebar()?.scrollTop ?? 0;
  });

  document.addEventListener(afterEvent, () => {
    restoreTimer = setTimeout(() => {
      restoreTimer = undefined;
      const aside = sidebar();
      if (aside) aside.scrollTop = savedScrollTop;
    }, 50);
  });
}.toString()})(${JSON.stringify(BEFORE_NAVIGATE_EVENT)},${JSON.stringify(AFTER_NAVIGATE_EVENT)});`;

/** Props for {@link BodyEndIslands}. */
export interface BodyEndIslandsProps {
  /** Base path the AI chat modal uses to construct API URLs. */
  basePath: string;
  /** Asset image pages must mount enlarge even when the site setting is off. */
  forceImageEnlarge?: boolean;
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
  forceImageEnlarge = false,
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
      <Island when="load" ssrFallback={<p class="sr-only">{aiChatBodyLabel}</p>}>
        <AiChatModal basePath={basePath} />
      </Island>
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
  const imageEnlarge = settings.imageEnlarge || forceImageEnlarge
    ? (<Island when="idle" ssrFallback={<ImageEnlargeSsrFallback />}><ImageEnlarge /></Island>)
    : null;

  // Gated on `settings.mermaid`. Mirrors the imageEnlarge block: the SSR
  // fallback is an empty, closed `<dialog class="zd-mermaid-dialog ...">` so
  // the dist HTML carries one dialog from the start and hydration (when="idle")
  // swaps in the real component. Unlike images (SSR-wrapped by the MDX paragraph
  // override), mermaid renders client-side, so this island injects the enlarge
  // button into each rendered diagram container itself.
  const mermaidEnlarge = settings.mermaid
    ? (<Island when="idle" ssrFallback={<MermaidEnlargeSsrFallback />}><MermaidEnlarge /></Island>)
    : null;

  return (
    <>
      {settings.dynamicPageTransition ? (
        <>
          <PageLoadingOverlay />
          <script rawHtml={SIDEBAR_SCROLL_RESTORE_SCRIPT} />
          <Island when="load"><ClientRouterBootstrap /></Island>
        </>
      ) : null}
      {aiAssistant}
      {imageEnlarge}
      {mermaidEnlarge}

      {/* Package-owned capture is also installed by the public header trigger.
          This mount covers host-supplied triggers and runs before the island. */}
      <script
        rawHtml={previewTokenPanelCaptureScript()}
      />
      <Island when="load"><PreviewTokenPanelBootstrap /></Island>

      {/* SidebarResizerInit: attach drag handle to #desktop-sidebar on load.
          Idempotent — safe on every page, including styleguide routes that
          render this component directly (without the DocBodyEnd wrapper). On
          doc routes DocBodyEnd also emits this component, but the init
          script's idempotency guard makes repeated calls safe. */}
      {settings.sidebarResizer && <SidebarResizerInit />}
    </>
  );
}
