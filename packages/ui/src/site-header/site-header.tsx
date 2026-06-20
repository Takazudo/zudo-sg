import type { ComponentChildren } from "preact";
import { cx } from "../lib/cx";

export type NavItem = {
  label: string;
  href: string;
};

type SiteHeaderProps = {
  /** Brand text or a logo node, linked to `brandHref`. */
  brand: ComponentChildren;
  brandHref?: string;
  /** Primary nav items. */
  nav?: NavItem[];
  /** Path of the current page, used to mark the active nav item. */
  activePath?: string;
  /** Optional trailing action slot (e.g. a Button). */
  action?: ComponentChildren;
  /** Stick to the top of the viewport. Defaults to true. */
  sticky?: boolean;
  class?: string;
};

/**
 * Site chrome header: brand on the left, nav + optional action on the right.
 * Sticky and translucent by default. Nav active state is derived from
 * `activePath`. Token-styled, so dark-correct.
 */
export function SiteHeader({
  brand,
  brandHref = "/",
  nav = [],
  activePath,
  action,
  sticky = true,
  class: cls,
}: SiteHeaderProps) {
  return (
    <header
      class={cx(
        "border-b border-line bg-surface/85 backdrop-blur",
        // Arbitrary z so the header is self-contained: it does not depend on
        // any consumer-specific z-index token (the demo and the styleguide host
        // each define their own z tiers). 20 sits above ordinary page content.
        sticky && "sticky top-0 z-[20]",
        cls,
      )}
    >
      <div class="mx-auto flex w-full max-w-[72rem] items-center justify-between gap-hsp-lg px-hsp-lg py-vsp-xs">
        <a
          href={brandHref}
          class="rounded-sm text-lg font-bold tracking-tight text-ink no-underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {brand}
        </a>

        <div class="flex items-center gap-hsp-lg">
          {nav.length > 0 && (
            <nav aria-label="Primary" class="hidden items-center gap-hsp-md sm:flex">
              {nav.map((item) => {
                const active = activePath === item.href;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    class={cx(
                      "rounded-sm px-hsp-2xs py-vsp-3xs text-sm no-underline outline-none transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                      active ? "font-semibold text-brand" : "text-ink-soft hover:text-ink",
                    )}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>
          )}
          {action && <div class="shrink-0">{action}</div>}
        </div>
      </div>
    </header>
  );
}
