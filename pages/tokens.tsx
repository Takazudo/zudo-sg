/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { createTokenDashboards } from "@takazudo/zudo-sg/token-dashboard";
import { colorSchemes } from "@/config/color-schemes";
import { resolveRampRef } from "@/config/color-scheme-utils";
import { defaultLocale } from "@/config/i18n";
import { settings } from "@/config/settings";
import { uiDesignTokensManifest, uiTokenTabs } from "@/config/ui-token-tabs";
import { withBase } from "@/utils/base";
import { TOKENS_SLUG } from "@/styleguide/registry";
import { StyleguideLayout } from "@/features/styleguide/chrome/_styleguide-layout";
import PreviewTokensButton from "@/features/styleguide/token-tweak/preview-tokens-button";
import { composeMetaTitle } from "./lib/_compose-meta-title";
import { buildStyleguideChrome } from "./lib/_styleguide-chrome";

export const frontmatter = { title: "Design Tokens" };

/** Per-mode chrome colors for the declared-defaults dashboards, resolved
 * from this site's own color-scheme settings (host-specific; the package
 * never resolves this itself — see `createTokenDashboards`'s `chromeStyle`
 * option). */
function buildDashboardChromeStyle(): Record<string, string> {
  return Object.fromEntries(
    (["light", "dark"] as const).flatMap((mode) => {
      const schemeName = settings.colorMode
        ? settings.colorMode[`${mode}Scheme`]
        : settings.colorScheme;
      const scheme = colorSchemes[schemeName]!;
      return (["bg", "fg"] as const).map((role) => [
        `--zdtp-dashboard-${mode}-${role}`,
        resolveRampRef(scheme.map[role], scheme.ramps),
      ]);
    }),
  );
}

export default function TokensPage(): JSX.Element {
  const locale = defaultLocale;
  const currentPath = withBase("/tokens");
  const previewTokensButton = Island({
    when: "load",
    children: <PreviewTokensButton />,
  }) as unknown as VNode;
  const chrome = buildStyleguideChrome({
    lang: locale,
    pageTitle: "Design Tokens",
    currentPath,
    activeSlug: TOKENS_SLUG,
    hideSidebar: true,
  });

  return (
    <StyleguideLayout
      title={composeMetaTitle("Design Tokens")}
      activeSlug={TOKENS_SLUG}
      lang={locale}
      hideSidebar
      {...chrome}
    >
      <div>
        <header class="mb-vsp-lg max-w-[56rem]">
          <h1 class="text-heading font-bold mb-vsp-2xs">Design tokens</h1>
          <p class="mt-vsp-xs mb-vsp-sm text-muted">
            Declared defaults for <code>@zudo-sg/ui</code>, shown as light, dark,
            and shared token references. Open Preview tokens to edit the
            component previews; these reference dashboards stay unchanged.
          </p>
          {previewTokensButton}
        </header>
        {createTokenDashboards(uiDesignTokensManifest, uiTokenTabs, {
          chromeStyle: buildDashboardChromeStyle(),
        })}
      </div>
    </StyleguideLayout>
  );
}
