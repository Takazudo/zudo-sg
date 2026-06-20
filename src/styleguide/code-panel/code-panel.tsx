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
import { useRef, useState } from "preact/hooks";
import SourceEditor from "./source-editor";
import { injectCssToAllPreviews } from "./css-injection";

export interface CodePanelVariant {
  exportName: string;
  name: string;
  /** Resolved verbatim source (Story.source ?? meta.usage). */
  source: string;
}

export interface CodePanelProps {
  storyTitle: string;
  variants: CodePanelVariant[];
}

const STARTER_CSS = `/* Live CSS — edits inject into every preview above.
   Try overriding a component utility, e.g.:
   .btn { letter-spacing: 0.04em; } */
`;

export default function CodePanel({
  storyTitle,
  variants,
}: CodePanelProps): JSX.Element {
  const [activeVariant, setActiveVariant] = useState(
    variants[0]?.exportName ?? "",
  );
  const debounceRef = useRef<number | undefined>(undefined);

  const active = variants.find((v) => v.exportName === activeVariant) ?? variants[0];

  function handleCssChange(css: string): void {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      injectCssToAllPreviews("live", css);
    }, 250);
  }

  return (
    <div class="flex h-full flex-col gap-vsp-md p-hsp-md">
      <div>
        <h2 class="text-small font-semibold uppercase tracking-wide text-ink-mute">
          Source
        </h2>
        {variants.length > 1 && (
          <div role="tablist" class="mt-vsp-2xs flex flex-wrap gap-hsp-3xs">
            {variants.map((v) => (
              <button
                type="button"
                role="tab"
                aria-selected={v.exportName === activeVariant}
                onClick={() => setActiveVariant(v.exportName)}
                class={
                  "px-hsp-xs py-vsp-3xs text-xs rounded-sm border transition-colors " +
                  (v.exportName === activeVariant
                    ? "border-brand bg-brand text-on-brand"
                    : "border-line text-ink-mute hover:text-ink")
                }
              >
                {v.name}
              </button>
            ))}
          </div>
        )}
        {active && (
          <div class="mt-vsp-xs">
            <SourceEditor value={active.source} language="tsx" editable={false} />
          </div>
        )}
      </div>

      <div class="flex min-h-0 flex-1 flex-col">
        <h2 class="text-small font-semibold uppercase tracking-wide text-ink-mute">
          Live CSS
        </h2>
        <p class="mt-vsp-3xs text-xs text-ink-mute">
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
