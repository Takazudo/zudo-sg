/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Injected at `sgContext.routes.tokens` — the declared-defaults design-token
// dashboards. The manifest arrives through `virtual:zudo-sg-tokens` (routes
// plugin `tokensManifestModule` = `zudo-sg.config.mjs` `tokens.manifestOut`);
// without one the page renders its header only.

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { resolveRampRef } from "@takazudo/zudo-doc/color-scheme-utils";
import { tokensManifest } from "virtual:zudo-sg-tokens";
import { StyleguideLayout } from "../chrome/index.js";
import { TOKENS_SLUG } from "../registry/index.js";
import { buildUiTokenTabs, createTokenDashboards } from "../token-dashboard/index.js";
import PreviewTokensButton from "../token-tweak/preview-tokens-button.js";
import { chromeProps, routeCtx, settings } from "./_chrome.js";
import { ctx } from "./_context.js";

export const frontmatter = { title: "Design Tokens" };

/**
 * Per-mode dashboard chrome colors resolved from the site's zudo-doc color
 * schemes (`--zdtp-dashboard-{light,dark}-{bg,fg}`); `undefined` when the
 * host passed no `colorSchemes` to the zudo-doc preset.
 */
function buildDashboardChromeStyle(): Record<string, string> | undefined {
  const schemes = routeCtx.colorSchemes;
  if (!schemes) return undefined;
  const entries: Array<[string, string]> = [];
  for (const mode of ["light", "dark"] as const) {
    const schemeName = settings.colorMode ? settings.colorMode[`${mode}Scheme`] : settings.colorScheme;
    const scheme = schemes[schemeName];
    if (!scheme) return undefined;
    for (const role of ["bg", "fg"] as const) {
      entries.push([`--zdtp-dashboard-${mode}-${role}`, resolveRampRef(scheme.map[role], scheme.ramps)]);
    }
  }
  return Object.fromEntries(entries);
}

export default function TokensRoute(): JSX.Element {
  const previewTokensButton = Island({
    when: "load",
    children: <PreviewTokensButton />,
  }) as unknown as VNode;

  return (
    <StyleguideLayout
      {...chromeProps({ pageTitle: "Design Tokens", path: ctx.routes.tokens })}
      activeSlug={TOKENS_SLUG}
      hideSidebar
    >
      <div>
        <header class="mb-vsp-lg max-w-[56rem]">
          <h1 class="text-heading font-bold mb-vsp-2xs">Design tokens</h1>
          <p class="mt-vsp-xs mb-vsp-sm text-muted">
            Declared defaults{ctx.uiPackageName ? <> for <code>{ctx.uiPackageName}</code></> : null}, shown as
            light, dark, and shared token references. Open Preview tokens to edit the component previews; these
            reference dashboards stay unchanged.
          </p>
          {previewTokensButton}
        </header>
        {tokensManifest
          ? createTokenDashboards(tokensManifest, buildUiTokenTabs(tokensManifest), {
              chromeStyle: buildDashboardChromeStyle(),
            })
          : null}
      </div>
    </StyleguideLayout>
  );
}
