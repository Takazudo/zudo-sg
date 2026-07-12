import { cx } from "../../lib/cx";
import { AutoGrid } from "../../shared/auto-grid/auto-grid";
import { PlaceholderBox } from "../../media/placeholder-box/placeholder-box";

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

/** One brand-switcher entry: the persistent corporate brand, or a business line. */
export type BrandSwitcherItem = {
  /** Stable identifier, e.g. "corporate" or a line key. */
  key: string;
  /** Short label shown on the trigger pill and the switcher card. */
  label: string;
  href: string;
  /** 1–2 char glyph shown in the card's logo-stand-in mark. */
  mark: string;
  /** One-sentence card descriptor. */
  description: string;
  /** Standalone domain, informational only — not rendered by this component. */
  domain: string;
  /** Whether this is the active context (drives `aria-current` + accent emphasis). */
  current: boolean;
};

export type SiteHeaderProps = {
  /** Brand name, always the persistent corporate brand (never per-line). */
  brand?: string;
  brandSubtitle?: string;
  /** Brand link target, always the corporate home. */
  brandHref?: string;
  /** Corporate + line entries. The first `current: true` item labels the trigger. */
  switcherItems: BrandSwitcherItem[];
  class?: string;
};

const BRAND_MARK = "D";

const UTIL_LINK_CLASS =
  "inline-flex items-center gap-hsp-2xs whitespace-nowrap text-rail-muted no-underline transition-colors hover:text-rail-fg focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rail-fg";

/**
 * Full-width sticky global header: brand lockup, business-context switcher,
 * and a utility nav (search, IR, careers, contact, locale).
 *
 * Binds only to `rail-*` / `accent` tokens (no navy literals) so a
 * `[data-line]` override (single `--color-accent` swap) re-themes the switcher
 * trigger dot, marks, and current-card emphasis with zero markup changes.
 *
 * The context-switcher panel discloses with pure CSS (`group/ctx` hover /
 * focus-within) — it works with no JS. Mount `ContextSwitcherEnhancer`
 * (chrome/context-switcher-enhancer) anywhere on the page, wrapped in the
 * consumer's own `<Island ssrFallback={null}>`, to add aria-expanded sync,
 * click-to-pin, and Escape/outside-click close. Same for the search toggle
 * and `SearchToggleEnhancer` (chrome/search-toggle-enhancer).
 *
 * Hidden below `sm` — a slim top bar + off-canvas drawer (site-nav.tsx) takes
 * over there so the mega-panel's `z-ui-dropdown` stacking never fights the
 * mobile hamburger.
 */
