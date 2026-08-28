import { cx } from "../../lib/cx";
import { SectionHeading } from "../../shared/section-heading/section-heading";

export type Strength = { no: string; title: string; body: string };

export type StrengthListProps = {
  heading?: string;
  strengths: Strength[];
  /** Renders the list only, omitting the heading — for embedding in body copy. */
  bare?: boolean;
  class?: string;
};

/**
 * StrengthList — enumerated "large number + title + body" strengths list,
 * stacked vertically with hairline dividers between entries.
 */
export function StrengthList({ heading, strengths, bare = false, class: cls }: StrengthListProps) {
  return (
    <section class={cx("flex flex-col gap-y-vsp-md", cls)} aria-label={bare ? undefined : heading}>
      {!bare && heading && <SectionHeading heading={heading} />}

      <ol class="flex flex-col">
        {strengths.map((s, i) => (
          <li
            key={s.no}
            class={cx("flex flex-col gap-hsp-md py-vsp-md sm:flex-row sm:items-start", i > 0 && "border-t border-border")}
          >
            <span aria-hidden="true" class="shrink-0 text-display font-bold leading-none text-accent">
              {s.no}
            </span>
            <div>
              <h3 class="text-title font-semibold text-fg">{s.title}</h3>
              <p class="mt-vsp-2xs text-small leading-relaxed text-fg">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
