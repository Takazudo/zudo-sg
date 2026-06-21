"use client";

// Parent-side host for ONE story variant: an isolated preview iframe plus a
// viewport switcher and (optional) a read-only controls summary.
//
// The iframe loads `/components/preview?slug=…&variant=…`; the same-origin
// route gives the preview the main CSS bundle and CSS isolation (its own
// document). Height is driven by the `sg:height` message the preview posts
// back. The iframe is registered with the token-tweak registry so design-token
// tweaks live-update it.

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

// Order + widths mirror the reference styleguide: Mobile (320px) / Tablet /
// Full. Mobile is the narrowest, listed first.
const VIEWPORTS: Viewport[] = [
  { id: "mobile", label: "Mobile", width: "320px" },
  { id: "tablet", label: "Tablet", width: "768px" },
  { id: "full", label: "Full", width: "100%" },
];

export interface VariantFrameProps {
  slug: string;
  /** Story export name (e.g. "Variants"). */
  exportName: string;
  /** Human label shown above the preview. */
  name: string;
  /** Declarative control descriptors (metadata only). */
  controls?: StoryControl[];
}

function VariantFrame(props: VariantFrameProps): JSX.Element {
  const { slug, exportName, name, controls } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(180);
  // Default to Full width; the toggle is ordered Mobile / Tablet / Full.
  const [viewport, setViewport] = useState<Viewport>(
    VIEWPORTS.find((v) => v.id === "full") ?? VIEWPORTS[0],
  );

  const src = useMemo(() => {
    // Preview route nests under /components in this host (it was `/preview`
    // in the standalone styleguide). The code-panel CSS-injection feature
    // (#49) selects these iframes via `iframe[src*="/components/preview"]`, so
    // this path and that selector MUST stay in agreement.
    const base = withBase("/components/preview");
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

  // Push live control values to the iframe.
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
          <ControlsPanel controls={controls} onChange={sendProps} />
        </div>
      )}
    </section>
  );
}

/** Turn a control's default into the value its `useState` should hold. */
function seedState(controls: StoryControl[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of controls) out[c.prop] = c.defaultValue;
  return out;
}

/**
 * Coerce a raw DOM string from a number control into a safe Number: parse,
 * clamp to [min, max], and fall back to the declared default when the parse
 * yields NaN. (DOM input values are always strings.)
 */
function coerceNumber(
  raw: string,
  control: Extract<StoryControl, { type: "number" }>,
): number {
  const n = Number(raw);
  if (Number.isNaN(n)) return control.defaultValue;
  let v = n;
  if (control.min !== undefined) v = Math.max(control.min, v);
  if (control.max !== undefined) v = Math.min(control.max, v);
  return v;
}

/**
 * Live controls for one variant. Holds per-control state seeded from defaults,
 * renders a controlled input per control type, and posts the FULL current prop
 * set to the iframe on every change (and on Reset).
 */
function ControlsPanel({
  controls,
  onChange,
}: {
  controls: StoryControl[];
  onChange: (props: Record<string, unknown>) => void;
}): JSX.Element {
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    seedState(controls),
  );
  const [open, setOpen] = useState(true);

  function apply(next: Record<string, unknown>): void {
    setValues(next);
    onChange(next);
  }

  function set(prop: string, value: unknown): void {
    apply({ ...values, [prop]: value });
  }

  // Reset restores the panel state AND posts the full default prop set so the
  // preview returns to defaults — not just the panel UI.
  function reset(): void {
    apply(seedState(controls));
  }

  return (
    <div class="flex flex-col gap-vsp-2xs">
      <div class="flex items-center justify-between gap-hsp-md">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          class="flex items-center gap-hsp-2xs text-xs uppercase tracking-wide text-ink-mute hover:text-ink"
        >
          <span aria-hidden="true">{open ? "▼" : "▶"}</span>
          Controls
        </button>
        {open && (
          <button
            type="button"
            onClick={reset}
            class="text-xs rounded-sm border border-line px-hsp-xs py-vsp-3xs text-ink-mute hover:text-ink hover:border-line-strong transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {open && (
        <div class="flex flex-wrap gap-hsp-md">
          {controls.map((control) => (
            <label class="flex items-center gap-hsp-2xs text-small text-ink">
              <span class="text-ink-mute">{control.label}</span>

              {control.type === "select" && (
                <select
                  class="border border-line rounded-sm bg-surface px-hsp-2xs py-vsp-3xs text-small"
                  value={values[control.prop] as string}
                  onChange={(e) =>
                    set(control.prop, (e.target as HTMLSelectElement).value)
                  }
                >
                  {control.options.map((opt) => (
                    <option value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {control.type === "boolean" && (
                <input
                  type="checkbox"
                  checked={values[control.prop] as boolean}
                  onChange={(e) =>
                    set(control.prop, (e.target as HTMLInputElement).checked)
                  }
                />
              )}

              {control.type === "text" && (
                <input
                  type="text"
                  value={values[control.prop] as string}
                  class="border border-line rounded-sm bg-surface px-hsp-2xs py-vsp-3xs text-small"
                  onInput={(e) =>
                    set(control.prop, (e.target as HTMLInputElement).value)
                  }
                />
              )}

              {control.type === "number" &&
                (control.ui === "input" ? (
                  <input
                    type="number"
                    value={values[control.prop] as number}
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    class="w-[5rem] border border-line rounded-sm bg-surface px-hsp-2xs py-vsp-3xs text-small"
                    onInput={(e) =>
                      set(
                        control.prop,
                        coerceNumber((e.target as HTMLInputElement).value, control),
                      )
                    }
                  />
                ) : (
                  <span class="flex items-center gap-hsp-2xs">
                    <input
                      type="range"
                      value={values[control.prop] as number}
                      min={control.min}
                      max={control.max}
                      step={control.step}
                      onInput={(e) =>
                        set(
                          control.prop,
                          coerceNumber((e.target as HTMLInputElement).value, control),
                        )
                      }
                    />
                    <span class="text-ink-mute tabular-nums w-[2.5rem] text-right">
                      {String(values[control.prop])}
                    </span>
                  </span>
                ))}

              {control.type === "color" && (
                <input
                  type="color"
                  value={values[control.prop] as string}
                  class="h-[1.5rem] w-[2.5rem] border border-line rounded-sm bg-surface"
                  onInput={(e) =>
                    set(control.prop, (e.target as HTMLInputElement).value)
                  }
                />
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

VariantFrame.displayName = "VariantFrame";
export default VariantFrame;
