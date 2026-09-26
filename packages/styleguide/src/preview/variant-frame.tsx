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
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";
import { onAfterNavigate } from "@takazudo/zudo-doc/transitions";
import type { StoryControl } from "../stories/index.js";
import {
  MSG_REQUEST_READY,
  MSG_SET_THEME,
  MSG_UPDATE_PROPS,
  PROTOCOL_VERSION,
  isHeightMessage,
  isReadyMessage,
  matchesPreviewIdentity,
  type ParentToPreviewMessage,
  type PreviewTheme,
} from "./messages.js";
import { PREVIEW_ROUTE_PATH } from "./route.js";
import {
  registerPreviewIframe,
  unregisterPreviewIframe,
} from "../token-tweak/preview-iframe-registry.js";

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

/**
 * What a stage does about theme. `"none"` hands theme to the host (#883): the
 * stage never posts `sg:setTheme`, so a preview document that picks its own
 * theme (e.g. from a `previewParams` entry) is never overridden.
 */
export type FrameThemeMode = ThemeMode | "none";

/** Query keys the stage owns; `previewParams` entries using them are ignored. */
export const RESERVED_PREVIEW_PARAMS: readonly string[] = ["slug", "variant"];

/**
 * The preview document URL for one variant: `slug` and `variant` first, then
 * every `previewParams` entry URL-encoded in insertion order. A reserved key
 * in `previewParams` is dropped rather than thrown on — the identity pair must
 * stay authoritative, and throwing from an island would blank the whole page.
 */
export function buildPreviewSrc(
  previewUrl: string,
  slug: string,
  exportName: string,
  previewParams?: Readonly<Record<string, string>>,
): string {
  let src = `${previewUrl}?slug=${encodeURIComponent(slug)}&variant=${encodeURIComponent(exportName)}`;
  if (previewParams) {
    for (const [key, value] of Object.entries(previewParams)) {
      if (RESERVED_PREVIEW_PARAMS.includes(key)) continue;
      src += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    }
  }
  return src;
}

function viewportWidth(id: ViewportId): string {
  const preset = VIEWPORTS.find((v) => v.id === id) ?? VIEWPORTS.at(-1);
  return preset?.width ?? "100%";
}

function readCatalogTheme(): PreviewTheme | null {
  const theme = document.documentElement.getAttribute("data-theme");
  return theme === "light" || theme === "dark" ? theme : null;
}

/** Initial iframe height (px) before the frame reports its own, and after a variant change. */
const INITIAL_FRAME_HEIGHT = 180;

/**
 * `allow-forms` is required by `packages/demo-ui/src/forms/` stories: #499 saw
 * Chromium block submission without it (the submit listener did not fire and
 * the frame did not navigate), while with it the listener fired and the frame
 * navigated to the real action. The catalog form stories omit their enhancer
 * islands, so `contact-form.stories.tsx` cannot show this: it renders
 * `<ContactForm />` alone; `ContactFormEnhancer` lives at previewRoute
 * `/preview/contact`, which the detail page links out to instead of rendering
 * in a preview iframe.
 */
export const DEFAULT_FRAME_SANDBOX: readonly string[] = [
  "allow-same-origin",
  "allow-scripts",
  "allow-forms",
];

