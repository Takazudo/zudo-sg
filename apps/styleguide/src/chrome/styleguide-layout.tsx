/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The styleguide's page shell — rendered THROUGH zudo-doc's DocLayout via
// `DocLayoutWithDefaults` slot overrides, NOT a bespoke <html> document. This
// makes the styleguide a zudo-doc HOST that shares the docs chrome contract
// (the same 3-region shell, the same sidebar-resizer + theme-toggle physics)
// instead of reinventing it.
//
// Slot wiring (DocLayoutWithDefaults):
//   headerOverride  → catalog header (native token styling): mobile sidebar
//                     drawer island + brand link + Tokens/Components nav tabs +
//                     sidebar/code/token toggle island + ThemeToggle island.
//   sidebarOverride → the native interactive tree (<Sidebar> → SidebarTree
//                     island), filling DocLayout's `#desktop-sidebar` aside.
//   tocOverride     → the right-region CodeMirror code panel (detail pages),
//                     a native-token-framed `#sg-code-panel` with a drag-resizer
//                     handle. `<></>` when absent.
//   footerOverride  → `<></>` (the styleguide has no footer).
//   head            → HeadWithDefaults (ColorSchemeProvider + meta) plus the
//                     panel-state restore script, DocLayout's SidebarResizerInit
//                     (sidebar drag), and the code-panel resizer init.
//
// The desktop SidebarTree and the mobile drawer's SidebarTree consume the SAME
// `navNodes` array (src/data/nav-nodes.ts). The active-item highlight is owned
// by the vendored tree's `useActiveSlug` (which listens to AFTER_NAVIGATE_EVENT
// for soft-nav) — there is no separate active-slug-sync script.
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
import { Sidebar } from "./sidebar";
import { MobileSidebar } from "./mobile-sidebar";
import SgHeaderToggles from "./header-toggles";
import { PanelStateHeadScript, PanelResizersInitScript } from "./panel-scripts";

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
  currentSlug,
}: {
  tokensActive?: boolean;
  showCodePanel: boolean;
  /** Active story slug — forwarded to the mobile sidebar drawer's tree. */
  currentSlug?: string;
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

  // Native nav-tab styling: active tab inverts to `bg-fg text-bg`, inactive is
  // muted and brightens on hover — mirrors the docs/native header tabs.
  const navTabBase =
    "inline-flex items-center px-hsp-sm py-vsp-3xs rounded text-small transition-colors";
  const navTabActive = `${navTabBase} bg-fg text-bg`;
  const navTabInactive = `${navTabBase} text-muted hover:text-fg`;

  // Mobile sidebar drawer (hamburger + slide-in tree) — visible below `lg`,
  // where DocLayout hides the desktop sidebar. Fed the same nav nodes.
  const mobileSidebar = MobileSidebar({ currentSlug });

  return (
    <header class="flex items-center gap-hsp-md px-hsp-xl h-[var(--sg-header-h)] border-b border-muted bg-surface sticky top-0 z-toolbar">
      {mobileSidebar}

      <a href={withBase("/")} class="font-semibold text-fg no-underline">
        {settings.siteName}
      </a>

      <nav class="flex items-center gap-hsp-2xs" aria-label="Site sections">
        <a
          href={withBase("/tokens")}
          class={tokensActive ? navTabActive : navTabInactive}
          aria-current={tokensActive ? "page" : undefined}
        >
          Tokens
        </a>
        <a href={withBase("/")} class={navTabInactive}>
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

  // The single active-slug value driving the native tree's `currentSlug`
  // highlight: the tokens route highlights the "tokens" leaf, a story route
  // highlights its slug, and the catalog landing (no activeSlug) highlights the
  // "" (Overview) leaf. The runtime `useActiveSlug` re-derives this from the URL
  // on soft-nav, so this is just the initial SSR value.
  const treeSlug = tokensActive ? "tokens" : activeSlug ?? "";

  const tokenBootstrap = Island({
    when: "load",
    children: <DesignTokenPanelBootstrap />,
  }) as unknown as VNode;

  // The right-region (DocLayout's TOC slot) hosts the code panel on detail
  // pages. When there is no code panel the slot is an empty fragment so the
  // content band fills the freed width.
  //
  // Native token frame: `border-l border-muted bg-surface` (matching the docs
  // chrome's bordered surfaces). The structural behavior (width / sticky offset
  // under `--sg-header-h` / responsive stacking / `data-sg-code-panel-hidden`
  // visibility) stays in global.css keyed on the `#sg-code-panel` id. The
  // resizer is a thin `cursor-col-resize` handle, targeted by its data-attr for
  // both the drag wiring (panel-scripts.tsx) and its hover-tint styling.
  const tocOverride: VNode = showCodePanel ? (
    <aside
      class="border-l border-muted bg-surface"
      id="sg-code-panel"
      aria-label="Code panel"
    >
      <div data-sg-code-panel-resizer aria-hidden="true" />
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
          currentSlug={treeSlug}
        />
      }
      sidebarOverride={<Sidebar currentSlug={treeSlug} />}
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
        </>
      }
    >
      {children}
    </DocLayoutWithDefaults>
  );
}
