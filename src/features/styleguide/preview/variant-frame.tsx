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
import { onAfterNavigate } from "@takazudo/zudo-doc/transitions";
import { withBase } from "@/utils/base";
import {
  MSG_SET_THEME,
  MSG_UPDATE_PROPS,
  isHeightMessage,
  isReadyMessage,
  type PreviewTheme,
} from "./messages";
import { PREVIEW_ROUTE_PATH } from "./route";
import {
  registerPreviewIframe,
  unregisterPreviewIframe,
} from "../token-tweak/preview-iframe-registry";

interface Viewport {
  id: string;
  label: string;
  width: string;
}

// Mobile is the narrowest, listed first; Full remains last so the fixed-width
// presets progress from narrowest to widest before the fluid option.
const VIEWPORTS: Viewport[] = [
  { id: "mobile", label: "Mobile", width: "320px" },
  { id: "tablet", label: "Tablet", width: "768px" },
  { id: "desktop", label: "Desktop", width: "1280px" },
  { id: "full", label: "Full", width: "100%" },
];

type ThemeMode = "follow" | PreviewTheme;

interface ThemeOption {
  id: ThemeMode;
  label: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  { id: "follow", label: "Follow catalog" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

function readCatalogTheme(): PreviewTheme | null {
  const theme = document.documentElement.getAttribute("data-theme");
  return theme === "light" || theme === "dark" ? theme : null;
}

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
  const readyRef = useRef(false);
  const themeModeRef = useRef<ThemeMode>("follow");
  const [height, setHeight] = useState(180);
  const [themeMode, setThemeMode] = useState<ThemeMode>("follow");
  // Default to Full width; the fixed presets remain ordered narrow to wide.
  const [viewport, setViewport] = useState<Viewport>(
    VIEWPORTS.find((v) => v.id === "full") ?? VIEWPORTS[0],
  );

  const src = useMemo(() => {
    // PREVIEW_ROUTE_PATH is shared with css-injection.ts's iframe selector
    // (see ./route.ts) — keep them in agreement by importing the constant,
    // not by re-typing the literal (#48, #105).
    const base = withBase(PREVIEW_ROUTE_PATH);
    return `${base}?slug=${encodeURIComponent(slug)}&variant=${encodeURIComponent(exportName)}`;
  }, [slug, exportName]);

  function sendTheme(theme: PreviewTheme): void {
    iframeRef.current?.contentWindow?.postMessage(
      { type: MSG_SET_THEME, theme },
      "*",
    );
  }

  function syncTheme(): void {
    if (!readyRef.current) return;
    const mode = themeModeRef.current;
    const theme = mode === "follow" ? readCatalogTheme() : mode;
    if (theme) sendTheme(theme);
  }

  // Receive readiness and height reports from this variant's iframe only.
  // Readiness gates every theme message so the iframe cannot miss its initial
  // resolved theme while its listener is still being installed.
  useEffect(() => {
    function onMessage(e: MessageEvent): void {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (isReadyMessage(e.data)) {
        readyRef.current = true;
        syncTheme();
        return;
      }
      if (isHeightMessage(e.data)) {
        setHeight(Math.max(80, Math.ceil(e.data.height)));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Follow is active synchronization, not native iframe inheritance. Observe
  // the concrete catalog data-theme and also re-push it after SPA swaps (the
  // package provider re-applies its theme on that lifecycle event).
  useEffect(() => {
    const observer = new MutationObserver((records) => {
      if (
        records.some((record) => record.attributeName === "data-theme") &&
        themeModeRef.current === "follow"
      ) {
        syncTheme();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const unsubscribeAfterNavigate = onAfterNavigate(() => {
      if (themeModeRef.current === "follow") syncTheme();
    });
    return () => {
      observer.disconnect();
      unsubscribeAfterNavigate();
    };
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

  function selectTheme(mode: ThemeMode): void {
    themeModeRef.current = mode;
    setThemeMode(mode);
    // Pinned modes are sent directly. Returning to Follow reads and sends the
    // catalog's current concrete value immediately.
    syncTheme();
  }

  return (
    <section class="border border-border rounded-md overflow-hidden bg-surface">
      <div class="flex items-center justify-between gap-hsp-md px-hsp-md py-vsp-2xs border-b border-border bg-surface-2">
        <span class="text-small font-medium text-fg">{name}</span>
        <div class="flex flex-wrap items-center justify-end gap-hsp-xs">
          <div role="group" aria-label="Preview theme" class="flex gap-hsp-3xs">
            {THEME_OPTIONS.map((option) => (
              <button
                type="button"
                onClick={() => selectTheme(option.id)}
                aria-pressed={themeMode === option.id}
                class={
                  themeMode === option.id
                    ? "px-hsp-xs py-vsp-3xs text-xs rounded-sm border transition-colors border-accent bg-accent text-on-accent"
                    : "px-hsp-xs py-vsp-3xs text-xs rounded-sm border transition-colors border-border text-muted hover:text-fg"
                }
              >
                {option.label}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Preview viewport" class="flex gap-hsp-3xs">
            {VIEWPORTS.map((vp) => (
              <button
                type="button"
                onClick={() => setViewport(vp)}
                aria-pressed={viewport.id === vp.id}
                class={
                  "px-hsp-xs py-vsp-3xs text-xs rounded-sm border transition-colors " +
                  (viewport.id === vp.id
                    ? "border-accent bg-accent text-on-accent"
                    : "border-border text-muted hover:text-fg")
                }
              >
                {vp.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        role="region"
        aria-label="Preview viewport canvas"
        tabIndex={0}
        class="flex overflow-x-auto bg-bg p-hsp-md focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <div class="mx-auto shrink-0" style={{ width: viewport.width }}>
          {/* `allow-forms` is required by `packages/ui/src/forms/` stories:
              #499 saw Chromium block submission without it (the submit
              listener did not fire and the frame did not navigate), while
              with it the listener fired and the frame navigated to the real
              action. The catalog form stories omit their enhancer islands,
              so `contact-form.stories.tsx` cannot show this: it renders
              `<ContactForm />` alone; `ContactFormEnhancer` lives at
              previewRoute `/preview/contact`, which
              `pages/components/[slug].tsx:167` links out to instead of
              rendering in a preview iframe. */}
          <iframe
            ref={iframeRef}
            src={src}
            title={`${slug} — ${name}`}
            loading="lazy"
            sandbox="allow-same-origin allow-scripts allow-forms"
            style={{
              width: "100%",
              height: `${height}px`,
              // An iframe's layout viewport is its content box. Keep the
              // border at zero so a 1280px preset reaches the 1280px
              // breakpoint; a visible border belongs on the wrapper.
              border: "0",
              display: "block",
            }}
          />
        </div>
      </div>
      {controls && controls.length > 0 && (
        <div class="border-t border-border px-hsp-md py-vsp-xs">
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
          class="flex items-center gap-hsp-2xs text-xs uppercase tracking-wide text-muted hover:text-fg"
        >
          <span aria-hidden="true">{open ? "▼" : "▶"}</span>
          Controls
        </button>
        {open && (
          <button
            type="button"
            onClick={reset}
            class="text-xs rounded-sm border border-border px-hsp-xs py-vsp-3xs text-muted hover:text-fg hover:border-border transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {open && (
        <div class="flex flex-wrap gap-hsp-md">
          {controls.map((control) => (
            <label class="flex items-center gap-hsp-2xs text-small text-fg">
              <span class="text-muted">{control.label}</span>

              {control.type === "select" && (
                <select
                  class="border border-border rounded-sm bg-surface px-hsp-2xs py-vsp-3xs text-small"
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
                  class="border border-border rounded-sm bg-surface px-hsp-2xs py-vsp-3xs text-small"
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
                    class="w-[5rem] border border-border rounded-sm bg-surface px-hsp-2xs py-vsp-3xs text-small"
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
                    <span class="text-muted tabular-nums w-[2.5rem] text-right">
                      {String(values[control.prop])}
                    </span>
                  </span>
                ))}

              {control.type === "color" && (
                <input
                  type="color"
                  value={values[control.prop] as string}
                  class="h-[1.5rem] w-[2.5rem] border border-border rounded-sm bg-surface"
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
