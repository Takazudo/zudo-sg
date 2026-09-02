"use client";

// Controlled stage for ONE story variant: an isolated preview iframe plus an
// optional live-controls panel.
//
// State ownership (#541): theme mode and viewport preset are NOT held here.
// They belong to the page-level toolbar in ./detail-workbench.tsx and arrive
// as props, so a stage that mounts late — a below-the-fold variant, or a
// variant appended after the toolbar already moved — renders with the CURRENT
// values. A page-level *event* could not do this: it would be dispatched
// before those stages existed and simply be missed. Props survive late
// mounting; broadcasts do not.
//
// What stays per-frame is what is genuinely per-frame: the iframe, the
// `sg:height` handshake, the token-tweak registration, the
// `Preview viewport canvas` scroll region, and the variant's own story-prop
// controls.
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
  MSG_REQUEST_READY,
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

// The preset tables live here, beside the stage that consumes them, and are
// imported by the toolbar that drives them — the toolbar imports the stage
// already, so the reverse direction would be a cycle.

export type ViewportId = "mobile" | "tablet" | "desktop" | "full";

export interface Viewport {
  id: ViewportId;
  label: string;
  width: string;
}

// Mobile is the narrowest, listed first; Full remains last so the fixed-width
// presets progress from narrowest to widest before the fluid option.
export const VIEWPORTS: Viewport[] = [
  { id: "mobile", label: "Mobile", width: "320px" },
  { id: "tablet", label: "Tablet", width: "768px" },
  { id: "desktop", label: "Desktop", width: "1280px" },
  { id: "full", label: "Full", width: "100%" },
];

/** Fluid width — the fixed presets are opt-in. */
export const DEFAULT_VIEWPORT_ID: ViewportId = "full";

export type ThemeMode = "follow" | PreviewTheme;

export interface ThemeOption {
  id: ThemeMode;
  label: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: "follow", label: "Follow catalog" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export const DEFAULT_THEME_MODE: ThemeMode = "follow";

function viewportWidth(id: ViewportId): string {
  const preset = VIEWPORTS.find((v) => v.id === id);
  return (preset ?? VIEWPORTS[VIEWPORTS.length - 1]).width;
}

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
  /** Toolbar-owned theme mode. "follow" tracks the catalog's `data-theme`. */
  themeMode: ThemeMode;
  /** Toolbar-owned viewport preset. */
  viewportId: ViewportId;
}

function VariantFrame(props: VariantFrameProps): JSX.Element {
  const { slug, exportName, name, controls, themeMode, viewportId } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  // Mirror the prop into a ref so the `[]`-deps listeners below (message,
  // MutationObserver, after-navigate) read the CURRENT mode without being torn
  // down and re-installed on every toolbar change.
  const themeModeRef = useRef<ThemeMode>(themeMode);
  themeModeRef.current = themeMode;
  const [height, setHeight] = useState(180);

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
    // `PreviewApp` sends `sg:ready` once from a `when="load"` island. If
    // that signal raced this effect during parent/iframe startup, ask the
    // already-mounted frame to answer now that this listener is active.
    iframeRef.current?.contentWindow?.postMessage(
      { type: MSG_REQUEST_READY },
      "*",
    );
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Adopt the toolbar's theme on every change. On mount this is a no-op
  // (`readyRef` is still false) and the ready handler above sends the first
  // value instead — which is exactly what makes a late-mounting stage land on
  // the current mode rather than the default.
  useEffect(() => {
    syncTheme();
  }, [themeMode]);

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

  return (
    <section class="border border-border rounded-md overflow-hidden bg-surface">
      <div class="px-hsp-md py-vsp-2xs border-b border-border bg-surface-2">
        <span class="text-caption leading-normal font-medium text-fg">{name}</span>
      </div>
      <div
        role="region"
        aria-label="Preview viewport canvas"
        tabIndex={0}
        class="flex overflow-x-auto bg-bg p-hsp-md focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <div class="mx-auto shrink-0" style={{ width: viewportWidth(viewportId) }}>
          {/* `allow-forms` is required by `packages/ui/src/forms/` stories:
              #499 saw Chromium block submission without it (the submit
              listener did not fire and the frame did not navigate), while
              with it the listener fired and the frame navigated to the real
              action. The catalog form stories omit their enhancer islands,
              so `contact-form.stories.tsx` cannot show this: it renders
              `<ContactForm />` alone; `ContactFormEnhancer` lives at
              previewRoute `/preview/contact`, which the detail page links out
              to instead of rendering in a preview iframe. */}
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
 *
 * These are the variant's OWN story props — they stay with their variant. Only
 * the global theme / viewport / layout controls were hoisted to the page
 * toolbar (#541).
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
          class="flex items-center gap-hsp-2xs text-caption leading-normal uppercase tracking-wide text-muted hover:text-fg cursor-pointer"
        >
          <span aria-hidden="true">{open ? "▼" : "▶"}</span>
          Controls
        </button>
        {open && (
          <button
            type="button"
            onClick={reset}
            class="text-caption leading-normal rounded-sm border border-border px-hsp-xs py-vsp-3xs text-muted hover:text-fg transition-colors cursor-pointer"
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
