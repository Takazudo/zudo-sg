import { cx } from "../../lib/cx";

export type CompanyProfileRow = { label: string; value: string };

export type CompanyProfileTableProps = {
  rows: CompanyProfileRow[];
  class?: string;
};

/**
 * CompanyProfileTable — company-profile "label / value" definition list,
 * rows separated by hairline rules, the whole table framed in one rounded
 * border. Accessible name goes on the wrapping `<section>` landmark, not the
 * `<dl>` itself (aria-label on a `<dl>` is an ARIA misuse).
 */
export function CompanyProfileTable({ rows, class: cls }: CompanyProfileTableProps) {
  return (
    <section aria-label="Company profile">
      <dl class={cx("overflow-hidden rounded-md border border-border bg-bg", cls)}>
        {rows.map((row, i) => (
          <div
            key={row.label}
            class={cx(
              "grid grid-cols-[minmax(8rem,12rem)_1fr] max-sm:grid-cols-1",
              i > 0 && "border-t border-border",
            )}
          >
            <dt class="bg-surface px-hsp-lg py-vsp-sm text-caption font-semibold text-muted">
              {row.label}
            </dt>
            <dd class="px-hsp-lg py-vsp-sm text-small text-fg">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
