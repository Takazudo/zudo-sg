import type { ComponentChildren } from "preact";
import { cx } from "../lib/cx";

type HeadingTag = "h1" | "h2" | "h3" | "h4";

type PageHeadingProps = {
  /** Small label rendered above the title (e.g. section name / breadcrumb). */
  eyebrow?: ComponentChildren;
  /** Supporting sentence rendered below the title. */
  description?: ComponentChildren;
  /** Heading level for the title element. Defaults to h1. */
  as?: Extract<HeadingTag, "h1" | "h2">;
  class?: string;
  children: ComponentChildren;
};

/**
 * Page-level heading block: optional eyebrow, a large display title, and an
 * optional description. Used once near the top of a page. Spacing uses the
 * tight vsp axis so the rhythm matches the rest of the system.
 */
export function PageHeading({ eyebrow, description, as = "h1", class: cls, children }: PageHeadingProps) {
  const Title = as;
  return (
    <div class={cx("flex flex-col gap-vsp-3xs", cls)}>
      {eyebrow && (
        <span class="text-xs font-semibold uppercase tracking-wide text-brand">{eyebrow}</span>
      )}
      <Title class="text-2xl font-bold tracking-tight text-balance text-ink">{children}</Title>
      {description && <p class="max-w-[44rem] text-base text-ink-soft text-pretty">{description}</p>}
    </div>
  );
}

type SectionHeadingProps = {
  /** Supporting sentence rendered below the title. */
  description?: ComponentChildren;
  /** Heading level for the title element. Defaults to h2. */
  as?: Extract<HeadingTag, "h2" | "h3" | "h4">;
  /** Optional trailing action (e.g. a "View all" Link) aligned to the title. */
  action?: ComponentChildren;
  class?: string;
  children: ComponentChildren;
};

/**
 * Section heading: a title with an optional description and an optional
 * trailing action (commonly a Link). One step down in scale from PageHeading.
 */
export function SectionHeading({
  description,
  as = "h2",
  action,
  class: cls,
  children,
}: SectionHeadingProps) {
  const Title = as;
  return (
    <div class={cx("flex flex-col gap-vsp-3xs", cls)}>
      <div class="flex items-end justify-between gap-hsp-md">
        <Title class="text-xl font-semibold tracking-tight text-balance text-ink">{children}</Title>
        {action && <div class="shrink-0 text-sm">{action}</div>}
      </div>
      {description && <p class="max-w-[44rem] text-base text-ink-soft text-pretty">{description}</p>}
    </div>
  );
}
