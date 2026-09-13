import { cx } from "../../lib/cx";
import { Card } from "../../cards/card/card";
import { SectionHeading } from "../../shared/section-heading/section-heading";
import { AutoGrid } from "../../shared/auto-grid/auto-grid";

export type GroupCompany = { name: string; business: string; established: string; location?: string };

export type GroupCompanyGridProps = {
  heading?: string;
  intro?: string;
  companies: GroupCompany[];
  /** Renders the data grid only, omitting heading/intro — for embedding in body copy. */
  bare?: boolean;
  class?: string;
};

/** GroupCompanyGrid — card grid listing a company's group/subsidiary companies. */
export function GroupCompanyGrid({ heading, intro, companies, bare = false, class: cls }: GroupCompanyGridProps) {
  return (
    <section class={cx("flex flex-col gap-y-vsp-md", cls)} aria-label={bare ? undefined : "Group companies"}>
      {!bare && heading && <SectionHeading heading={heading} intro={intro} />}

      <AutoGrid>
        {companies.map((company) => (
          <Card key={company.name} variant="accent" class="h-full">
            <Card.Title>{company.name}</Card.Title>
            <p class="text-small leading-relaxed text-fg">{company.business}</p>
            <p class="mt-vsp-sm text-caption text-muted">
              {company.location ? `${company.established} · ${company.location}` : company.established}
            </p>
          </Card>
        ))}
      </AutoGrid>
    </section>
  );
}
