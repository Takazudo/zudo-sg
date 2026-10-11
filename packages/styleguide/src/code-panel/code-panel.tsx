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

import { computed, For, getScope, signal } from "@takazudo/zfb/zudo-react";
import SourceEditor from "./source-editor.js";
import CopyButton from "./copy-button.js";
import { createPreviewCssOwner } from "./css-injection.js";
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
   * a deterministic title-derived id when the host does not pass one.
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
}: CodePanelProps) {
  const activeVariant = signal(variants[0]?.exportName ?? "");
  const activeIndex = computed(() => Math.max(0, variants.findIndex((v) => v.exportName === activeVariant.value)));
  const active = computed(() => variants[activeIndex.value]);
  const activeItems = computed(() => active.value ? [active.value] : []);
  let debounce: number | undefined;
  let cssOwner: ReturnType<typeof createPreviewCssOwner> | undefined;
  getScope().onActivate(() => {
    const owner = createPreviewCssOwner(previewUrl);
    cssOwner = owner;
    return () => {
      window.clearTimeout(debounce);
      owner.dispose();
      if (cssOwner === owner) cssOwner = undefined;
    };
  });
  // Deterministic fallback agrees between SSR and hydration; hosts should pass
  // a unique slug when rendering multiple panels for the same story title.
  const tabsId = `sg-code-panel-${slug ?? encodeURIComponent(storyTitle)}`;

  const tabId = (index: number): string => `${tabsId}-tab-${index}`;
  const panelId = `${tabsId}-panel`;

  function handleCssChange(css: string): void {
    const owner = cssOwner;
    if (!owner) return;
    owner.set("live", css);
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => owner.apply(), 250);
  }

  function onTabKeyDown(e: KeyboardEvent, index: number): void {
    handleTablistKeyDown(
      e,
      index,
      variants.length,
      (next) => {
        const target = variants[next];
        if (target) activeVariant.value = target.exportName;
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
          <h2 class="text-small font-semibold uppercase tracking-wide text-sg-muted">
            Source
          </h2>
          <For each={activeItems} by={(v) => v.exportName}>{(v) => (
            <CopyButton text={v.value.source} label="Copy source" />
          )}</For>
        </div>
        {variants.length > 1 && (
          <div
            role="tablist"
            aria-label="Source variant"
            class="mt-vsp-2xs flex flex-wrap gap-hsp-2xs"
          >
            {variants.map((v, index) => {
              const selected = computed(() => index === activeIndex.value);
              return (
                <button
                  id={tabId(index)}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={panelId}
                  tabindex={computed(() => selected.value ? 0 : -1)}
                  on:click={() => { activeVariant.value = v.exportName; }}
                  on:keydown={(e) => onTabKeyDown(e, index)}
                  class={computed(() =>
                    "px-hsp-xs py-vsp-3xs text-xs rounded-sm border transition-colors " +
                    (selected.value
                      ? "border-sg-accent bg-sg-accent text-sg-on-accent"
                      : "border-sg-border text-sg-muted hover:text-sg-fg")
                  )}
                >
                  {v.name}
                </button>
              );
            })}
          </div>
        )}
        {variants.length > 0 && (
          <div
            class="sg-code-source mt-vsp-xs"
            data-sg-code-region="source"
            {...(variants.length > 1
              ? {
                  id: panelId,
                  role: "tabpanel",
                  "aria-labelledby": computed(() => tabId(activeIndex.value)),
                }
              : {})}
          >
            <For each={activeItems} by={(v) => v.exportName}>{(v) => (
              <SourceEditor
                value={v.value.source}
                language="tsx"
                editable={false}
                label={`Source code for ${storyTitle}: ${v.value.name}`}
              />
            )}</For>
          </div>
        )}
      </div>

      <div class="sg-code-live-css flex min-h-0 flex-1 flex-col" data-sg-code-region="live-css">
        <h2 class="text-small font-semibold uppercase tracking-wide text-sg-muted">
          Live CSS
        </h2>
        <p class="mt-vsp-3xs text-xs text-sg-muted">
          Injected into the previews above. {storyTitle}
        </p>
        <div class="mt-vsp-xs min-h-0 flex-1">
          <SourceEditor
            value={STARTER_CSS}
            language="css"
            editable
            onChange={handleCssChange}
            label={`Live CSS for ${storyTitle}`}
          />
        </div>
      </div>
    </div>
  );
}