export function SiteHeader({
  brand = "Acme Corp.",
  brandSubtitle = "Acme Corporation",
  brandHref = "/",
  switcherItems,
  class: cls,
}: SiteHeaderProps) {
  const currentItem = switcherItems.find((item) => item.current) ?? switcherItems[0];

  return (
    <header
      class={cx(
        "sticky top-0 z-ui-dropdown w-full border-b border-rail-border bg-rail-bg-strong text-rail-fg max-sm:hidden",
        cls,
      )}
      aria-label="Global header"
    >
      <div class="flex h-[4rem] items-center gap-hsp-lg px-hsp-xl max-sm:h-auto max-sm:flex-wrap max-sm:gap-hsp-sm max-sm:py-vsp-xs max-sm:px-hsp-md">
        {/* 1. Brand lockup — always the corporate brand / home. */}
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

        {/* 2. Context switcher (pure-CSS disclosure).
         * `group/ctx` spans the full header height (not just the pill) so the
         * hover box reaches all the way to the panel's `top-full` edge — with
         * a shorter group, the gap between pill and panel falls outside
         * group-hover and moving the pointer from trigger to panel closes it
         * before it's reached. */}
        <div class="group/ctx flex h-[4rem] items-center max-sm:hidden">
          <button
            type="button"
            data-ctx-trigger
            aria-expanded="false"
            aria-controls={CTX_PANEL_ID}
            class="inline-flex items-center gap-hsp-xs whitespace-nowrap rounded-full border border-rail-border bg-rail-hover-bg px-hsp-md py-vsp-2xs text-small font-medium text-rail-fg transition-colors hover:bg-rail-hover-bg focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rail-fg"
          >
            <span class="text-rail-muted">Viewing</span>
            <span
              class="h-[0.6rem] w-[0.6rem] flex-none rounded-full bg-accent shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-accent)_22%,transparent)]"
              aria-hidden="true"
            />
            <b class="font-bold">{currentItem?.label}</b>
            <span
              class="text-caption text-rail-muted transition-transform group-hover/ctx:rotate-180 group-focus-within/ctx:rotate-180"
              aria-hidden="true"
            >
              ▾
            </span>
          </button>

          <ContextPanel items={switcherItems} />
        </div>

        <span class="flex-auto max-sm:hidden" aria-hidden="true" />

        {/* 3. Utility nav (right). */}
        <nav
          class="flex items-center gap-hsp-md text-small max-sm:w-full max-sm:gap-hsp-sm max-sm:text-caption"
          aria-label="Utility"
        >
          {/* Search: icon trigger + inline expanding input, both scoped under
           * `group/search` (separate from `group/ctx` so they never open
           * together). Baseline disclosure is `focus-within`; submits via a
           * plain GET form so it works with no JS. */}
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

          <a class={UTIL_LINK_CLASS} href="/ir">
            Investors
          </a>
          <a class={UTIL_LINK_CLASS} href="/recruit">
            Careers
          </a>
          <a class={UTIL_LINK_CLASS} href="/contact">
            Contact
          </a>
          <span class="h-[1.25rem] w-px bg-rail-border max-sm:hidden" aria-hidden="true" />
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
 * Context mega-panel. Visible via `group-hover/ctx` or `group-focus-within/ctx`
 * (hidden by default: invisible + opacity-0 + pointer-events-none, so it's
 * also out of tab order and hidden from assistive tech until shown).
 * `data-ctx-panel` is the enhancer's Escape/outside-click + aria-sync target.
 */
function ContextPanel({ items }: { items: BrandSwitcherItem[] }) {
  return (
    <div
      id={CTX_PANEL_ID}
      data-ctx-panel
      class="invisible pointer-events-none absolute inset-x-0 top-full z-ui-dropdown -translate-y-[6px] border-b border-rail-border bg-rail-bg-strong px-hsp-xl pb-vsp-lg pt-vsp-md opacity-0 shadow-[0_24px_48px_-24px_color-mix(in_srgb,var(--color-fg)_60%,transparent)] transition-[opacity,transform,visibility]
        group-hover/ctx:visible group-hover/ctx:pointer-events-auto group-hover/ctx:translate-y-0 group-hover/ctx:opacity-100
        group-focus-within/ctx:visible group-focus-within/ctx:pointer-events-auto group-focus-within/ctx:translate-y-0 group-focus-within/ctx:opacity-100"
      role="group"
      aria-label="Switch business context"
    >
      <p class="mb-vsp-sm text-caption font-bold uppercase tracking-[0.08em] text-rail-muted">Browse by business</p>
      <AutoGrid min="13rem" gap="md">
        {items.map((item) => (
          <ContextCard key={item.key} item={item} />
        ))}
      </AutoGrid>
    </div>
  );
}

const CARD_BASE =
  "relative flex flex-col gap-vsp-2xs overflow-hidden rounded-lg border bg-rail-bg px-hsp-md pb-vsp-md pt-vsp-sm no-underline transition-[border-color,box-shadow,transform] hover:-translate-y-[2px] hover:shadow-[0_10px_24px_-12px_color-mix(in_srgb,var(--color-accent)_70%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const CARD_CURRENT = " border-accent shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-accent)_45%,transparent)]";
const CARD_INACTIVE = " border-rail-border hover:border-accent";

/**
 * One switcher card: photo slot + mark + label + descriptor. The current item
 * gets `aria-current="location"` (the href isn't necessarily the exact page,
 * so `page` would be inaccurate) plus an accent border/ring.
 */
function ContextCard({ item }: { item: BrandSwitcherItem }) {
  const current = item.current;
  return (
    <a
      href={item.href}
      aria-current={current ? "location" : undefined}
      data-ctx-card-key={item.key}
      class={CARD_BASE + (current ? CARD_CURRENT : CARD_INACTIVE)}
    >
      <PlaceholderBox
        label="Product photo"
        aspect="16/10"
        class="mb-vsp-xs w-full border-rail-border bg-rail-bg text-rail-muted"
      />
      <span class="flex items-center gap-hsp-xs">
        <span
          class="grid h-[2rem] w-[2rem] flex-none place-items-center rounded-[8px] bg-accent text-small font-bold text-bg"
          aria-hidden="true"
        >
          {item.mark}
        </span>
        <b class="text-body font-bold text-rail-fg">{item.label}</b>
      </span>
      <small class="text-caption leading-snug text-rail-muted">{item.description}</small>
    </a>
  );
}
