import { cx } from "../../lib/cx";
import { Card } from "../../cards/card/card";
import { SectionHeading } from "../../shared/section-heading/section-heading";
import { AutoGrid } from "../../shared/auto-grid/auto-grid";
import { CardLink } from "../../shared/card-link/card-link";

export type BusinessLinePortalLine = {
  /** Line identifier, used for `only` filtering. */
  key: string;
  label: string;
  description: string;
  href: string;
};

export type BusinessLinePortalProps = {
  heading?: string;
  intro?: string;
  lines: BusinessLinePortalLine[];
  /** Show only these line keys, in the order given. Omit to show all. */
  only?: string[];
  /** Renders the data grid only, omitting heading/intro — for embedding in body copy. */
  bare?: boolean;
  class?: string;
};

/**
 * BusinessLinePortal — card-grid portal listing a company's business lines,
 * each linking through to its own line landing page.
 */
export function BusinessLinePortal({
  heading,
  intro,
  lines,
  only,
  bare = false,
  class: cls,
}: BusinessLinePortalProps) {
  const shown = only ? lines.filter((line) => only.includes(line.key)) : lines;

  return (
    <section
      class={cx("flex flex-col gap-y-vsp-md", cls)}
      aria-label={bare ? undefined : heading}
    >
      {!bare && heading && <SectionHeading heading={heading} intro={intro} />}

      <AutoGrid>
        {shown.map((line) => (
          <CardLink key={line.key} href={line.href}>
            <Card class="h-full transition-colors group-hover:border-accent">
              <div class="flex items-baseline justify-between gap-hsp-xs">
                <Card.Title class="mb-vsp-2xs transition-colors group-hover:text-accent">
                  {line.label}
                </Card.Title>
                <span class="text-caption font-semibold text-accent transition-colors group-hover:text-accent-hover">
                  →
                </span>
              </div>
              <p class="mt-vsp-xs text-small leading-relaxed text-fg">{line.description}</p>
            </Card>
          </CardLink>
        ))}
      </AutoGrid>
    </section>
  );
}
