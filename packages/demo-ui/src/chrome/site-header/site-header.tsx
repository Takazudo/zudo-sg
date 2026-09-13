import type { ComponentChildren } from "preact";
import { cx } from "../../lib/cx";
import type { NavSection } from "../site-nav/site-nav";

/**
 * Disclosure a11y-hook contract shared with `context-switcher-enhancer` and
 * `search-toggle-enhancer` (packages/ui/src/chrome/*-enhancer). Both panels
 * open with pure CSS (`group-hover`/`focus-within` below) — the enhancers only
 * layer on `aria-expanded` sync, click-to-pin, and Escape/outside-click close.
 * Renaming any `data-ctx-*` / `data-search-*` attribute here must be mirrored
 * in the matching enhancer's `document.querySelector`.
 */
const CTX_PANEL_ID = "zui-ctx-panel";
const SEARCH_INPUT_ID = "zui-search-input";

/** @deprecated SiteHeader now receives `sections`; retained as a type-only export for compatibility. */
export type BrandSwitcherItem = never;

export type SiteHeaderProps = {
  /** Brand name, always the persistent corporate brand (never per-line). */
  brand?: string;
  brandSubtitle?: string;
  /** Brand link target, always the corporate home. */
  brandHref?: string;
  /** The current `getSiteTree(line).sections` data, shared with SiteNav. */
  sections?: NavSection[];
  /** Client-island control supplied by the host; SiteHeader stays framework-neutral. */
  desktopThemeControl?: ComponentChildren;
  class?: string;
};

const BRAND_MARK = "D";

const UTIL_LINK_CLASS =
  "inline-flex items-center gap-hsp-2xs whitespace-nowrap text-rail-muted no-underline transition-colors hover:text-rail-fg focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rail-fg";

/**
 * Full-width sticky desktop header: brand lockup, a real site-tree Browse
 * disclosure, and utility controls. SiteNav owns the only narrow navigation
 * surface, so this component is hidden below `sm`.
 *
 * The Browse panel works without JavaScript: hover and focus-within expose
 * the actual section links. Mount `ContextSwitcherEnhancer` to layer the
 * pinned/open/closed intent model over that SSR baseline.
 */
export function SiteHeader({
  brand = "Acme Corp.",
  brandSubtitle = "Acme Corporation",
  brandHref = "/",
  sections = [],
  desktopThemeControl,
  class: cls,
}: SiteHeaderProps) {
  return (
    <header
      class={cx(
        "sticky top-0 z-ui-dropdown w-full border-b border-rail-border bg-rail-bg-strong text-rail-fg max-sm:hidden",
        cls,
      )}
      aria-label="Global header"
    >
      <div class="flex h-[4rem] items-center gap-hsp-lg px-hsp-xl">
        <a class="flex items-center gap-hsp-sm no-underline text-rail-fg hover:text-rail-fg" href={brandHref}>
          <span
            class="grid h-[2.5rem] w-[2.5rem] flex-none place-items-center rounded-[10px] bg-accent text-title font-bold leading-none text-bg shadow-[0_2px_8px_-2px_color-mix(in_srgb,var(--color-accent)_60%,transparent)]"
            aria-hidden="true"
          >
            {BRAND_MARK}
          </span>
          <span class="flex flex-col leading-tight">
            <b class="text-title font-bold">{brand}</b>
            <small class="text-caption uppercase tracking-[0.14em] text-rail-muted">{brandSubtitle}</small>
          </span>
        </a>

        {sections.length > 0 && <BrowseDisclosure sections={sections} />}

        <span class="flex-auto" aria-hidden="true" />

        <nav class="flex items-center gap-hsp-md text-small" aria-label="Utility">
          <div class="group/search flex items-center">
            <form role="search" action="/search" method="get" data-search-form class="flex items-center">
              <button
                type="button"
                data-search-trigger
                aria-expanded="false"
                aria-controls={SEARCH_INPUT_ID}
                aria-label="Search"
                class="grid h-[2rem] w-[2rem] flex-none place-items-center rounded-full border border-current text-rail-muted transition-colors hover:text-rail-fg focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rail-fg"
              >
                <span aria-hidden="true">⌕</span>
              </button>
              <input
                type="search"
                name="q"
                id={SEARCH_INPUT_ID}
                data-search-input
                placeholder="Search the site"
                aria-label="Search keywords"
                class="ml-0 w-0 origin-left overflow-hidden border-0 bg-transparent p-0 text-small text-rail-fg opacity-0 outline-none transition-[width,opacity,margin] placeholder:text-rail-muted focus-visible:outline-none group-focus-within/search:ml-hsp-xs group-focus-within/search:w-[12rem] group-focus-within/search:opacity-100"
              />
              <button type="submit" class="sr-only">
                Search
              </button>
            </form>
          </div>

          {desktopThemeControl && (
            <div data-theme-control="desktop" class="flex">
              {desktopThemeControl}
            </div>
          )}
          <a class={UTIL_LINK_CLASS} href="/ir">
            Investors
          </a>
          <a class={UTIL_LINK_CLASS} href="/recruit">
            Careers
          </a>
          <a class={UTIL_LINK_CLASS} href="/contact">
            Contact
          </a>
          <span class="h-[1.25rem] w-px bg-rail-border" aria-hidden="true" />
          <span class="text-caption tracking-[0.05em] text-rail-muted">
            <b class="font-bold text-rail-fg">EN</b>
            {" / "}
            <span class="text-rail-muted">JP</span>
          </span>
        </nav>
      </div>
    </header>
  );
}

