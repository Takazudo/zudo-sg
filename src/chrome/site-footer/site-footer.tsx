import { cx } from "../../lib/cx";
import type { NavSection } from "../site-nav/site-nav";

export type FooterLink = {
  label: string;
  href: string;
};

export type SiteFooterProps = {
  /** Same section tree as SiteNav — sections become columns, children become links. */
  sections: NavSection[];
  brand?: string;
  /**
   * Legal/policy links that don't belong in the section tree (e.g. pages
   * excluded from nav). Rendered as a second link row below the sitemap.
   */
  policyLinks?: FooterLink[];
  class?: string;
};

/**
 * Sitemap-style footer: one column per SiteNav section, its children as
 * column links, auto-fit so column count follows viewport width. A page
 * added to `sections` shows up here automatically — nothing footer-specific
 * to maintain.
 */
export function SiteFooter({ sections, brand = "Acme Corp.", policyLinks = [], class: cls }: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer class={cx("mt-vsp-xl border-t border-border bg-surface px-hsp-xl pt-vsp-lg pb-vsp-md", cls)} aria-label="Footer sitemap">
      <nav aria-label="Sitemap" class="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-x-hsp-xl gap-y-vsp-md">
        {sections.map((section, i) => {
          // Not an <h2> — a footer column label shouldn't join the page's
          // heading outline. role="group" + aria-labelledby groups it for
          // assistive tech instead.
          const labelId = `zui-footer-col-${i}`;
          return (
            <div key={section.label} role="group" aria-labelledby={labelId}>
              <p id={labelId} class="mb-vsp-xs border-b border-border pb-vsp-2xs text-small font-semibold text-fg">
                {section.href ? (
                  <a class="text-inherit no-underline hover:text-accent" href={section.href}>
                    {section.label}
                  </a>
                ) : (
                  section.label
                )}
              </p>
              <ul class="flex flex-col gap-vsp-2xs">
                {section.children.map((leaf) => (
                  <li key={leaf.slug}>
                    <a class="text-caption text-muted hover:text-accent hover:underline" href={leaf.href}>
                      {leaf.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div class="mt-vsp-md border-t border-border pt-vsp-sm text-caption text-muted">
        {policyLinks.length > 0 && (
          <nav aria-label="Policy links" class="mb-vsp-xs">
            <ul class="flex flex-wrap gap-x-hsp-md gap-y-vsp-2xs">
              {policyLinks.map((link) => (
                <li key={link.href}>
                  <a class="text-caption text-muted hover:text-accent hover:underline" href={link.href}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <p>
          Copyright © {year} {brand} All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}
