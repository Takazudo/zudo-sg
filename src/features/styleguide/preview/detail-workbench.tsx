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
// (src/content/docs/guide/token-panels.mdx).
//
// A variant's OWN story-prop controls are not hoisted — they stay with their
// variant inside the stage (see ./variant-frame.tsx).

import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { StoryControl } from "@zudo-sg/ui";
import VariantFrame, {
  DEFAULT_THEME_MODE,
  DEFAULT_VIEWPORT_ID,
  THEME_OPTIONS,
  VIEWPORTS,
  type ThemeMode,
  type ViewportId,
} from "./variant-frame";
import {
  ATTR_CODE_PANEL_HIDDEN,
  isCodePanelHidden,
  toggleCodePanel,
} from "../chrome/panel-contract";

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
  "flex flex-wrap items-center gap-hsp-2xs rounded-md border border-border bg-surface-2 p-hsp-2xs";
const SEGMENT_BASE_CLASS =
  "rounded-sm border px-hsp-sm py-vsp-3xs text-caption leading-normal transition-colors cursor-pointer ";
// Selection is carried by the border ladder + a raised surface, not by a
// filled accent: three segmented groups plus the code panel's own variant tabs
// would blow the one-filled-accent-per-viewport budget on a single page.
const SEGMENT_ON_CLASS = "border-border-strong bg-surface text-fg";
const SEGMENT_OFF_CLASS = "border-transparent text-muted hover:text-fg";
const PILL_BASE_CLASS =
  "inline-flex items-center gap-hsp-2xs rounded-md border px-hsp-sm py-vsp-3xs text-caption leading-normal transition-colors cursor-pointer ";
const PILL_ON_CLASS = "border-border-strong bg-surface-2 text-fg";
const PILL_OFF_CLASS = "border-border bg-surface text-muted hover:text-fg";

// `items-start` keeps every stage at its natural height: a variant with a
// controls panel must not stretch its neighbour's preview area into dead space.
const STACKED_GRID_CLASS = "grid items-start gap-x-hsp-xl gap-y-vsp-xl grid-cols-1";
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

export interface DetailWorkbenchProps {
  slug: string;
  variants: WorkbenchVariant[];
}

function segmentClass(selected: boolean): string {
  return SEGMENT_BASE_CLASS + (selected ? SEGMENT_ON_CLASS : SEGMENT_OFF_CLASS);
}

export default function DetailWorkbench({
  slug,
  variants,
}: DetailWorkbenchProps): JSX.Element {
  const [themeMode, setThemeMode] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [viewportId, setViewportId] = useState<ViewportId>(DEFAULT_VIEWPORT_ID);
  const [layout, setLayout] = useState<StageLayout>("stacked");
  const [codePanelShown, setCodePanelShown] = useState(true);

  // The panel's hidden state is restored onto <html> by the blocking head
  // script before first paint, and survives SPA swaps, so read it after mount
  // rather than guessing during SSR. Observing the attribute keeps
  // `aria-pressed` honest no matter who flipped it.
  useEffect(() => {
    const sync = (): void => setCodePanelShown(!isCodePanelHidden());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [ATTR_CODE_PANEL_HIDDEN],
    });
    return () => observer.disconnect();
  }, []);

  function openPreviewTokenPanel(): void {
    window.dispatchEvent(new CustomEvent("toggle-preview-token-panel"));
  }

  return (
    <div>
      <div class="sg-workbench-toolbar">
        <div role="group" aria-label="Preview theme" class={TRACK_CLASS}>
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setThemeMode(option.id)}
              aria-pressed={themeMode === option.id}
              class={segmentClass(themeMode === option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div role="group" aria-label="Preview viewport" class={TRACK_CLASS}>
          {VIEWPORTS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setViewportId(preset.id)}
              aria-pressed={viewportId === preset.id}
              class={segmentClass(viewportId === preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div role="group" aria-label="Preview layout" class={TRACK_CLASS}>
          {LAYOUT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setLayout(option.id)}
              aria-pressed={layout === option.id}
              class={segmentClass(layout === option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div class="ms-auto flex flex-wrap items-center gap-hsp-sm">
          <button
            type="button"
            onClick={() => toggleCodePanel()}
            aria-pressed={codePanelShown}
            title="Toggle code panel"
            class={
              PILL_BASE_CLASS +
              (codePanelShown ? PILL_ON_CLASS : PILL_OFF_CLASS)
            }
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
          <button
            type="button"
            onClick={openPreviewTokenPanel}
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
        </div>
      </div>

      <div
        data-sg-stage-grid={layout}
        class={layout === "grid" ? COLUMNS_GRID_CLASS : STACKED_GRID_CLASS}
      >
        {variants.map((variant) => (
          <VariantFrame
            key={variant.exportName}
            slug={slug}
            exportName={variant.exportName}
            name={variant.name}
            controls={variant.controls}
            themeMode={themeMode}
            viewportId={viewportId}
          />
        ))}
      </div>
    </div>
  );
}

DetailWorkbench.displayName = "DetailWorkbench";
