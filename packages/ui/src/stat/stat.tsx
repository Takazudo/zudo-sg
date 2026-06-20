import type { ComponentChildren } from "preact";
import { cx } from "../lib/cx";

type StatProps = {
  /** The big number / value. */
  value: ComponentChildren;
  /** The label under the value. */
  label: ComponentChildren;
  /** Optional small hint above the value (e.g. "since launch"). */
  hint?: ComponentChildren;
  class?: string;
};

/**
 * A single metric: an optional hint, a large value, and a muted label beneath.
 * Self-contained <div> markup so it is valid both standalone and inside a
 * StatGroup. Token-styled, so dark-correct.
 */
export function Stat({ value, label, hint, class: cls }: StatProps) {
  return (
    <div class={cx("flex flex-col gap-vsp-3xs", cls)}>
      {hint && <span class="text-xs font-medium uppercase tracking-wide text-ink-mute">{hint}</span>}
      <span class="text-2xl font-bold leading-tight tracking-tight text-ink">{value}</span>
      <span class="text-sm text-ink-soft">{label}</span>
    </div>
  );
}

type StatGroupProps = {
  /** Add hairline dividers between stats (from the sm breakpoint up). */
  divided?: boolean;
  class?: string;
  children: ComponentChildren;
};

/**
 * Lays out a row/grid of Stat items: two-up on small screens, spreading to four
 * across from the sm breakpoint. Optional hairline dividers between items.
 */
export function StatGroup({ divided = false, class: cls, children }: StatGroupProps) {
  return (
    <div
      class={cx(
        "grid grid-cols-2 gap-x-hsp-2xl gap-y-vsp-md sm:grid-cols-4",
        divided && "sm:divide-x sm:divide-line [&>*]:sm:px-hsp-lg [&>*:first-child]:sm:pl-0",
        cls,
      )}
    >
      {children}
    </div>
  );
}
