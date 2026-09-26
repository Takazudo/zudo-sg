"use client";

// Right-region code panel for a story detail page. Two parts:
//
//   1. SOURCE — a read-only CodeMirror view per variant, showing the verbatim
//      `Story.source` (or the component `meta.usage` fallback). This is the
//      contract-promised source (STORIES.md §5); no fs/AST extraction is
//      available on this host.
//   2. LIVE CSS — an editable CodeMirror CSS buffer whose text is injected,
//      debounced, into every preview iframe on the page (the live CSS-injection
//      feature). Edit a rule here and the previews restyle without reload.
//
// Props are JSON-serializable strings (island boundary), so the panel takes the
// pre-resolved source strings, not the Story objects.

import type { JSX } from "preact";
import { useId, useRef, useState } from "preact/hooks";
import SourceEditor from "./source-editor.js";
import CopyButton from "./copy-button.js";
import { injectCssToAllPreviews } from "./css-injection.js";
import { handleTablistKeyDown } from "../shared/tablist-keyboard.js";

export interface CodePanelVariant {
  exportName: string;
  name: string;
  /** Resolved verbatim source (Story.source ?? meta.usage). */
  source: string;
}

export interface CodePanelProps {
  storyTitle: string;
  variants: CodePanelVariant[];
  /** Base-prefixed preview route URL — the same value DetailWorkbench receives. */
  previewUrl?: string;
  /**
   * Story slug, used to build stable variant-tab/tabpanel ids that match
   * SSR output (mirrors `DetailWorkbench`'s `tabsId`). Falls back to
   * `useId()` when the host doesn't pass one — still unique per page, just
   * not stable across an SSR/hydration boundary.
   */
  slug?: string;
}

const STARTER_CSS = `/* Live CSS — edits inject into every preview above.
   Try overriding a component utility, e.g.:
   .btn { letter-spacing: 0.04em; } */
`;

export default function CodePanel({
  storyTitle,
  variants,
  previewUrl,
  slug,
}: CodePanelProps): JSX.Element {
  const [activeVariant, setActiveVariant] = useState(
    variants[0]?.exportName ?? "",
  );
  const debounceRef = useRef<number | undefined>(undefined);
  const reactId = useId();
  const tabsId = `sg-code-panel-${slug ?? reactId}`;

  const activeIndex = variants.findIndex((v) => v.exportName === activeVariant);
  const active = variants[activeIndex] ?? variants[0];

  const tabId = (index: number): string => `${tabsId}-tab-${index}`;
  const panelId = `${tabsId}-panel`;

  function handleCssChange(css: string): void {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      injectCssToAllPreviews("live", css, previewUrl);
    }, 250);
  }

  function onTabKeyDown(e: KeyboardEvent, index: number): void {
    handleTablistKeyDown(
      e,
      index,
      variants.length,
      (next) => {
        const target = variants[next];
        if (target) setActiveVariant(target.exportName);
      },
      (next) => {
        const tablist = (e.currentTarget as HTMLElement).parentElement;
        (tablist?.children[next] as HTMLElement | undefined)?.focus();
      },
    );
  }

  return (
    <div class="flex h-full flex-col gap-vsp-md p-hsp-md">
      <div>
        <div class="flex items-center justify-between gap-hsp-sm">
          <h2 class="text-small font-semibold uppercase tracking-wide text-[color:var(--sg-muted)]">
            Source
          </h2>
          {active && <CopyButton text={active.source} label="Copy source" />}
        </div>
        {variants.length > 1 && (
          <div
            role="tablist"
            aria-label="Source variant"
            class="mt-vsp-2xs flex flex-wrap gap-hsp-3xs"
          >
            {variants.map((v, index) => {
              const selected = v.exportName === activeVariant;
              return (
                <button
                  key={v.exportName}
                  id={tabId(index)}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={panelId}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveVariant(v.exportName)}
                  onKeyDown={(e) => onTabKeyDown(e, index)}
                  class={
                    "px-hsp-xs py-vsp-3xs text-xs rounded-sm border transition-colors " +
                    (selected
                      ? "border-[color:var(--sg-accent)] bg-[var(--sg-accent)] text-[color:var(--sg-on-accent)]"
                      : "border-[color:var(--sg-border)] text-[color:var(--sg-muted)] hover:text-[color:var(--sg-fg)]")
                  }
                >
                  {v.name}
                </button>
              );
            })}
          </div>
        )}
        {active && (
          <div
            class="mt-vsp-xs"
            {...(variants.length > 1
              ? {
                  id: panelId,
                  role: "tabpanel",
                  "aria-labelledby": activeIndex >= 0 ? tabId(activeIndex) : undefined,
                }
              : {})}
          >
            {/* key remounts SourceEditor per variant: it creates its CodeMirror
                view once and never diffs `value` (see source-editor.tsx), so
                without a key switching tabs kept showing the first variant's
                source (#105). This wrapper's own id/role/aria-labelledby stay
                on the OUTER div, outside the key, so they don't reset when the
                keyed child remounts (#900). */}
            <SourceEditor
              key={active.exportName}
              value={active.source}
              language="tsx"
              editable={false}
            />
          </div>
        )}
      </div>

      <div class="flex min-h-0 flex-1 flex-col">
        <h2 class="text-small font-semibold uppercase tracking-wide text-[color:var(--sg-muted)]">
          Live CSS
        </h2>
        <p class="mt-vsp-3xs text-xs text-[color:var(--sg-muted)]">
          Injected into the previews above. {storyTitle}
        </p>
        <div class="mt-vsp-xs min-h-0 flex-1">
          <SourceEditor
            value={STARTER_CSS}
            language="css"
            editable
            onChange={handleCssChange}
          />
        </div>
      </div>
    </div>
  );
}

// Pin the hydration name explicitly (matches every other island in this
// feature) rather than relying on the minifier preserving `fn.name`.
CodePanel.displayName = "CodePanel";