/**
 * The group spans the full header height so there is no hover gap between the
 * trigger and anchored panel. This is intentionally a normal navigation list,
 * not a card switcher: every item comes from the same tree as SiteNav.
 */
function BrowseDisclosure({ sections }: { sections: NavSection[] }) {
  return (
    <div class="group/ctx flex h-[4rem] items-center">
      <button
        type="button"
        data-ctx-trigger
        aria-expanded="false"
        aria-controls={CTX_PANEL_ID}
        aria-label="Browse site sections"
        class="inline-flex min-h-[44px] min-w-[44px] items-center gap-hsp-xs rounded-md border border-rail-border bg-rail-hover-bg px-hsp-md py-vsp-2xs text-small font-semibold text-rail-fg transition-colors hover:bg-rail-bg hover:underline hover:underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rail-fg"
      >
        Browse
        <span
          class="text-caption text-rail-muted transition-transform group-hover/ctx:rotate-180 group-focus-within/ctx:rotate-180"
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      <nav
        id={CTX_PANEL_ID}
        data-ctx-panel
        class="invisible pointer-events-none absolute left-1/2 top-full z-ui-dropdown w-[min(calc(100vw-2rem),72rem)] -translate-x-1/2 -translate-y-[6px] border border-rail-border bg-rail-bg-strong opacity-0 shadow-[0_24px_48px_-24px_color-mix(in_srgb,var(--color-fg)_60%,transparent)] transition-[opacity,transform,visibility]
          group-hover/ctx:visible group-hover/ctx:pointer-events-auto group-hover/ctx:translate-y-0 group-hover/ctx:opacity-100
          group-focus-within/ctx:visible group-focus-within/ctx:pointer-events-auto group-focus-within/ctx:translate-y-0 group-focus-within/ctx:opacity-100"
        aria-label="Browse site sections"
      >
        <div class="max-h-[min(32rem,calc(100dvh-4rem))] overflow-y-auto p-hsp-lg">
          <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-x-hsp-xl gap-y-vsp-lg">
            {sections.map((section, index) => (
              <BrowseCategory key={`${section.label}-${index}`} section={section} index={index} />
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}

function BrowseCategory({ section, index }: { section: NavSection; index: number }) {
  const labelId = `zui-browse-category-${index}`;
  // SiteNav omits `href` when the section's own index page is already its
  // first direct child (the rail must not repeat a self-link). The Browse
  // walk needs a linked category heading, so that first real destination is
  // the section's effective own href in this representation.
  const categoryHref = section.href ?? section.children[0]?.href;
  return (
    <section aria-labelledby={labelId}>
      <h2 id={labelId} class="mb-vsp-xs text-body font-bold text-rail-fg">
        {categoryHref ? (
          <a
            class="rounded text-inherit no-underline underline-offset-4 hover:text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rail-fg"
            href={categoryHref}
          >
            {section.label}
          </a>
        ) : (
          section.label
        )}
      </h2>
      {section.children.length > 0 && (
        <ul class="flex list-none flex-col gap-vsp-2xs">
          {section.children.map((leaf) => (
            <li key={leaf.slug}>
              <a
                class="inline rounded text-small text-rail-muted no-underline underline-offset-4 hover:text-rail-fg hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rail-fg"
                href={leaf.href}
              >
                {leaf.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
