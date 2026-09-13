import { cx } from "../../lib/cx";
import { Card } from "../../cards/card/card";
import { SectionHeading } from "../../shared/section-heading/section-heading";
import { AutoGrid } from "../../shared/auto-grid/auto-grid";
import { ViewAllLink } from "../../shared/card-link/card-link";

export type SdgsInitiative = { title: string; body: string };

export type SdgsHighlightProps = {
  eyebrow?: string;
  heading: string;
  lead?: string;
  initiatives: SdgsInitiative[];
  href: string;
  linkLabel?: string;
  class?: string;
};

/**
 * SdgsHighlight — top-page excerpt of a company's sustainability initiatives,
 * teasing through to the full sustainability page.
 */
export function SdgsHighlight({
  eyebrow,
  heading,
  lead,
  initiatives,
  href,
  linkLabel = "View our sustainability initiatives",
  class: cls,
}: SdgsHighlightProps) {
  return (
    <section class={cx("flex flex-col gap-y-vsp-md", cls)} aria-label={heading}>
      <SectionHeading eyebrow={eyebrow} heading={heading} intro={lead} />

      <AutoGrid>
        {initiatives.map((item) => (
          <Card key={item.title} variant="accent" class="h-full">
            <Card.Title>{item.title}</Card.Title>
            <p class="text-small leading-relaxed text-fg">{item.body}</p>
          </Card>
        ))}
      </AutoGrid>

      <p>
        <ViewAllLink href={href}>{linkLabel}</ViewAllLink>
      </p>
    </section>
  );
}
