/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Declared-defaults reference and interactive design-token playground — `/components/tokens`.
//
// The swatch / spacing / type rows are SERVER-RENDERED (the full token
// reference is visible with no JS); a client island (TokenPlayground) layers
// the interactivity on top via event delegation:
//   - click any live token row to copy its RESOLVED value (hex / rem) or its
//     `var(--token)` reference (toggle in the toolbar). Because the swatches
//     are painted with `var(--…)`, they also restyle live from the header's
//     site-wide Design Tokens icon (doc-chrome panel) — no page-local trigger
//     for that panel lives here (#538).
//   - open the preview design-token panel (dispatches
//     `toggle-preview-token-panel`) to edit the `@zudo-sg/ui` tokens used by
//     component preview iframes elsewhere on the site.
//
// Token data: imports from ROOT `src/config/design-tokens-manifest.ts` (the
// superset) rather than the styleguide's own manifest. Color tokens come from
// `UI_COLOR_TOKENS` in `@/config/ui-design-tokens-manifest` — the generated
// manifest for `@zudo-sg/ui`'s semantic `--color-*` tokens (the root manifest
// has an empty COLOR_TOKENS array because color is cluster-driven there).
//
// See src/features/styleguide/token-tweak/token-playground.tsx for the
// SSR ↔ island contract (`data-sg-tokens-root`, `data-sg-token`, `data-var`).
//
// Layout: the band opts into zudo-doc's WIDE content layout (`contentWide` →
// `data-zd-wide`), which the swatch grids use in full — they are the reason
// this page asks for the wide band at all. This page used to pair that with a
// centred `mx-auto max-w-[64rem]` body wrapper, which cancelled most of the
// extra width AND re-centred the column, so the page sat inboard of
// `/components` and `/components/<slug>` rather than sharing their left edge.
// #545 settled the ambiguity in favour of keeping `contentWide` and dropping
// the cap, over the other reading (drop `contentWide`, keep a 64rem column):
// both siblings cap LEFT — `max-w-[56rem]`, no `mx-auto` — so the centred
// column was the outlier, not the intent. Prose keeps its own reading measure
// via that same left cap; a wide band must not mean 1150px-wide paragraphs.

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { defaultLocale } from "@/config/i18n";
import { withBase } from "@/utils/base";
import { TOKENS_SLUG } from "@/styleguide/data/registry";
import { StyleguideLayout } from "@/features/styleguide/chrome/_styleguide-layout";
import { UiTokenDashboards } from "@/features/styleguide/token-dashboard/ui-token-dashboards";
import TokenPlayground from "@/features/styleguide/token-tweak/token-playground";
import { SPACING_TOKENS, FONT_TOKENS } from "@/config/design-tokens-manifest";
import {
  UI_PALETTE_COLORS,
  UI_COLOR_TOKENS,
} from "@/config/ui-design-tokens-manifest";
import { composeMetaTitle } from "../lib/_compose-meta-title";
import { buildStyleguideChrome } from "../lib/_styleguide-chrome";

export const frontmatter = { title: "Design Tokens" };

// Palette swatches, grouped in the same tiers the preview token panel exposes.
type PaletteGroup = {
  id: string;
  label: string;
  tokens: Array<{ name: string; varName: string }>;
};

const PALETTE_GROUP_LABELS: Record<string, string> = {
  base: "Base",
  accent: "Accent",
  state: "State",
};

function paletteGroupOf(name: string): string {
  if (name.startsWith("state-")) return "state";
  const match = /^(.+)-\d+$/.exec(name);
  return match?.[1] ?? name;
}

const PALETTE_GROUPS: PaletteGroup[] = Array.from(
  UI_PALETTE_COLORS.reduce((groups, color) => {
    const group = paletteGroupOf(color.name);
    const tokens = groups.get(group) ?? [];
    tokens.push({
      name: color.name,
      varName: `--palette-${color.name}`,
    });
    groups.set(group, tokens);
    return groups;
  }, new Map<string, Array<{ name: string; varName: string }>>()),
  ([id, tokens]) => ({
    id,
    label: PALETTE_GROUP_LABELS[id] ?? id,
    tokens,
  }),
);

// Semantic swatch grid rows, derived from UI_COLOR_TOKENS (generated from
// packages/ui/styles/colors.css — see src/config/ui-design-tokens-manifest.ts).
// `label` is always "color-<name>"; strip the prefix for the short swatch name.
const COLOR_TOKENS: Array<{ name: string; varName: string }> = UI_COLOR_TOKENS.map(
  (tok) => ({
    name: tok.label.replace(/^color-/, ""),
    varName: tok.cssVar,
  }),
);

