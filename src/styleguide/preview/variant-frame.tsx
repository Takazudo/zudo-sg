"use client";

// Parent-side host for ONE story variant: an isolated preview iframe plus a
// viewport switcher and (optional) a read-only controls summary. Adapted from
// zzmod's `variant-frame.tsx`.
//
// The iframe loads `/sg/preview?slug=…&variant=…`; the same-origin route gives
// the preview the main CSS bundle and CSS isolation (its own document). Height
// is driven by the `sg:height` message the preview posts back. The iframe is
// registered with the token-tweak registry so design-token tweaks live-update
// it.

import type { JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { StoryControl } from "@zudo-sg/ui";
import { withBase } from "@/utils/base";
import { MSG_UPDATE_PROPS, isHeightMessage } from "./messages";
import {
  registerPreviewIframe,
  unregisterPreviewIframe,
} from "../token-tweak/preview-iframe-registry";

interface Viewport {
  id: string;
  label: string;
  width: string;
}

const VIEWPORTS: Viewport[] = [
  { id: "full", label: "Full", width: "100%" },
  { id: "tablet", label: "Tablet", width: "768px" },
  { id: "mobile", label: "Mobile", width: "360px" },
];

export interface VariantFrameProps {
  slug: string;
  /** Story export name (e.g. "Variants"). */
  exportName: string;
  /** Human label shown above the preview. */
  name: string;
  /** Declarative control descriptors (metadata only — see STORIES.md §4). */
  controls?: StoryControl[];
}

function VariantFrame(props: VariantFrameProps): JSX.Element {
  const { slug, exportName, name, controls } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(180);
  const [viewport, setViewport] = useState<Viewport>(VIEWPORTS[0]);

  const src = useMemo(() => {
    const base = withBase("/sg/preview");
    return `${base}?slug=${encodeURIComponent(slug)}&variant=${encodeURIComponent(exportName)}`;
  }, [slug, exportName]);

  // Receive height reports from this variant's iframe only.
  useEffect(() => {
    function onMessage(e: MessageEvent): void {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (isHeightMessage(e.data)) {
        setHeight(Math.max(80, Math.ceil(e.data.height)));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Register/unregister with the token-tweak registry.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    registerPreviewIframe(iframe);
    return () => unregisterPreviewIframe(iframe);
  }, []);

  // Push live control values to the iframe (infrastructure; starter stories'
  // render() ignore props, so this is the channel S7 will bind controls to).
  function sendProps(props: Record<string, unknown>): void {
    iframeRef.current?.contentWindow?.postMessage(
      { type: MSG_UPDATE_PROPS, props },
      "*",
    );
  }

  return (
    <section class="border border-line rounded-md overflow-hidden bg-surface">
      <div class="flex items-center justify-between gap-hsp-md px-hsp-md py-vsp-2xs border-b border-line bg-surface-sunken">
        <span class="text-small font-medium text-ink">{name}</span>
        <div role="group" aria-label="Preview viewport" class="flex gap-hsp-3xs">
          {VIEWPORTS.map((vp) => (
            <button
              type="button"
              onClick={() => setViewport(vp)}
              aria-pressed={viewport.id === vp.id}
              class={
                "px-hsp-xs py-vsp-3xs text-xs rounded-sm border transition-colors " +
                (viewport.id === vp.id
                  ? "border-brand bg-brand text-on-brand"
                  : "border-line text-ink-mute hover:text-ink")
              }
            >
              {vp.label}
            </button>
          ))}
        </div>
      </div>
      <div class="flex justify-center bg-paper p-hsp-md">
        <div style={{ width: viewport.width, maxWidth: "100%" }}>
          <iframe
            ref={iframeRef}
            src={src}
            title={`${slug} — ${name}`}
            loading="lazy"
            sandbox="allow-same-origin allow-scripts"
            style={{
              width: "100%",
              height: `${height}px`,
              border: "0",
              display: "block",
            }}
          />
        </div>
      </div>
      {controls && controls.length > 0 && (
        <div class="border-t border-line px-hsp-md py-vsp-xs">
          <ControlsSummary controls={controls} onChange={sendProps} />
        </div>
      )}
    </section>
  );
}

/**
 * Read-only display of a variant's declared controls. Renders the knobs and
 * forwards changes over the update channel; whether `render()` reads them is
 * the story's concern (STORIES.md §4 — controls are a UI hint, not a binding).
 */
function ControlsSummary({
  controls,
  onChange,
}: {
  controls: StoryControl[];
  onChange: (props: Record<string, unknown>) => void;
}): JSX.Element {
  return (
    <div class="flex flex-col gap-vsp-2xs">
      <p class="text-xs uppercase tracking-wide text-ink-mute">Controls</p>
      <div class="flex flex-wrap gap-hsp-md">
        {controls.map((control) => (
          <label class="flex items-center gap-hsp-2xs text-small text-ink">
            <span class="text-ink-mute">{control.label}</span>
            {control.type === "select" && (
              <select
                class="border border-line rounded-sm bg-surface px-hsp-2xs py-vsp-3xs text-small"
                onChange={(e) =>
                  onChange({ [control.prop]: (e.target as HTMLSelectElement).value })
                }
              >
                {control.options.map((opt) => (
                  <option value={opt} selected={opt === control.defaultValue}>
                    {opt}
                  </option>
                ))}
              </select>
            )}
            {control.type === "boolean" && (
              <input
                type="checkbox"
                checked={control.defaultValue}
                onChange={(e) =>
                  onChange({ [control.prop]: (e.target as HTMLInputElement).checked })
                }
              />
            )}
            {control.type === "text" && (
              <input
                type="text"
                value={control.defaultValue}
                class="border border-line rounded-sm bg-surface px-hsp-2xs py-vsp-3xs text-small"
                onInput={(e) =>
                  onChange({ [control.prop]: (e.target as HTMLInputElement).value })
                }
              />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

VariantFrame.displayName = "VariantFrame";
export default VariantFrame;
