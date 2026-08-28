import { cx } from "../../lib/cx";
import { SectionHeading } from "../../shared/section-heading/section-heading";

export type FinancialMetric = { label: string; unit: string; value?: string };

export type FinancialHighlightsProps = {
  heading?: string;
  intro?: string;
  metrics: FinancialMetric[];
  /** Shown in place of a value while the figure is not yet public. */
  pendingLabel?: string;
  /** Renders the data grid only, omitting heading/intro — for embedding in body copy. */
  bare?: boolean;
  class?: string;
};

/**
 * FinancialHighlights — IR "financial highlights" metrics summary grid. A
 * metric with no `value` renders `pendingLabel` instead — callers should
 * leave `value` unset rather than inventing a placeholder figure.
 */
export function FinancialHighlights({
  heading,
  intro,
  metrics,
  pendingLabel = "Updated at earnings release",
  bare = false,
  class: cls,
}: FinancialHighlightsProps) {
  return (
    <section class={cx("flex flex-col gap-y-vsp-md", cls)} aria-label={bare ? undefined : heading}>
      {!bare && heading && <SectionHeading heading={heading} intro={intro} />}

      <dl class="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-px overflow-hidden rounded-md border border-border bg-border">
        {metrics.map((metric) => (
          <div key={metric.label} class="flex flex-col gap-y-vsp-xs bg-bg px-hsp-lg py-vsp-md">
            <dt class="text-caption font-medium text-muted">{metric.label}</dt>
            <dd class="flex items-baseline gap-x-hsp-2xs">
              {metric.value ? (
                <>
                  <span class="text-heading font-bold leading-tight text-fg">{metric.value}</span>
                  <span class="text-small font-semibold text-muted">{metric.unit}</span>
                </>
              ) : (
                <span class="text-small text-muted">
                  {pendingLabel}
                  <span class="ms-hsp-2xs text-micro text-muted">({metric.unit})</span>
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
