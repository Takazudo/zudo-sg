import { cx } from "../../lib/cx";
import type { BrandSwitcherItem } from "../site-header/site-header";

/**
 * Toggle checkbox id (the off-canvas drawer's single source of open/closed
 * truth — see the checkbox-hack comment on the `<input>` below) and drawer id.
 * `mobile-nav-enhancer` (chrome/mobile-nav-enhancer) reads both by id, so
 * renaming either constant must be mirrored there.
 */
const NAV_TOGGLE_ID = "zui-nav-toggle";
const NAV_DRAWER_ID = "zui-nav-drawer";

/** One nav page (a leaf link). */
export type NavLeaf = {
  label: string;
  href: string;
  /** Raw slug, used only for current-section matching (`currentSlug` below). */
  slug: string;
  order: number;
};

/** One nav section: an accordion panel (site-nav) / mega-menu column (footer). */
export type NavSection = {
  label: string;
  /** Section-top link, if the section has an index page distinct from its children. */
  href?: string;
  order: number;
  children: NavLeaf[];
};

export type SiteNavProps = {
  sections: NavSection[];
  /** Brand name shown on the slim mobile top bar / drawer header. Always corporate. */
  brand?: string;
  brandHref?: string;
  /** Current page slug — drives active-section highlighting + default-open accordion. */
  currentSlug?: string;
  /**
   * Corporate + line entries for the mobile drawer's simplified switcher list.
   * The desktop mega-panel lives in SiteHeader; on mobile that header is
   * hidden, so this reproduces just the switch-context affordance (no photo
   * cards) inside the same drawer subtree mobile-nav-enhancer already
   * manages (focus trap / Escape / scroll-lock cover it for free). Omit to
   * skip the mobile switcher entirely.
   */
  switcherItems?: BrandSwitcherItem[];
  class?: string;
};

/** Strips a trailing `index` segment so `company/index` and `company` compare equal. */
function normalizeSlug(slug: string): string {
  return slug
    .replace(/^\/+|\/+$/g, "")
    .replace(/(^|\/)index$/, "")
    .replace(/\/+$/, "");
}

function slugToHref(slug: string): string {
  const normalized = normalizeSlug(slug);
  return normalized === "" ? "/" : `/${normalized}`;
}

/** Whether a section contains (or is) the current page — for the default-open state. */
function isCurrentSection(section: NavSection, currentSlug?: string): boolean {
  if (!currentSlug) return false;
  const norm = normalizeSlug(currentSlug);
  if (section.children.some((leaf) => normalizeSlug(leaf.slug) === norm)) return true;
  return section.href !== undefined && section.href === slugToHref(currentSlug);
}

/**
 * Fixed left global nav rail: sections render as an inline `<details>`/
 * `<summary>` accordion, so expand/collapse works with zero JS from SSR
 * markup alone. Below `sm`, the same `<nav>` becomes an off-canvas drawer
 * toggled by a `sr-only` checkbox (checkbox hack) — still no JS required.
 *
 * `nav-enhancer` and `mobile-nav-enhancer` (chrome/*-enhancer) layer
 * `aria-expanded` sync, Escape handling, focus trap, and scroll-lock on top;
 * they key off the stable `data-nav-*` hooks below, never a class name.
 *
 * "No self-link" rule: a section whose top-level page is distinct from its
 * children (`section.href` set) renders that as the first child link. A
 * section whose top page IS one of its own children (self-link — `href`
 * unset) does not repeat itself.
 */
