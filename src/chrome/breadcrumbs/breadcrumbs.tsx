import { cx } from "../../lib/cx";

/** One crumb. The last crumb (current page) omits `href` and gets `aria-current="page"`. */
export type Crumb = {
  label: string;
  href?: string;
};

export type BreadcrumbsProps = {
  crumbs: Crumb[];
  class?: string;
};

/**
 * Home > section > current-page trail. Renders nothing for a single crumb
 * (the home page itself) — there's nothing to trail.
 */
export function Breadcrumbs({ crumbs, class: cls }: BreadcrumbsProps) {
  if (crumbs.length <= 1) return null;

  return (
    <nav class={cx("border-b border-border px-hsp-xl py-vsp-xs text-caption text-muted", cls)} aria-label="Breadcrumbs">
      <ol class="flex flex-wrap items-center gap-hsp-xs">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            // The "/" separator is a `::before` on every item but the first.
            <li
              class="inline-flex items-center gap-hsp-xs [&:not(:first-child)]:before:text-border [&:not(:first-child)]:before:content-['/']"
              key={`${crumb.label}-${i}`}
            >
              {crumb.href && !isLast ? (
                <a class="text-muted hover:text-accent hover:underline" href={crumb.href}>
                  {crumb.label}
                </a>
              ) : (
                <span class="font-medium text-fg" aria-current={isLast ? "page" : undefined}>
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
