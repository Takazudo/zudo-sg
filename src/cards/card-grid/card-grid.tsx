import type { ComponentChildren } from "preact";
import { cx } from "../../lib/cx";

export type CardGridProps = {
  class?: string;
  children?: ComponentChildren;
};

/**
 * Wraps a run of Cards in a responsive auto-fit grid for MDX/content bodies.
 * Horizontal and vertical gaps are set separately (hsp columns, vsp rows) —
 * a different rhythm than a single `gap-hsp-md` would give. The 18rem
 * minmax track is a literal Tailwind v4 class (not composed dynamically —
 * v4 only scans literal class strings in source).
 */
export function CardGrid({ class: cls, children }: CardGridProps) {
  return (
    <div class={cx("grid grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] gap-x-hsp-md gap-y-vsp-sm", cls)}>
      {children}
    </div>
  );
}