export function SiteNav({
  sections,
  brand = "Acme Corp.",
  brandHref = "/",
  currentSlug,
  switcherItems,
  class: cls,
}: SiteNavProps) {
  return (
    <>
      {/* Checkbox hack: the single source of drawer open/closed truth. `peer`
       * drives the hamburger/overlay/drawer below via `peer-checked`. Stays
       * `sr-only` but focusable (not `hidden`) — that's the no-JS keyboard
       * control (Space toggles); the enhancer syncs its aria-expanded/label. */}
      <input
        id={NAV_TOGGLE_ID}
        type="checkbox"
        class="peer sr-only sm:hidden"
        data-nav-toggle
        aria-controls={NAV_DRAWER_ID}
        aria-expanded="false"
        aria-label="Open menu"
      />

      {/* Slim top bar (mobile only): brand + hamburger. */}
      <div class="fixed inset-x-0 top-0 z-ui-sticky hidden h-[3.25rem] items-center justify-between border-b border-rail-border bg-rail-bg-strong px-hsp-md max-sm:flex peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-rail-fg">
        <a class="text-title font-bold text-rail-fg no-underline hover:text-rail-muted" href={brandHref}>
          {brand}
        </a>
        <label
          class="-me-hsp-xs inline-flex h-[2.5rem] w-[2.5rem] cursor-pointer items-center justify-center rounded text-rail-fg hover:text-rail-muted"
          for={NAV_TOGGLE_ID}
          data-nav-hamburger
          aria-hidden="true"
        >
          <span class="relative block h-[2px] w-[1.25rem] bg-rail-fg before:absolute before:inset-x-0 before:-top-[6px] before:block before:h-[2px] before:bg-rail-fg before:content-[''] after:absolute after:inset-x-0 after:top-[6px] after:block after:h-[2px] after:bg-rail-fg after:content-['']" aria-hidden="true" />
        </label>
      </div>

      {/* Overlay (mobile only). A <label> so a plain click closes with no JS. */}
      <label
        class="fixed inset-0 z-ui-overlay hidden bg-[color-mix(in_srgb,var(--color-fg)_45%,transparent)] pointer-events-none opacity-0 transition-opacity max-sm:block peer-checked:pointer-events-auto peer-checked:opacity-100"
        for={NAV_TOGGLE_ID}
        data-nav-overlay
        aria-hidden="true"
      />

      <nav
        id={NAV_DRAWER_ID}
        class={cx(
          "fixed bottom-0 start-0 z-ui-sticky flex w-[13rem] flex-col overflow-y-auto border-e border-rail-border bg-rail-bg [top:4rem]",
          "max-sm:invisible max-sm:top-0 max-sm:z-ui-modal max-sm:w-[17rem] max-sm:max-w-[85vw] max-sm:-translate-x-full max-sm:shadow-[0_8px_24px_color-mix(in_srgb,var(--color-fg)_18%,transparent)] max-sm:transition-transform peer-checked:translate-x-0 max-sm:peer-checked:visible",
          cls,
        )}
        aria-label="Global navigation"
      >
        {/* Drawer header (mobile only): brand + close button. sm+ relies on
         * SiteHeader for the brand lockup, so this row stays hidden there —
         * repeating it would duplicate the brand name in the desktop chrome. */}
        <div class="hidden items-center justify-between border-b border-rail-border bg-rail-bg-strong px-hsp-md py-vsp-xs max-sm:flex">
          <span class="text-title font-bold text-rail-fg">{brand}</span>
          <label
            class="-me-hsp-xs inline-flex h-[2.5rem] w-[2.5rem] cursor-pointer items-center justify-center rounded text-rail-fg hover:text-rail-muted focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rail-fg"
            for={NAV_TOGGLE_ID}
            data-nav-close
            role="button"
            tabIndex={0}
            aria-label="Close menu"
          >
            <span class="text-heading leading-none" aria-hidden="true">
              ×
            </span>
          </label>
        </div>

        {switcherItems && switcherItems.length > 0 && <MobileContextSwitcher items={switcherItems} />}

        <ul class="flex-auto list-none py-vsp-xs">
          {sections.map((section) => {
            const current = isCurrentSection(section, currentSlug);
            const hasChildren = section.children.length > 0;
            return (
              <li key={section.label} class="list-none">
                <details
                  class="group"
                  data-nav-item
                  data-section={section.label}
                  data-current={current ? "true" : undefined}
                  open={current && hasChildren ? true : undefined}
                >
                  <SectionSummary section={section} hasChildren={hasChildren} current={current} />

                  {hasChildren && (
                    <div class="pb-vsp-2xs ps-hsp-lg" role="group" aria-label={section.label}>
                      <ul class="flex list-none flex-col gap-vsp-2xs">
                        {section.href && (
                          <li key="__section-top">
                            <a class={LEAF_LINK_CLASS} href={section.href}>
                              {section.label}
                            </a>
                          </li>
                        )}
                        {section.children.map((leaf) => (
                          <li key={leaf.slug}>
                            <a class={LEAF_LINK_CLASS} href={leaf.href}>
                              {leaf.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </details>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

const LEAF_LINK_CLASS =
  "block rounded px-hsp-xs py-vsp-2xs text-small text-rail-fg no-underline transition-colors hover:bg-rail-hover-bg hover:text-rail-fg focus-visible:bg-rail-hover-bg focus-visible:text-rail-fg focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rail-fg";

/**
 * Simplified mobile switcher (label + current-item highlight only — no photo
 * cards, unlike the desktop mega-panel). `sm:hidden` removes it from tab
 * order on desktop, where SiteHeader's switcher is used instead.
 */
function MobileContextSwitcher({ items }: { items: BrandSwitcherItem[] }) {
  return (
    <div class="border-b border-rail-border px-hsp-md py-vsp-sm sm:hidden" role="group" aria-label="Switch business context">
      <p class="mb-vsp-2xs px-hsp-xs text-caption font-bold uppercase tracking-[0.08em] text-rail-muted">
        Business context
      </p>
      <ul class="flex list-none flex-col gap-vsp-2xs">
        {items.map((item) => (
          <li key={item.key} class="list-none">
            <a href={item.href} aria-current={item.current ? "location" : undefined} data-ctx-mobile-key={item.key} class={MOBILE_SWITCHER_LINK_CLASS}>
              <span class="grid h-[1.6rem] w-[1.6rem] flex-none place-items-center rounded-[6px] bg-accent text-caption font-bold leading-none text-bg" aria-hidden="true">
                {item.mark}
              </span>
              <span class="min-w-0 flex-auto truncate">{item.label}</span>
              {item.current && <span class="h-[0.5rem] w-[0.5rem] flex-none rounded-full bg-accent" aria-hidden="true" />}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

const MOBILE_SWITCHER_LINK_CLASS =
  "flex items-center gap-hsp-xs rounded border-s-[3px] border-s-transparent px-hsp-xs py-vsp-2xs text-small font-medium text-rail-fg no-underline transition-colors" +
  " hover:border-s-accent hover:bg-rail-hover-bg hover:text-rail-fg" +
  " focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rail-fg" +
  " aria-[current=location]:border-s-accent aria-[current=location]:bg-rail-hover-bg aria-[current=location]:text-rail-fg";

const SUMMARY_CLASS =
  "flex w-full cursor-pointer list-none items-center justify-between gap-hsp-xs border-s-[3px] border-s-transparent px-hsp-md py-vsp-xs text-start text-small font-medium text-rail-fg transition-colors" +
  " hover:border-s-accent hover:bg-rail-hover-bg hover:text-rail-fg" +
  " focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rail-fg" +
  " group-data-[current=true]:border-s-accent group-data-[current=true]:bg-rail-hover-bg group-data-[current=true]:text-rail-fg" +
  " group-open:border-s-accent group-open:bg-rail-hover-bg group-open:text-rail-fg";

/**
 * A section's `<summary>` (the accordion toggle). Never a link itself — that
 * would blur `<details>`'s native accordion semantics. No `aria-haspopup`:
 * `<details>` is an inline disclosure widget, not a popup menu.
 * `nav-enhancer` syncs this `aria-expanded` on the native `toggle` event.
 */
function SectionSummary({ section, hasChildren, current }: { section: NavSection; hasChildren: boolean; current: boolean }) {
  const chevron = hasChildren ? (
    <span class="flex-none text-rail-muted transition-transform group-open:rotate-90 group-data-[current=true]:text-rail-fg group-open:text-rail-fg" aria-hidden="true">
      ›
    </span>
  ) : null;

  return (
    <summary class={SUMMARY_CLASS} data-nav-trigger aria-expanded={hasChildren ? (current ? "true" : "false") : undefined}>
      <span>{section.label}</span>
      {chevron}
    </summary>
  );
}
