import type { ComponentChildren } from "preact";
import { Hero, type HeroAction } from "../../shared/hero/hero";

export type LandingHeroProps = {
  eyebrow?: string;
  heading?: ComponentChildren;
  lead?: ComponentChildren;
  actions?: HeroAction[];
  class?: string;
};

/**
 * LandingHero — a page's main hero band. Thin wrapper pinning shared Hero to
 * its `primary` (largest) heading scale; all copy is caller-supplied.
 */
export function LandingHero({ eyebrow, heading, lead, actions, class: cls }: LandingHeroProps) {
  return (
    <Hero
      variant="primary"
      eyebrow={eyebrow}
      heading={heading}
      lead={lead}
      actions={actions}
      class={cls}
    />
  );
}
