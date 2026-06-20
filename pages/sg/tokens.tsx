/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Design-token reference (`/sg/tokens`). Static SSR reference of the
// @zudo-sg/ui semantic color tokens plus the shared spacing + font scales.
// (The interactive token playground is S7; this is the read-only reference.)

import type { JSX } from "preact";
import { StyleguideLayout } from "@/styleguide/chrome/styleguide-layout";
import { SPACING_TOKENS, FONT_TOKENS } from "@/config/design-tokens-manifest";

export const frontmatter = { title: "Design Tokens" };

// The @zudo-sg/ui semantic color tokens (from packages/ui/styles/colors.css).
// Listed here for the swatch grid; each `var` resolves via the imported tokens.
const COLOR_TOKENS: Array<{ name: string; varName: string }> = [
  { name: "ink", varName: "--color-ink" },
  { name: "ink-soft", varName: "--color-ink-soft" },
  { name: "ink-mute", varName: "--color-ink-mute" },
  { name: "on-brand", varName: "--color-on-brand" },
  { name: "paper", varName: "--color-paper" },
  { name: "surface", varName: "--color-surface" },
  { name: "surface-sunken", varName: "--color-surface-sunken" },
  { name: "line", varName: "--color-line" },
  { name: "line-strong", varName: "--color-line-strong" },
  { name: "brand", varName: "--color-brand" },
  { name: "brand-soft", varName: "--color-brand-soft" },
  { name: "brand-strong", varName: "--color-brand-strong" },
  { name: "accent", varName: "--color-accent" },
  { name: "success", varName: "--color-success" },
  { name: "success-soft", varName: "--color-success-soft" },
  { name: "danger", varName: "--color-danger" },
  { name: "danger-soft", varName: "--color-danger-soft" },
  { name: "focus", varName: "--color-focus" },
];

export default function TokensPage(): JSX.Element {
  return (
    <StyleguideLayout title="Design Tokens" tokensActive>
      <div class="mx-auto max-w-[64rem]">
        <header class="mb-vsp-xl">
          <h1 class="text-2xl font-bold text-ink">Design tokens</h1>
          <p class="mt-vsp-xs text-ink-soft">
            The semantic tokens the <code>@zudo-sg/ui</code> components consume.
            Open the <strong>Tokens</strong> button in the header to tweak them
            live — changes apply to every preview.
          </p>
        </header>

        <section class="mb-vsp-xl">
          <h2 class="mb-vsp-sm text-lg font-semibold text-ink">Color</h2>
          <div class="grid grid-cols-2 gap-hsp-md sm:grid-cols-3 lg:grid-cols-4">
            {COLOR_TOKENS.map((tok) => (
              <div class="rounded-md border border-line bg-surface p-hsp-sm">
                <div
                  class="h-12 w-full rounded-sm border border-line"
                  style={{ background: `var(${tok.varName})` }}
                />
                <p class="mt-vsp-2xs text-small font-medium text-ink">
                  {tok.name}
                </p>
                <p class="text-xs text-ink-mute">{tok.varName}</p>
              </div>
            ))}
          </div>
        </section>

        <section class="mb-vsp-xl">
          <h2 class="mb-vsp-sm text-lg font-semibold text-ink">Spacing</h2>
          <div class="flex flex-col gap-vsp-2xs">
            {SPACING_TOKENS.filter(
              (t) => t.group === "hsp" || t.group === "vsp",
            ).map((tok) => (
              <div class="flex items-center gap-hsp-md">
                <span class="w-24 shrink-0 text-small text-ink">
                  {tok.label}
                </span>
                <span class="w-20 shrink-0 text-xs text-ink-mute">
                  {tok.default}
                </span>
                <span
                  class="h-3 rounded-sm bg-brand"
                  style={{ width: `var(${tok.cssVar})` }}
                />
              </div>
            ))}
          </div>
        </section>

        <section class="mb-vsp-xl">
          <h2 class="mb-vsp-sm text-lg font-semibold text-ink">Type scale</h2>
          <div class="flex flex-col gap-vsp-sm">
            {FONT_TOKENS.filter((t) => t.group === "font-size").map((tok) => (
              <div class="flex items-baseline gap-hsp-md">
                <span class="w-24 shrink-0 text-xs text-ink-mute">
                  {tok.label}
                </span>
                <span
                  class="text-ink"
                  style={{ fontSize: `var(${tok.cssVar})` }}
                >
                  The quick brown fox
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </StyleguideLayout>
  );
}
