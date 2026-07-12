export type BandStat = { value: string; unit?: string; label: string };

export type StatBandProps = {
  stats: BandStat[];
  class?: string;
};

/**
 * StatBand — a company-at-a-glance summary band (founding year, capital,
 * headcount, ...). Auto-fit grid with hairline dividers, no media queries.
 */
export function StatBand({ stats, class: cls }: StatBandProps) {
  return (
    // Accessible name goes on the <section> landmark, not the <dl> itself
    // (aria-label on a <dl> is an ARIA misuse) — a named region wraps it.
    <section class={cls} aria-label="Company summary">
      <dl class="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-px overflow-hidden rounded-md border border-border bg-border">
        {stats.map((stat) => (
          <div key={stat.label} class="flex flex-col gap-y-vsp-2xs bg-bg px-hsp-lg py-vsp-md">
            <dd class="order-1 text-heading font-bold leading-tight text-fg">
              {stat.value}
              {stat.unit && <span class="ms-hsp-2xs text-small font-semibold text-muted">{stat.unit}</span>}
            </dd>
            <dt class="order-2 text-caption text-muted">{stat.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
