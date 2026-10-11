import type { Child } from "@takazudo/zfb/zudo-react";
import { cx } from "../../lib/cx";

export type CardGridProps = {
  class?: string;
  children?: Child;
};

/**
 * Wraps a run of Cards in a responsive auto-fit grid for MDX/content bodies.
 * Horizontal and vertical gaps are set separately (hsp columns, vsp rows) —
 * a different rhythm than a single `gap-hsp-md` would give. The 18rem
 * minmax track is a complete literal so wind can extract it.
 */
export function CardGrid({ class: cls, children }: CardGridProps) {
  return (
    <div class={cx("grid grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] gap-x-hsp-md gap-y-vsp-sm", cls)}>
      {children}
    </div>
  );
}
