import { cx } from "../../lib/cx";
import { Card } from "../../cards/card/card";
import { SectionHeading } from "../../shared/section-heading/section-heading";
import { AutoGrid } from "../../shared/auto-grid/auto-grid";
import { CardLink } from "../../shared/card-link/card-link";

export type BusinessSegment = { title: string; body: string; href: string };

export type BusinessSegmentsProps = {
  heading: string;
  intro?: string;
  segments: BusinessSegment[];
  class?: string;
};

/**
 * BusinessSegments — top-page card grid summarizing a company's business
 * segments, each linking through to its own detail page.
 */
export function BusinessSegments({ heading, intro, segments, class: cls }: BusinessSegmentsProps) {
  return (
    <section class={cx("flex flex-col gap-y-vsp-md", cls)} aria-label={heading}>
      <SectionHeading heading={heading} intro={intro} />

      <AutoGrid>
        {segments.map((seg) => (
          <CardLink key={seg.title} href={seg.href}>
            <Card variant="accent" class="h-full transition-colors group-hover:border-accent">
              <Card.Title class="transition-colors group-hover:text-accent">{seg.title}</Card.Title>
              <p class="text-small leading-relaxed text-fg">{seg.body}</p>
            </Card>
          </CardLink>
        ))}
      </AutoGrid>
    </section>
  );
}
