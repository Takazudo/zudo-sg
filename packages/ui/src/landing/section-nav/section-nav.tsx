import { cx } from "../../lib/cx";
import { SectionHeading } from "../../shared/section-heading/section-heading";
import { AutoGrid } from "../../shared/auto-grid/auto-grid";
import { externalLinkAttrs } from "../../shared/external-link/external-link";

export type SectionNavLink = {
  title: string;
  /** Short English/secondary label shown beside the title (e.g. "Company"). */
  sub: string;
  body: string;
  href: string;
  /** Adds target="_blank" + rel + an outbound-arrow affordance. */
  external?: boolean;
};

export type SectionNavProps = {
  heading: string;
  links: SectionNavLink[];
  class?: string;
};

/**
 * SectionNav — a grid of navigation cards teasing a site's top-level
 * sections (e.g. Company, Products, Sustainability), each with a short
 * description and an internal- or external-link affordance.
 */
export function SectionNav({ heading, links, class: cls }: SectionNavProps) {
  return (
    <section class={cls} aria-label={heading}>
      <SectionHeading heading={heading} />

      <AutoGrid as="ul" min="16rem" class="mt-vsp-md">
        {links.map((link) => (
          <li key={link.href + link.title}>
            <a
              href={link.href}
              {...externalLinkAttrs(link.external)}
              class={cx(
                "group flex h-full flex-col rounded-md border border-border bg-bg",
                "px-hsp-lg py-vsp-md no-underline transition-colors",
                "hover:border-accent hover:bg-surface",
              )}
            >
              <span class="flex items-baseline justify-between gap-x-hsp-sm">
                <span class="text-title font-semibold text-fg transition-colors group-hover:text-accent">
                  {link.title}
                </span>
                <span class="text-micro font-semibold uppercase tracking-wide text-muted">
                  {link.sub}
                </span>
              </span>
              <span class="mt-vsp-xs text-caption leading-relaxed text-fg">{link.body}</span>
              <span class="mt-vsp-sm inline-flex items-center gap-x-hsp-2xs text-caption font-semibold text-accent">
                {link.external ? "Visit site" : "Learn more"}
                <span aria-hidden="true">{link.external ? "↗" : "→"}</span>
              </span>
            </a>
          </li>
        ))}
      </AutoGrid>
    </section>
  );
}