export default function TokensPage(): JSX.Element {
  const locale = defaultLocale;
  const currentPath = withBase("/components/tokens");

  const playground = Island({
    when: "load",
    children: <TokenPlayground />,
  }) as unknown as VNode;

  const chrome = buildStyleguideChrome({
    lang: locale,
    pageTitle: "Design Tokens",
    currentPath,
    activeSlug: TOKENS_SLUG,
  });

  return (
    <StyleguideLayout
      title={composeMetaTitle("Design Tokens")}
      activeSlug={TOKENS_SLUG}
      lang={locale}
      contentWide
      {...chrome}
    >
      {/* One wrapper keeps `.zd-content`'s flow spacing (DocLayout renders
          children inside `<article class="zd-content">`, which margins every
          direct child) out of the page's own vertical rhythm; the blocks below
          own their spacing explicitly. Class-less on purpose — see above. */}
      <div>
        <header class="mb-vsp-lg max-w-[56rem]">
          <h1 class="text-heading font-bold mb-vsp-2xs">Design tokens</h1>
          <p class="mt-vsp-xs text-muted">
            Two views of design tokens: <strong>Declared defaults</strong> is a
            static reference for <code>@zudo-sg/ui</code>; <strong>Live values</strong>{" "}
            offers click-to-copy values resolved from this page. Use the live
            toolbar to choose a resolved value or a <code>var(--token)</code>{" "}
            reference, or open Preview tokens to edit the component previews.
          </p>
        </header>

        <UiTokenDashboards />

        <section>
          <h2 class="mb-vsp-2xs text-xl font-semibold text-fg">
            Live values (host cascade)
          </h2>
          <p class="mb-vsp-sm max-w-[56rem] text-muted">
            In resolved-value mode, each row copies the value this document’s{" "}
            <code>:root</code> resolves at click time, following the header’s
            Design Tokens panel and the site theme. Palette and Semantic color
            show the <code>@zudo-sg/ui</code> colour variables as this host
            resolves them. Spacing and Type scale list the host chrome’s scale
            from the root manifest (including <code>--text-body</code> aliases),
            separate from the UI defaults above.
          </p>
          {playground}

          <div data-sg-tokens-root>
            <section class="mb-vsp-xl">
              <h3 class="mb-vsp-2xs text-lg font-semibold text-fg">Palette</h3>
              <p class="mb-vsp-sm max-w-[56rem] text-small text-muted">
                Raw grouped swatches that feed the semantic component tokens.
              </p>
              <div class="flex flex-col gap-vsp-md">
                {PALETTE_GROUPS.map((group) => (
                  <div>
                    <h4 class="mb-vsp-2xs text-small font-semibold text-fg">
                      {group.label}
                    </h4>
                    <div class="grid grid-cols-2 gap-hsp-md sm:grid-cols-3 lg:grid-cols-4">
                      {group.tokens.map((tok) => (
                        <button
                          type="button"
                          class="sg-token-card"
                          data-sg-token
                          data-var={tok.varName}
                          data-kind="color"
                          title={`Click to copy ${tok.varName}`}
                        >
                          <span
                            class="sg-token-swatch"
                            style={{ background: `var(${tok.varName})` }}
                          />
                          <span class="sg-token-card-meta">
                            <span class="text-small font-medium text-fg">
                              {tok.name}
                            </span>
                            <span class="text-xs text-muted">{tok.varName}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section class="mb-vsp-xl">
              <h3 class="mb-vsp-2xs text-lg font-semibold text-fg">
                Semantic color
              </h3>
              <p class="mb-vsp-sm max-w-[56rem] text-small text-muted">
                Public color tokens consumed by components.
              </p>
              <div class="grid grid-cols-2 gap-hsp-md sm:grid-cols-3 lg:grid-cols-4">
                {COLOR_TOKENS.map((tok) => (
                  <button
                    type="button"
                    class="sg-token-card"
                    data-sg-token
                    data-var={tok.varName}
                    data-kind="color"
                    title={`Click to copy ${tok.varName}`}
                  >
                    <span
                      class="sg-token-swatch"
                      style={{ background: `var(${tok.varName})` }}
                    />
                    <span class="sg-token-card-meta">
                      <span class="text-small font-medium text-fg">
                        {tok.name}
                      </span>
                      <span class="text-xs text-muted">{tok.varName}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section class="mb-vsp-xl">
              <h3 class="mb-vsp-sm text-lg font-semibold text-fg">Spacing</h3>
              <div class="flex flex-col gap-vsp-2xs">
                {SPACING_TOKENS.filter(
                  (t) => t.group === "hsp" || t.group === "vsp",
                ).map((tok) => (
                  <button
                    type="button"
                    class="sg-token-row"
                    data-sg-token
                    data-var={tok.cssVar}
                    data-kind="length"
                    title={`Click to copy ${tok.cssVar}`}
                  >
                    <span class="w-[6rem] shrink-0 text-left text-small text-fg">
                      {tok.label}
                    </span>
                    <span class="w-[5rem] shrink-0 text-left text-xs text-muted">
                      {tok.default}
                    </span>
                    {/* Magnitude bar — decorative-by-repetition (one per row), so
                        it defaults to neutral under the styleguide accent budget
                        rather than spending accent on a repeated decoration. */}
                    <span
                      class="h-[0.75rem] rounded-sm bg-muted"
                      style={{ width: `var(${tok.cssVar})` }}
                    />
                  </button>
                ))}
              </div>
            </section>

            <section class="mb-vsp-xl">
              <h3 class="mb-vsp-sm text-lg font-semibold text-fg">Type scale</h3>
              <div class="flex flex-col gap-vsp-sm">
                {FONT_TOKENS.filter((t) => t.group === "font-size").map((tok) => (
                  <button
                    type="button"
                    class="sg-token-row sg-token-row--baseline"
                    data-sg-token
                    data-var={tok.cssVar}
                    data-kind="length"
                    title={`Click to copy ${tok.cssVar}`}
                  >
                    <span class="w-[6rem] shrink-0 text-left text-xs text-muted">
                      {tok.label}
                    </span>
                    <span
                      class="text-left text-fg"
                      style={{ fontSize: `var(${tok.cssVar})` }}
                    >
                      The quick brown fox
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </StyleguideLayout>
  );
}
