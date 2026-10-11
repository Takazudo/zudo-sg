"use client";

// The component-detail workbench (#541): ONE island that owns the page-level
// toolbar and renders every variant stage below it.
//
// Why one island rather than a toolbar that broadcasts:
//   Theme and viewport used to be per-stage state, so a 4-variant component
//   shipped the same 7 controls four times (28 buttons on a 4-variant page)
//   and "show this in dark" cost four clicks. Hoisting them to a page-level
//   toolbar that DISPATCHED an event would have been worse than it looks: the
//   stages hydrate lazily, so a fire-and-forget event is missed by every stage
//   that has not mounted yet, and it would silently keep its default. Owning
//   the state here and passing it DOWN AS PROPS means a stage adopts the
//   current values whenever it mounts. There is a regression test for exactly
//   that (`__tests__/detail-workbench.test.tsx`, `e2e/detail-workbench.spec.ts`).
//
// The toolbar also carries the two controls that used to be overlaid onto the
// framework header: the code-panel toggle and the Preview-tokens trigger.
// The toggle MUST live outside `#sg-code-panel` — `:root[data-sg-code-panel-hidden]
// #sg-code-panel { display: none }` would otherwise hide the control that
// un-hides the panel, permanently, including on reload from persisted state.
// The site-wide Design Tokens icon is a separate, untouched control shipped
// through `settings.headerRightItems`; there are two token panels by design
// (src/content/docs/overview/token-panels.mdx).
//
// A variant's OWN story-prop controls are not hoisted — they stay with their
// variant inside the stage (see ./variant-frame.tsx).
//
// Host-controlled props (#883) let a foreign host (the pgen pilot) drive the
// workbench instead of wrapping it: `selection` (one live frame behind variant
// tabs), `theme` (host owns theme; no `sg:setTheme`), `previewParams` (extra
// frame-URL query), `sizing` (fixed height), and `toolbar` (per-group flags).
// Every default reproduces the pre-#883 output, EXCEPT `toolbar.codePanel` and
// `toolbar.tokenPanel`, which default OFF: a standalone workbench has no code
// panel or preview token panel to drive, and a dead control is the bug (#872).
// The engine's own detail route opts both back in.

import {
  signal,
  computed,
  getScope,
  Show,
  type Description,
} from "@takazudo/zfb/zudo-react";
import type { StoryControl } from "../stories/index.js";
import VariantFrame from "./variant-frame.js";
import {
  DEFAULT_THEME_MODE,
  DEFAULT_VIEWPORT_ID,
  THEME_OPTIONS,
  VIEWPORTS,
  type FrameThemeMode,
  type ThemeMode,
  type ViewportId,
} from "./variant-frame-config.js";
import {
  ATTR_CODE_PANEL_HIDDEN,
  isCodePanelHidden,
  toggleCodePanel,
} from "../chrome/panel-contract.js";
import { handleTablistKeyDown } from "../shared/tablist-keyboard.js";

/** How the stages are arranged in the preview column. */
type StageLayout = "stacked" | "grid";

interface LayoutOption {
  id: StageLayout;
  label: string;
}

const LAYOUT_OPTIONS: LayoutOption[] = [
  { id: "stacked", label: "Stacked" },
  { id: "grid", label: "Grid" },
];

// Full class literals (never composed from fragments at runtime) so Tailwind
// v4's source scanner emits every utility used here.
const TRACK_CLASS =
  "flex flex-wrap items-center gap-hsp-2xs rounded-md border border-sg-border bg-sg-surface-2 p-hsp-2xs";
const SEGMENT_BASE_CLASS =
  "rounded-sm border px-hsp-sm py-vsp-3xs text-caption leading-normal transition-colors cursor-pointer ";
// Selection is carried by the border ladder + a raised surface, not by a
// filled accent: three segmented groups plus the code panel's own variant tabs
// would blow the one-filled-accent-per-viewport budget on a single page.
const SEGMENT_ON_CLASS = "border-sg-border-strong bg-sg-surface text-sg-fg";
const SEGMENT_OFF_CLASS = "border-transparent text-sg-muted hover:text-sg-fg";
const PILL_BASE_CLASS =
  "inline-flex items-center gap-hsp-2xs rounded-md border px-hsp-sm py-vsp-3xs text-caption leading-normal transition-colors cursor-pointer ";
