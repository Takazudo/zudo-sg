import { SectionHeading } from "../../shared/section-heading/section-heading";

export type FeatureSplitPillar = { index: string; title: string; body: string };

export type FeatureSplitProps = {
  eyebrow?: string;
  heading: string;
  lead?: string;
  /** Fixed 2-up layout (grid-cols-2, collapsing to 1 column on narrow screens). */
  pillars: [FeatureSplitPillar, FeatureSplitPillar];
  class?: string;
};

/**
 * FeatureSplit — a two-pillar positioning section (e.g. a dual-business
 * company explaining its two sides). Fixed 2-column layout, so it uses a
 * plain grid rather than the auto-fit AutoGrid primitive.
 */
export function FeatureSplit({ eyebrow, heading, lead, pillars, class: cls }: FeatureSplitProps) {
  return (
    <section class={cls}>
      <SectionHeading eyebrow={eyebrow} heading={heading} intro={lead} />

      <div class="mt-vsp-lg grid grid-cols-2 gap-x-hsp-lg gap-y-vsp-md max-sm:grid-cols-1">
        {pillars.map((pillar) => (
          <div
            key={pillar.index}
            class="rounded-md border border-border border-t-2 border-t-accent bg-bg px-hsp-xl py-vsp-md"
          >
            <p class="text-title font-bold text-accent">{pillar.index}</p>
            <h3 class="mt-vsp-xs text-title font-semibold text-fg">{pillar.title}</h3>
            <p class="mt-vsp-xs text-small leading-relaxed text-fg" style={{ textWrap: "pretty" }}>
              {pillar.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
