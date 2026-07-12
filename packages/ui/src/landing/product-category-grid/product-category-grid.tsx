import { cx } from "../../lib/cx";
import { Card } from "../../cards/card/card";
import { SectionHeading } from "../../shared/section-heading/section-heading";
import { AutoGrid } from "../../shared/auto-grid/auto-grid";
import { CardLink } from "../../shared/card-link/card-link";

export type ProductCategory = {
  title: string;
  tagline: string;
  items: string[];
  href: string;
};

export type ProductCategoryGridProps = {
  heading?: string;
  intro?: string;
  categories: ProductCategory[];
  /** Renders the data grid only, omitting heading/intro — for embedding in body copy. */
  bare?: boolean;
  class?: string;
};

/**
 * ProductCategoryGrid — product-top card grid, one card per business
 * category with a tagline and a short list of representative items.
 */
export function ProductCategoryGrid({ heading, intro, categories, bare = false, class: cls }: ProductCategoryGridProps) {
  return (
    <section class={cx("flex flex-col gap-y-vsp-md", cls)} aria-label={bare ? undefined : "Product categories"}>
      {!bare && heading && <SectionHeading heading={heading} intro={intro} />}

      <AutoGrid min="16rem">
        {categories.map((cat) => (
          <CardLink key={cat.title} href={cat.href}>
            <Card variant="accent" class="h-full transition-colors group-hover:border-accent">
              <Card.Title class="transition-colors group-hover:text-accent">{cat.title}</Card.Title>
              <p class="text-small leading-relaxed text-fg">{cat.tagline}</p>
              <ul class="mt-vsp-sm flex flex-col gap-vsp-2xs">
                {cat.items.map((item) => (
                  <li key={item} class="text-caption leading-snug text-muted before:mr-hsp-2xs before:text-accent before:content-['—']">
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          </CardLink>
        ))}
      </AutoGrid>
    </section>
  );
}
