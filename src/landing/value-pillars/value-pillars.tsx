import { cx } from "../../lib/cx";
import { Card } from "../../cards/card/card";
import { SectionHeading } from "../../shared/section-heading/section-heading";
import { AutoGrid } from "../../shared/auto-grid/auto-grid";

export type ValuePillar = { title: string; body: string };

export type ValuePillarsProps = {
  heading?: string;
  intro?: string;
  pillars: ValuePillar[];
  /** Renders the data grid only, omitting heading/intro — for embedding in body copy. */
  bare?: boolean;
  class?: string;
};

/** ValuePillars — numbered card grid for a "where we create value" positioning section. */
export function ValuePillars({ heading, intro, pillars, bare = false, class: cls }: ValuePillarsProps) {
  return (
    <section class={cx("flex flex-col gap-y-vsp-md", cls)} aria-label={bare ? undefined : heading}>
      {!bare && heading && <SectionHeading heading={heading} intro={intro} />}

      <AutoGrid>
        {pillars.map((pillar, index) => (
          <Card key={pillar.title} variant="default" class="flex h-full flex-col">
            <span
              class="flex size-[2rem] items-center justify-center rounded-md bg-accent text-small font-bold text-bg"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <Card.Title class="mt-vsp-sm">{pillar.title}</Card.Title>
            <p class="text-small leading-relaxed text-fg">{pillar.body}</p>
          </Card>
        ))}
      </AutoGrid>
    </section>
  );
}
