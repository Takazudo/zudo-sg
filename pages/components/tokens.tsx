/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Interactive design-token playground — `/components/tokens`.
//
// The swatch / spacing / type rows are SERVER-RENDERED (the full token
// reference is visible with no JS); a client island (TokenPlayground) layers
// the interactivity on top via event delegation:
//   - click any token to copy its RESOLVED value (hex / rem) or its
//     `var(--token)` reference (toggle in the toolbar),
//   - open the existing zdtp tweaker (dispatches `toggle-my-doc-tweak`, the
//     doc-chrome panel's explicit toggle channel) to edit tokens live — because
//     the swatches are painted with `var(--…)`, edits there restyle this page in
//     real time.
//
// Token data: imports from ROOT `src/config/design-tokens-manifest.ts` (the
// superset) rather than the styleguide's own manifest. Color tokens come from
// `UI_COLOR_TOKENS` in `@/config/ui-design-tokens-manifest` — the generated
// manifest for `@zudo-sg/ui`'s semantic `--color-*` tokens (the root manifest
// has an empty COLOR_TOKENS array because color is cluster-driven there).
//
// See src/features/styleguide/token-tweak/token-playground.tsx for the
// SSR ↔ island contract (`data-sg-tokens-root`, `data-sg-token`, `data-var`).

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { defaultLocale } from "@/config/i18n";
import { withBase } from "@/utils/base";
import { TOKENS_SLUG } from "@/styleguide/data/registry";
import { StyleguideLayout } from "@/features/styleguide/chrome/_styleguide-layout";
import TokenPlayground from "@/features/styleguide/token-tweak/token-playground";
import { SPACING_TOKENS, FONT_TOKENS } from "@/config/design-tokens-manifest";
import { UI_COLOR_TOKENS } from "@/config/ui-design-tokens-manifest";
import { composeMetaTitle } from "../lib/_compose-meta-title";
import { buildStyleguideChrome } from "../lib/_styleguide-chrome";

export const frontmatter = { title: "Design Tokens" };

// Swatch grid rows, derived from UI_COLOR_TOKENS (generated from
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
      {...chrome}
    >
      <div class="mx-auto max-w-[64rem]">
        <header class="mb-vsp-lg">
          <h1 class="text-heading font-bold mb-vsp-2xs">Design tokens</h1>
          <p class="mt-vsp-xs text-ink-soft">
            The semantic tokens the <code>@zudo-sg/ui</code> components consume.
            <strong> Click any token</strong> to copy it; use the toolbar to
            pick whether you copy the resolved value or the{" "}
            <code>var(--token)</code> reference, or open the tweaker to edit
            tokens live.
          </p>
        </header>

        {playground}

        <div data-sg-tokens-root>
          <section class="mb-vsp-xl">
            <h2 class="mb-vsp-sm text-lg font-semibold text-ink">Color</h2>
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
                    <span class="text-small font-medium text-ink">
                      {tok.name}
                    </span>
                    <span class="text-xs text-ink-mute">{tok.varName}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section class="mb-vsp-xl">
            <h2 class="mb-vsp-sm text-lg font-semibold text-ink">Spacing</h2>
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
                  <span class="w-[6rem] shrink-0 text-left text-small text-ink">
                    {tok.label}
                  </span>
                  <span class="w-[5rem] shrink-0 text-left text-xs text-ink-mute">
                    {tok.default}
                  </span>
                  <span
                    class="h-[0.75rem] rounded-sm bg-brand"
                    style={{ width: `var(${tok.cssVar})` }}
                  />
                </button>
              ))}
            </div>
          </section>

          <section class="mb-vsp-xl">
            <h2 class="mb-vsp-sm text-lg font-semibold text-ink">Type scale</h2>
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
                  <span class="w-[6rem] shrink-0 text-left text-xs text-ink-mute">
                    {tok.label}
                  </span>
                  <span
                    class="text-left text-ink"
                    style={{ fontSize: `var(${tok.cssVar})` }}
                  >
                    The quick brown fox
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </StyleguideLayout>
  );
}