const PILL_ON_CLASS = "border-sg-border-strong bg-sg-surface-2 text-sg-fg";
const PILL_OFF_CLASS =
  "border-sg-border bg-sg-surface text-sg-muted hover:text-sg-fg";

// `items-start` keeps every stage at its natural height: a variant with a
// controls panel must not stretch its neighbour's preview area into dead space.
const STACKED_GRID_CLASS =
  "grid items-start gap-x-hsp-xl gap-y-vsp-xl grid-cols-1";
// auto-fit against the real column width rather than a page media query: the
// preview column is the code panel's width narrower than the page, so a
// breakpoint would be wrong half the time. The 18rem floor is what makes Grid
// give two columns in the default open-panel layout instead of silently
// collapsing back to one; `min(...,100%)` keeps a narrower column from
// overflowing its track.
const COLUMNS_GRID_CLASS =
  "grid items-start gap-x-hsp-xl gap-y-vsp-xl grid-cols-[repeat(auto-fit,minmax(min(18rem,100%),1fr))]";

/** One variant, flattened to the JSON-serializable shape an island can take. */
export interface WorkbenchVariant {
  /** Story export name (e.g. "Variants"). */
  exportName: string;
  /** Human label shown above the preview. */
  name: string;
  /** Declarative control descriptors (metadata only). */
  controls?: StoryControl[];
}

/**
 * `all` (default) renders one stage per variant. `single` renders variant tabs
 * and exactly one live stage, switched by props (no remount). `active` makes
 * the selection controlled; without it the first variant starts selected.
 */
export type WorkbenchSelection =
  | { mode: "all" }
  | {
      mode: "single";
      active?: string;
      onChange?: (exportName: string) => void;
    };

/**
 * `toolbar` (default) renders the Follow/Light/Dark group and posts
 * `sg:setTheme`. `host` renders no theme group and never posts `sg:setTheme`.
 */
export type WorkbenchTheme = { mode: "toolbar" } | { mode: "host" };

/**
 * `auto` (default) sizes each frame from its `sg:height` reports. `fixed`
 * pins every frame to `height` px and ignores `sg:height`.
 */
export type WorkbenchSizing =
  | { mode: "auto" }
  | { mode: "fixed"; height: number };

/**
 * Per-group toolbar flags. A false group does not render at all; with every
 * group hidden no toolbar box renders.
 */
export interface WorkbenchToolbar {
  /** Viewport preset group. Default `true`. */
  viewport?: boolean;
  /** Stacked/Grid layout group. Default `true`. */
  layout?: boolean;
  /** Code-panel toggle. Default `false` — only a page with a code panel should enable it. */
  codePanel?: boolean;
  /** Preview-tokens trigger. Default `false` — only a page mounting the preview token panel should enable it. */
  tokenPanel?: boolean;
}

export interface DetailWorkbenchProps {
  slug: string;
  variants: WorkbenchVariant[];
  /** Base-prefixed preview route URL, forwarded to every stage (see VariantFrame). */
  previewUrl?: string;
  /** Iframe `sandbox` tokens, forwarded to every stage (see VariantFrame). */
  frameSandbox?: readonly string[];
  /** Iframe `allow` directives, forwarded to every stage (see VariantFrame). */
  frameAllow?: readonly string[];
  /** Variant presentation. Default `{ mode: "all" }`. */
  selection?: WorkbenchSelection;
  /** Who owns the preview theme. Default `{ mode: "toolbar" }`. */
  theme?: WorkbenchTheme;
  /**
   * Extra query params appended, URL-encoded, to every frame URL after
   * `slug`/`variant`. The reserved keys `slug` and `variant` are ignored.
   */
  previewParams?: Readonly<Record<string, string>>;
  /** Frame height policy. Default `{ mode: "auto" }`. */
  sizing?: WorkbenchSizing;
  /** Which toolbar groups render. */
  toolbar?: WorkbenchToolbar;
}

const TABLIST_CLASS =
  "flex flex-wrap items-center gap-hsp-2xs border-b border-sg-border";
const TAB_BASE_CLASS =
  "-mb-px rounded-t-sm border-b-2 px-hsp-sm py-vsp-2xs text-caption leading-normal transition-colors cursor-pointer ";
const TAB_ON_CLASS = "border-sg-border-strong text-sg-fg";
const TAB_OFF_CLASS = "border-transparent text-sg-muted hover:text-sg-fg";

