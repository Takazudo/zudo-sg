/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The styleguide's own 3-region document shell (header + sidebar + main +
// optional right code panel). Distinct from the docs DocLayout — the catalog is
// a separate surface. Renders a full <html> document; zfb auto-injects the main
// CSS <link> and the island runtime <script>.
//
// The design-token tweaker is wired in via the host's existing
// DesignTokenPanelBootstrap island (mounted in the body end here), so the
// "Tokens" header button opens the same zdtp panel the docs site uses, and the
// preview-iframe-registry pushes its tweaks into the previews.

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { settings } from "@/config/settings";
import { withBase } from "@/utils/base";
import { HeadWithDefaults } from "../../../pages/lib/_head-with-defaults";
import { composeMetaTitle } from "../../../pages/lib/_compose-meta-title";
import DesignTokenPanelBootstrap from "@/components/design-token-panel-bootstrap";
import { SidebarNav } from "./sidebar-nav";
import SgHeaderToggles from "./header-toggles";
import {
  PanelStateHeadScript,
  PanelResizersInitScript,
} from "./panel-scripts";

(DesignTokenPanelBootstrap as { displayName?: string }).displayName =
  "DesignTokenPanelBootstrap";

export interface StyleguideLayoutProps {
  title: string;
  /** Active story slug (detail pages). */
  activeSlug?: string;
  /** True on the tokens route. */
  tokensActive?: boolean;
  /** Right-region code panel content (detail pages only). */
  codePanel?: VNode | null;
  children: JSX.Element | JSX.Element[];
}

export function StyleguideLayout({
  title,
  activeSlug,
  tokensActive,
  codePanel,
  children,
}: StyleguideLayoutProps): JSX.Element {
  const tokenBootstrap = Island({
    when: "load",
    children: <DesignTokenPanelBootstrap />,
  }) as unknown as VNode;

  const headerToggles = Island({
    when: "load",
    children: <SgHeaderToggles showCodePanel={Boolean(codePanel)} />,
  }) as unknown as VNode;

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{composeMetaTitle(title)}</title>
        <HeadWithDefaults title={title} />
        <PanelStateHeadScript />
      </head>
      <body>
        <div class="sg-shell">
          <header class="sg-header">
            <a href={withBase("/sg")} class="font-semibold text-ink">
              {settings.siteName} — Styleguide
            </a>
            <div class="ml-auto">{headerToggles}</div>
          </header>

          <div class="sg-body">
            <SidebarNav activeSlug={activeSlug} tokensActive={tokensActive} />

            <main class="sg-main">{children}</main>

            {codePanel && (
              <aside class="sg-code-panel" id="sg-code-panel" aria-label="Code panel">
                <div
                  class="sg-resizer"
                  data-sg-resizer="code"
                  aria-hidden="true"
                />
                {codePanel}
              </aside>
            )}
          </div>
        </div>

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
        <PanelResizersInitScript />
      </body>
    </html>
  );
}
