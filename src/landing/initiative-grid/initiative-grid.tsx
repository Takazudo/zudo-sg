import { cx } from "../../lib/cx";
import { SectionHeading } from "../../shared/section-heading/section-heading";
import { AutoGrid } from "../../shared/auto-grid/auto-grid";

export type Initiative = { title: string; body: string };

export type InitiativeGridProps = {
  heading?: string;
  intro?: string;
  initiatives: Initiative[];
  /** Renders the data grid only, omitting heading/intro — for embedding in body copy. */
  bare?: boolean;
  class?: string;
};

/**
 * InitiativeGrid — sustainability-style "initiative" card grid, each card
 * numbered and top-rule accented.
 */
export function InitiativeGrid({ heading, intro, initiatives, bare = false, class: cls }: InitiativeGridProps) {
  return (
    <section class={cx("flex flex-col gap-y-vsp-md", cls)} aria-label={bare ? undefined : heading}>
      {!bare && heading && <SectionHeading heading={heading} intro={intro} />}

      <AutoGrid as="ol">
        {initiatives.map((item, i) => (
          <li key={item.title} class="rounded-md border border-border border-t-2 border-t-accent bg-bg px-hsp-lg py-vsp-md">
            <p class="text-title font-bold text-accent">{String(i + 1).padStart(2, "0")}</p>
            <h3 class="mt-vsp-2xs text-title font-semibold text-fg">{item.title}</h3>
            <p class="mt-vsp-xs text-small leading-relaxed text-fg" style={{ textWrap: "pretty" }}>
              {item.body}
            </p>
          </li>
        ))}
      </AutoGrid>
    </section>
  );
}
