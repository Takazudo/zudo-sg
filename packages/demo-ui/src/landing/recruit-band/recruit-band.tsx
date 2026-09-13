import type { JSX } from "preact";
import { cx } from "../../lib/cx";
import { Container } from "../../shared/container/container";
import { SectionHeading } from "../../shared/section-heading/section-heading";
import { CtaButton } from "../../shared/cta-button/cta-button";

export type RecruitBandProps = {
  eyebrow?: string;
  heading: string;
  lead?: string;
  /** Recruiting page link. */
  href: string;
  ctaLabel?: string;
  class?: string;
};

// Same full-width, soft accent-tinted band idiom as Hero (color-mix keeps it
// theme-correct in light and dark without a hard-coded color).
const BAND_STYLE: JSX.CSSProperties = {
  backgroundColor: "color-mix(in srgb, var(--color-accent) 6%, var(--color-bg))",
};

/**
 * RecruitBand — full-width "we're hiring" band pairing a heading/lead with a
 * single prominent CTA to a recruiting page.
 */
export function RecruitBand({
  eyebrow,
  heading,
  lead,
  href,
  ctaLabel = "View openings",
  class: cls,
}: RecruitBandProps) {
  return (
    <section class={cx("w-full", cls)} style={BAND_STYLE} aria-label={heading}>
      <Container class="py-vsp-2xl">
        <div class="flex flex-col gap-y-vsp-md md:flex-row md:items-center md:justify-between md:gap-x-hsp-2xl">
          <SectionHeading class="min-w-0" eyebrow={eyebrow} heading={heading} intro={lead} />

          <div class="shrink-0">
            <CtaButton href={href} variant="primary">
              {ctaLabel}
            </CtaButton>
          </div>
        </div>
      </Container>
    </section>
  );
}
