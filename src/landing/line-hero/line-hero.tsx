import type { ComponentChildren } from "preact";
import { Hero, type HeroAction } from "../../shared/hero/hero";

export type LineHeroProps = {
  /** Short brand/domain label (e.g. "Vacuum Solutions — example-brand.com"). */
  eyebrow?: string;
  heading?: ComponentChildren;
  lead?: ComponentChildren;
  actions?: HeroAction[];
  class?: string;
};

/**
 * LineHero — shared hero for business-line landing pages. A thin wrapper
 * pinning shared Hero to its `secondary` (smaller) heading scale, reused
 * across every line's landing page with per-line copy supplied by the
 * caller. Pair with a `[data-line="<key>"]` ancestor so its accent color
 * cascades from the active line's theme (see TOKEN-MAP §2) — this
 * component itself carries no per-line color logic.
 */
export function LineHero({ eyebrow, heading, lead, actions, class: cls }: LineHeroProps) {
  return (
    <Hero
      variant="secondary"
      eyebrow={eyebrow}
      heading={heading}
      lead={lead}
      actions={actions}
      class={cls}
    />
  );
}