function segmentClass(selected: boolean): string {
  return SEGMENT_BASE_CLASS + (selected ? SEGMENT_ON_CLASS : SEGMENT_OFF_CLASS);
}

function tabClass(selected: boolean): string {
  return TAB_BASE_CLASS + (selected ? TAB_ON_CLASS : TAB_OFF_CLASS);
}

export default function DetailWorkbench({
  slug,
  variants,
  previewUrl,
  frameSandbox,
  frameAllow,
  selection = { mode: "all" },
  theme = { mode: "toolbar" },
  previewParams,
  sizing = { mode: "auto" },
  toolbar = {},
}: DetailWorkbenchProps): Description {
  const scope = getScope();
  const themeMode = signal<ThemeMode>(DEFAULT_THEME_MODE);
  const viewportId = signal<ViewportId>(DEFAULT_VIEWPORT_ID);
  const layout = signal<StageLayout>("stacked");
  const codePanelShown = signal(true);
  const internalActive = signal<string | undefined>(undefined);
  // Derived from the slug, not `useId`, so the ids an island hydrates against
  // match its SSR output without depending on render-tree position.
  const tabsId = `sg-workbench-${slug}`;

  const showTheme = theme.mode === "toolbar";
  const showViewport = toolbar.viewport ?? true;
  const showLayout = toolbar.layout ?? true;
  const showCodePanel = toolbar.codePanel ?? false;
  const showTokenPanel = toolbar.tokenPanel ?? false;
  const showToolbar =
    showTheme || showViewport || showLayout || showCodePanel || showTokenPanel;

  const frameThemeMode = computed<FrameThemeMode>(() =>
    showTheme ? themeMode.value : "none",
  );
  const fixedHeight = sizing.mode === "fixed" ? sizing.height : undefined;

  // The panel's hidden state is restored onto <html> by the blocking head
  // script before first paint, and survives SPA swaps, so read it after mount
  // rather than guessing during SSR. Observing the attribute keeps
  // `aria-pressed` honest no matter who flipped it.
  scope.onActivate(() => {
    if (!showCodePanel) return;
    const sync = (): void => {
      codePanelShown.value = !isCodePanelHidden();
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [ATTR_CODE_PANEL_HIDDEN],
    });
    return () => observer.disconnect();
  });

  function openPreviewTokenPanel(): void {
    window.dispatchEvent(new CustomEvent("toggle-preview-token-panel"));
  }

  // Single mode: a controlled `active` wins; otherwise internal state. Either
  // falls back to the first variant when it names no current variant.
  const single = selection.mode === "single";
  const activeVariant = computed(() => {
    const requested =
      selection.mode === "single"
        ? (selection.active ?? internalActive.value)
        : undefined;
    return variants.find((v) => v.exportName === requested) ?? variants[0];
  });

  function selectVariant(exportName: string): void {
    if (selection.mode !== "single") return;
    if (selection.active === undefined) internalActive.value = exportName;
    selection.onChange?.(exportName);
  }

  function onTabKeyDown(e: KeyboardEvent, index: number): void {
    handleTablistKeyDown(
      e,
      index,
      variants.length,
      (next) => {
        const target = variants[next];
        if (target) selectVariant(target.exportName);
      },
      (next) => {
        const tablist = (e.currentTarget as HTMLElement).parentElement;
        (tablist?.children[next] as HTMLElement | undefined)?.focus();
      },
    );
  }

  function renderStage(variant: WorkbenchVariant): Description {
    return (
      <VariantFrame
        slug={slug}
        exportName={variant.exportName}
        name={variant.name}
        controls={variant.controls}
        themeMode={frameThemeMode}
        viewportId={viewportId}
        previewUrl={previewUrl}
        frameSandbox={frameSandbox}
        frameAllow={frameAllow}
        previewParams={previewParams}
        fixedHeight={fixedHeight}
      />
    );
  }

  const tabId = (index: number): string => `${tabsId}-tab-${index}`;
  const panelId = `${tabsId}-panel`;
  const activeIndex = computed(() =>
    activeVariant.value ? variants.indexOf(activeVariant.value) : -1,
  );

  return (
    <div>
      {showToolbar && (
        <div class="sg-workbench-toolbar">
          {showTheme && (
            <div role="group" aria-label="Preview theme" class={TRACK_CLASS}>
              {THEME_OPTIONS.map((option) => (
                <button
                  type="button"
                  on:click={() => {
                    themeMode.value = option.id;
                  }}
                  aria-pressed={computed(() => themeMode.value === option.id)}
                  class={computed(() =>
                    segmentClass(themeMode.value === option.id),
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {showViewport && (
            <div role="group" aria-label="Preview viewport" class={TRACK_CLASS}>
              {VIEWPORTS.map((preset) => (
                <button
                  type="button"
                  on:click={() => {
                    viewportId.value = preset.id;
                  }}
                  aria-pressed={computed(() => viewportId.value === preset.id)}
                  class={computed(() =>
                    segmentClass(viewportId.value === preset.id),
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          {showLayout && (
            <div role="group" aria-label="Preview layout" class={TRACK_CLASS}>
              {LAYOUT_OPTIONS.map((option) => (
                <button
                  type="button"
                  on:click={() => {
                    layout.value = option.id;
                  }}
                  aria-pressed={computed(() => layout.value === option.id)}
                  class={computed(() =>
                    segmentClass(layout.value === option.id),
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {(showCodePanel || showTokenPanel) && (
            <div class="ms-auto flex flex-wrap items-center gap-hsp-sm">
              {showCodePanel && (
                <button
                  type="button"
                  on:click={() => toggleCodePanel()}
                  aria-pressed={codePanelShown}
                  title="Toggle code panel"
                  class={computed(
                    () =>
                      PILL_BASE_CLASS +
                      (codePanelShown.value ? PILL_ON_CLASS : PILL_OFF_CLASS),
                  )}
                >
                  {/* Code/brackets glyph — feather `<>` style, matched to the chrome
                      icon set (20×20 viewBox, stroke-width 2). */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  Code panel
                </button>
              )}
              {showTokenPanel && (
                <button
                  type="button"
                  on:click={openPreviewTokenPanel}
                  title="Edit the design tokens used inside the preview iframes"
                  class={PILL_BASE_CLASS + PILL_OFF_CLASS}
                >
                  {/* Stacked-frames / layers glyph — evokes "preview iframe tokens".
                      Cohesive matched pair with the root-header Design Tokens sliders
                      glyph: same 20×20 viewBox, feather stroke-width 2, distinct
                      shape. */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="3" width="13" height="13" rx="1.5" />
                    <path d="M8 8h12.5A1.5 1.5 0 0 1 22 9.5V20a1.5 1.5 0 0 1-1.5 1.5H10A1.5 1.5 0 0 1 8.5 20" />
                  </svg>
                  Preview tokens
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {single && (
        <div role="tablist" aria-label="Variants" class={TABLIST_CLASS}>
          {variants.map((variant, index) => {
            const selected = computed(() => index === activeIndex.value);
            return (
              <button
                id={tabId(index)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabindex={computed(() => (selected.value ? 0 : -1))}
                on:click={() => selectVariant(variant.exportName)}
                on:keydown={(e) => onTabKeyDown(e, index)}
                class={computed(() => tabClass(selected.value))}
              >
                {variant.name}
              </button>
            );
          })}
        </div>
      )}

      <div
        data-sg-stage-grid={layout}
        class={computed(() =>
          layout.value === "grid" ? COLUMNS_GRID_CLASS : STACKED_GRID_CLASS,
        )}
        {...(single
          ? {
              id: panelId,
              role: "tabpanel",
              "aria-labelledby": computed(() =>
                activeIndex.value >= 0 ? tabId(activeIndex.value) : undefined,
              ),
            }
          : {})}
      >
        {single ? (
          <Show when={computed(() => !!activeVariant.value)}>
            {() => (
              <VariantFrame
                slug={slug}
                exportName={computed(() => activeVariant.value!.exportName)}
                name={computed(() => activeVariant.value!.name)}
                controls={computed(() => activeVariant.value?.controls)}
                themeMode={frameThemeMode}
                viewportId={viewportId}
                previewUrl={previewUrl}
                frameSandbox={frameSandbox}
                frameAllow={frameAllow}
                previewParams={previewParams}
                fixedHeight={fixedHeight}
              />
            )}
          </Show>
        ) : (
          variants.map((variant) => renderStage(variant))
        )}
      </div>
    </div>
  );
}
