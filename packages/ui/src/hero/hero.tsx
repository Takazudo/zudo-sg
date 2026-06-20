import type { ComponentChildren } from "preact";
import { cx } from "../lib/cx";

type HeroProps = {
  /** Small label above the title. */
  eyebrow?: ComponentChildren;
  title: ComponentChildren;
  /** Supporting paragraph below the title. */
  lede?: ComponentChildren;
  /** Action row (e.g. one or two Buttons). */
  actions?: ComponentChildren;
  /** Optional media/visual node placed beside the copy from the lg breakpoint. */
  media?: ComponentChildren;
  /** Tinted brand-soft background panel. Defaults to true. */
  tinted?: boolean;
  class?: string;
};

/**
 * Landing-page hero: eyebrow + display title + lede + actions, optionally with
 * a media panel on the side (single column until lg, two columns from lg).
 * Generous tight-token vertical rhythm; tinted brand-soft panel by default.
 */
export function Hero({
  eyebrow,
  title,
  lede,
  actions,
  media,
  tinted = true,
  class: cls,
}: HeroProps) {
  const hasMedia = media != null;
  return (
    <section
      class={cx(
        "rounded-lg px-hsp-2xl py-vsp-2xl",
        tinted ? "bg-brand-soft" : "bg-surface",
        cls,
      )}
    >
      <div
        class={cx(
          "mx-auto flex w-full max-w-[72rem] flex-col gap-vsp-xl",
          hasMedia && "lg:grid lg:grid-cols-2 lg:items-center lg:gap-hsp-2xl",
        )}
      >
        <div class="flex flex-col gap-vsp-md">
          {eyebrow && (
            <span class="text-sm font-semibold uppercase tracking-wide text-brand-strong">
              {eyebrow}
            </span>
          )}
          <h1 class="text-2xl font-bold tracking-tight text-balance text-ink">{title}</h1>
          {lede && <p class="max-w-[40rem] text-base text-ink-soft text-pretty">{lede}</p>}
          {actions && <div class="flex flex-wrap items-center gap-hsp-md">{actions}</div>}
        </div>
        {hasMedia && <div class="min-w-0">{media}</div>}
      </div>
    </section>
  );
}