export interface VariantFrameProps {
  slug: string;
  /** Story export name (e.g. "Variants"). */
  exportName: string;
  /** Human label shown above the preview. */
  name: string;
  /** Declarative control descriptors (metadata only). */
  controls?: StoryControl[];
  /**
   * Toolbar-owned theme mode. "follow" tracks the catalog's `data-theme`;
   * "none" never posts `sg:setTheme` (host-controlled theme).
   */
  themeMode: FrameThemeMode;
  /** Toolbar-owned viewport preset. */
  viewportId: ViewportId;
  /**
   * Base-prefixed URL of the preview route (the host's `withBase` applied to
   * `routes.componentsPreview`). Defaults to the unprefixed PREVIEW_ROUTE_PATH.
   */
  previewUrl?: string;
  /**
   * Iframe `sandbox` tokens. Defaults to DEFAULT_FRAME_SANDBOX. Dropping
   * `allow-same-origin` gives the frame an opaque origin, which the protocol's
   * same-origin rule then rejects — only do that with a frame that does not
   * need to talk back.
   */
  frameSandbox?: readonly string[];
  /** Iframe `allow` (permissions policy) directives, joined with `; `. Absent by default. */
  frameAllow?: readonly string[];
  /**
   * Extra query params appended, URL-encoded, after `slug`/`variant`. The
   * reserved keys `slug` and `variant` are ignored.
   */
  previewParams?: Readonly<Record<string, string>>;
  /**
   * Fixed iframe height in px. When set, `sg:height` reports are ignored;
   * when absent the frame auto-sizes from them.
   */
  fixedHeight?: number;
}

