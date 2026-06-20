import type { ComponentChildren } from "preact";
import { cx } from "../lib/cx";

export type FooterLink = { label: string; href: string };
export type FooterGroup = { heading: string; links: FooterLink[] };

type SiteFooterProps = {
  /** Brand text or logo node. */
  brand: ComponentChildren;
  /** Short tagline under the brand. */
  tagline?: ComponentChildren;
  /** Columns of grouped nav links. */
  groups?: FooterGroup[];
  /** Copyright / fine print line at the bottom. */
  copyright?: ComponentChildren;
  class?: string;
};

/**
 * Site footer: brand + tagline column alongside grouped nav columns, with a
 * baseline divider and copyright row. Stacks on small screens. Token-styled.
 */
export function SiteFooter({ brand, tagline, groups = [], copyright, class: cls }: SiteFooterProps) {
  return (
    <footer class={cx("border-t border-line bg-surface-sunken", cls)}>
      <div class="mx-auto w-full max-w-[72rem] px-hsp-lg py-vsp-xl">
        <div class="flex flex-col gap-vsp-xl md:flex-row md:justify-between">
          <div class="flex max-w-[22rem] flex-col gap-vsp-3xs">
            <span class="text-lg font-bold tracking-tight text-ink">{brand}</span>
            {tagline && <p class="text-sm text-ink-soft text-pretty">{tagline}</p>}
          </div>

          {groups.length > 0 && (
            <nav
              aria-label="Footer"
              class="grid grid-cols-2 gap-x-hsp-2xl gap-y-vsp-md sm:grid-cols-3"
            >
              {groups.map((group) => (
                <div key={group.heading} class="flex flex-col gap-vsp-2xs">
                  <h2 class="text-xs font-semibold uppercase tracking-wide text-ink-mute">
                    {group.heading}
                  </h2>
                  <ul class="flex flex-col gap-vsp-3xs">
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          class="rounded-sm text-sm text-ink-soft no-underline outline-none transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          )}
        </div>

        {copyright && (
          <div class="mt-vsp-xl border-t border-line pt-vsp-md text-xs text-ink-mute">{copyright}</div>
        )}
      </div>
    </footer>
  );
}
