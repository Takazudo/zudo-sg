import { cx } from "../../lib/cx";

export type HistoryEntry = { year: string; event: string };

export type HistoryTimelineProps = {
  entries: HistoryEntry[];
  class?: string;
};

/**
 * HistoryTimeline — vertical "year / event" company history timeline: year
 * in the left column (accent), a connecting rule + node in the middle, event
 * copy on the right. No aria-label on the `<ol>` itself (ARIA misuse) — the
 * surrounding page heading supplies the context.
 */
export function HistoryTimeline({ entries, class: cls }: HistoryTimelineProps) {
  return (
    <ol class={cx("flex flex-col", cls)}>
      {entries.map((entry, i) => {
        const isLast = i === entries.length - 1;
        return (
          <li key={entry.year} class="grid grid-cols-[5rem_auto_1fr] gap-x-hsp-md">
            <span class="py-vsp-2xs text-title font-bold leading-tight text-accent">{entry.year}</span>

            {/* Connecting rule + node. The rule runs full-height except on the
             * last entry, where it stops at the node so nothing trails below. */}
            <span class="relative flex w-[1px] justify-center" aria-hidden="true">
              <span class={cx("absolute inset-x-0 top-0 bg-border", isLast ? "h-vsp-md" : "bottom-0")} />
              <span class="absolute top-vsp-2xs size-[10px] rounded-full border-2 border-bg bg-accent" />
            </span>

            <span class="pb-vsp-md ps-hsp-2xs text-small leading-relaxed text-fg">{entry.event}</span>
          </li>
        );
      })}
    </ol>
  );
}