function VariantFrame(props: VariantFrameProps): JSX.Element {
  const {
    slug,
    exportName,
    name,
    controls,
    themeMode,
    viewportId,
    previewUrl = PREVIEW_ROUTE_PATH,
    frameSandbox = DEFAULT_FRAME_SANDBOX,
    frameAllow,
    previewParams,
    fixedHeight,
  } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  // Mirror the prop into a ref so the `[]`-deps listeners below (message,
  // MutationObserver, after-navigate) read the CURRENT mode without being torn
  // down and re-installed on every toolbar change.
  const themeModeRef = useRef<FrameThemeMode>(themeMode);
  themeModeRef.current = themeMode;
  // The frame's current identity, read by the `[]`-deps message listener to
  // drop reports from a document that no longer belongs to this stage.
  const identityRef = useRef({ slug, variant: exportName });
  identityRef.current = { slug, variant: exportName };
  const fixedHeightRef = useRef(fixedHeight);
  fixedHeightRef.current = fixedHeight;
  const [height, setHeight] = useState(INITIAL_FRAME_HEIGHT);

  // `previewUrl` is shared with css-injection.ts's iframe selector (the code
  // panel receives the same value) — keep them in agreement by passing one
  // value, not by re-typing the literal (#48, #105). A plain string (no memo):
  // a fresh-but-equal `previewParams` object yields the same `src`, so it
  // never triggers the document reset below.
  const src = buildPreviewSrc(previewUrl, slug, exportName, previewParams);

  // Same-origin frame: target our own origin, never "*", so a frame that
  // navigated elsewhere cannot receive props or theme (#880). An opaque
  // "null" origin is not a valid target; skip rather than throw.
  function post(message: ParentToPreviewMessage): void {
    const origin = window.location.origin;
    if (origin === "null") return;
    iframeRef.current?.contentWindow?.postMessage(message, origin);
  }

  function sendTheme(theme: PreviewTheme): void {
    post({ type: MSG_SET_THEME, v: PROTOCOL_VERSION, theme });
  }

  // A new `src` is a new document: forget the old one's readiness and height
  // so the stage works without a keyed remount. A layout effect runs
  // synchronously after the commit that swapped `src`, so no message event
  // can land between the swap and this reset.
  const committedSrcRef = useRef(src);
  useLayoutEffect(() => {
    if (committedSrcRef.current === src) return;
    committedSrcRef.current = src;
    readyRef.current = false;
    setHeight(INITIAL_FRAME_HEIGHT);
  }, [src]);

  function syncTheme(): void {
    if (!readyRef.current) return;
    const mode = themeModeRef.current;
    if (mode === "none") return;
    const theme = mode === "follow" ? readCatalogTheme() : mode;
    if (theme) sendTheme(theme);
  }

  // Receive readiness and height reports from this variant's iframe only.
  // Readiness gates every theme message so the iframe cannot miss its initial
  // resolved theme while its listener is still being installed.
  useEffect(() => {
    function onMessage(e: MessageEvent): void {
      if (e.origin !== window.location.origin) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (isReadyMessage(e.data)) {
        if (!matchesPreviewIdentity(e.data, identityRef.current)) return;
        readyRef.current = true;
        syncTheme();
        return;
      }
      if (isHeightMessage(e.data)) {
        if (!matchesPreviewIdentity(e.data, identityRef.current)) return;
        if (fixedHeightRef.current !== undefined) return;
        setHeight(Math.max(80, Math.ceil(e.data.height)));
      }
    }
    window.addEventListener("message", onMessage);
    // `PreviewApp` sends `sg:ready` once from a `when="load"` island. If
    // that signal raced this effect during parent/iframe startup, ask the
    // already-mounted frame to answer now that this listener is active.
    post({ type: MSG_REQUEST_READY, v: PROTOCOL_VERSION });
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
    post({ type: MSG_UPDATE_PROPS, v: PROTOCOL_VERSION, props });
  }

  return (
    <section class="border border-[color:var(--sg-border)] rounded-md overflow-hidden bg-[var(--sg-surface)]">
      <div class="px-hsp-md py-vsp-2xs border-b border-[color:var(--sg-border)] bg-[var(--sg-surface-2)]">
        <span class="text-caption leading-normal font-medium text-[color:var(--sg-fg)]">{name}</span>
      </div>
      <div
        role="region"
        aria-label="Preview viewport canvas"
        tabIndex={0}
        class="flex overflow-x-auto bg-[var(--sg-bg)] p-hsp-md focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--sg-focus)]"
      >
        <div class="mx-auto shrink-0" style={{ width: viewportWidth(viewportId) }}>
          <iframe
            ref={iframeRef}
            src={src}
            title={`${slug} — ${name}`}
            loading="lazy"
            sandbox={frameSandbox.join(" ")}
            allow={frameAllow ? frameAllow.join("; ") : undefined}
            style={{
              width: "100%",
              height: `${fixedHeight ?? height}px`,
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
        <div class="border-t border-[color:var(--sg-border)] px-hsp-md py-vsp-xs">
          {/* Keyed by `src`: a new variant document starts from its defaults,
              so the panel must too. */}
          <ControlsPanel key={src} controls={controls} onChange={sendProps} />
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
          class="flex items-center gap-hsp-2xs text-caption leading-normal uppercase tracking-wide text-[color:var(--sg-muted)] hover:text-[color:var(--sg-fg)] cursor-pointer"
        >
          <span aria-hidden="true">{open ? "▼" : "▶"}</span>
          Controls
        </button>
        {open && (
          <button
            type="button"
            onClick={reset}
            class="text-caption leading-normal rounded-sm border border-[color:var(--sg-border)] px-hsp-xs py-vsp-3xs text-[color:var(--sg-muted)] hover:text-[color:var(--sg-fg)] transition-colors cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>

      {open && (
        <div class="flex flex-wrap gap-hsp-md">
          {controls.map((control) => (
            <label class="flex items-center gap-hsp-2xs text-small text-[color:var(--sg-fg)]">
              <span class="text-[color:var(--sg-muted)]">{control.label}</span>

              {control.type === "select" && (
                <select
                  class="border border-[color:var(--sg-border)] rounded-sm bg-[var(--sg-surface)] px-hsp-2xs py-vsp-3xs text-small"
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
                  class="border border-[color:var(--sg-border)] rounded-sm bg-[var(--sg-surface)] px-hsp-2xs py-vsp-3xs text-small"
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
                    class="w-[5rem] border border-[color:var(--sg-border)] rounded-sm bg-[var(--sg-surface)] px-hsp-2xs py-vsp-3xs text-small"
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
                    <span class="text-[color:var(--sg-muted)] tabular-nums w-[2.5rem] text-right">
                      {String(values[control.prop])}
                    </span>
                  </span>
                ))}

              {control.type === "color" && (
                <input
                  type="color"
                  value={values[control.prop] as string}
                  class="h-[1.5rem] w-[2.5rem] border border-[color:var(--sg-border)] rounded-sm bg-[var(--sg-surface)]"
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
