/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The styleguide's page shell — rendered THROUGH zudo-doc's DocLayout via
// `DocLayoutWithDefaults` slot overrides, NOT a bespoke <html> document. This
// makes the styleguide a zudo-doc HOST that shares the docs chrome contract
// (the same 3-region shell, the same sidebar-resizer + theme-toggle physics)
// instead of reinventing it.
//
// Slot wiring (DocLayoutWithDefaults):
//   headerOverride  → catalog header: brand link + Tokens/Components nav +
//                     sidebar/code/token toggle island + ThemeToggle island.
//   sidebarOverride → the story-category tree (<SidebarNav>), filling
//                     DocLayout's `#desktop-sidebar` aside.
//   tocOverride     → the right-region CodeMirror code panel (detail pages),
//                     wrapped with a drag-resizer handle. `<></>` when absent.
//   footerOverride  → `<></>` (the styleguide has no footer).
//   head            → HeadWithDefaults (ColorSchemeProvider + meta) plus the
//                     panel-state restore script, DocLayout's SidebarResizerInit
//                     (sidebar drag), and the code-panel resizer init.
//
// The design-token tweaker is wired in via the host's DesignTokenPanelBootstrap
// island (mounted in bodyEndComponents), so the header "Tokens" button opens the
// same zdtp panel the docs site uses, and the preview-iframe-registry pushes its
// tweaks into the previews.

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { DocLayoutWithDefaults } from "@takazudo/zudo-doc/doclayout";
import {
  SidebarResizerInit,
  SidebarResizerRestore,
} from "@takazudo/zudo-doc/sidebar-resizer";
import { ThemeToggle } from "@takazudo/zudo-doc/theme-toggle";
import { settings } from "@/config/settings";
import { withBase } from "@/utils/base";
import { composeMetaTitle } from "@/lib/compose-meta-title";
import { HeadWithDefaults } from "@/lib/head-with-defaults";
import DesignTokenPanelBootstrap from "@/components/design-token-panel-bootstrap";
import { SidebarNav } from "./sidebar-nav";
import SgHeaderToggles from "./header-toggles";
import { PanelStateHeadScript, PanelResizersInitScript } from "./panel-scripts";
import { ActiveSlugSyncScript } from "./active-slug-sync";

(DesignTokenPanelBootstrap as { displayName?: string }).displayName =
  "DesignTokenPanelBootstrap";

export interface StyleguideLayoutProps {
  title: string;
  /** Active story slug (detail pages) — highlighted in the sidebar tree. */
  activeSlug?: string;
  /** True on the tokens route — highlights the Design Tokens nav link. */
  tokensActive?: boolean;
  /** Right-region code panel content (detail pages only). */
  codePanel?: VNode | null;
  children: JSX.Element | JSX.Element[];
}

/** Catalog header shell (passed as `headerOverride`). */
function StyleguideHeader({
  tokensActive,
  showCodePanel,
}: {
  tokensActive?: boolean;
  showCodePanel: boolean;
}): JSX.Element {
  // `Island()` returns zfb's deliberately-opaque `IslandElement` shape, which
  // isn't structurally assignable to Preact's `VNode`. The `as unknown as
  // VNode` launder at this boundary is the codebase-wide idiom for rendering an
  // Island result as a Preact child.
  const headerToggles = Island({
    when: "load",
    children: <SgHeaderToggles showCodePanel={showCodePanel} />,
  }) as unknown as VNode;

  // The bare package ThemeToggle composed into its own Island so its
  // data-zfb-island marker hydrates (the package export is non-island-wrapped;
  // composing the Island here avoids nesting an island inside an island).
  const themeToggle = Island({
    when: "load",
    children: (
      <ThemeToggle
        defaultMode={settings.colorMode ? settings.colorMode.defaultMode : undefined}
      />
    ),
  }) as unknown as VNode;

  return (
    <header class="sg-header">
      <a href={withBase("/")} class="font-semibold text-ink no-underline">
        {settings.siteName}
      </a>

      <nav class="sg-header-nav" aria-label="Site sections">
        <a
          href={withBase("/tokens")}
          class="sg-nav-link"
          aria-current={tokensActive ? "page" : undefined}
        >
          Tokens
        </a>
        <a href={withBase("/")} class="sg-nav-link">
          Components
        </a>
      </nav>

      <div class="ml-auto flex items-center gap-hsp-md">
        {headerToggles}
        {settings.colorMode && themeToggle}
      </div>
    </header>
  );
}

export function StyleguideLayout({
  title,
  activeSlug,
  tokensActive,
  codePanel,
  children,
}: StyleguideLayoutProps): JSX.Element {
  const showCodePanel = Boolean(codePanel);

  const tokenBootstrap = Island({
    when: "load",
    children: <DesignTokenPanelBootstrap />,
  }) as unknown as VNode;

  // The right-region (DocLayout's TOC slot) hosts the code panel on detail
  // pages. When there is no code panel the slot is an empty fragment so the
  // content band fills the freed width.
  const tocOverride: VNode = showCodePanel ? (
    <aside class="sg-code-panel" id="sg-code-panel" aria-label="Code panel">
      <div class="sg-resizer" data-sg-code-panel-resizer aria-hidden="true" />
      {codePanel}
    </aside>
  ) : (
    <></>
  );

  return (
    <DocLayoutWithDefaults
      title={composeMetaTitle(title)}
      hideToc={!showCodePanel}
      lang="en"
      head={
        <>
          <HeadWithDefaults title={title} />
          {/* Pre-paint restore of the persisted sidebar width to
              `--zd-sidebar-w` (reads `zudo-doc-sidebar-width`) so a reload
              after drag-resizing doesn't snap back to the CSS default. */}
          <SidebarResizerRestore />
          <PanelStateHeadScript />
          {/* DocLayout owns the desktop sidebar; SidebarResizerInit attaches
              its drag handle to `#desktop-sidebar` and persists the width to
              `--zd-sidebar-w` / `zudo-doc-sidebar-width` (the same names our
              panel-contract reuses). */}
          <SidebarResizerInit />
          <PanelResizersInitScript />
        </>
      }
      headerOverride={
        <StyleguideHeader
          tokensActive={tokensActive}
          showCodePanel={showCodePanel}
        />
      }
      sidebarOverride={
        <SidebarNav activeSlug={activeSlug} tokensActive={tokensActive} />
      }
      tocOverride={tocOverride}
      footerOverride={<></>}
      bodyEndComponents={
        <>
          {tokenBootstrap}
          {/* Pre-hydration shim so an early "Tokens" click is queued until the
              zdtp bootstrap island registers its listener (mirrors the host's
              _body-end-islands shim). */}
          <script
            dangerouslySetInnerHTML={{
              __html:
                "(function(){if(window.__zdtpToggleShimInstalled)return;window.__zdtpToggleShimInstalled=true;var p=false;function s(){p=true;}window.addEventListener('toggle-design-token-panel',s);window.__zdtpReadyClicks=function(){window.removeEventListener('toggle-design-token-panel',s);delete window.__zdtpReadyClicks;if(p){p=false;window.dispatchEvent(new CustomEvent('toggle-design-token-panel'));}};})();",
            }}
          />
          <ActiveSlugSyncScript />
        </>
      }
    >
      {children}
    </DocLayoutWithDefaults>
  );
}
