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

import { onAfterNavigate } from "@takazudo/zudo-doc/transitions";
import type { StoryControl } from "../stories/index.js";
import {
  MSG_REQUEST_READY,
  MSG_READY,
  MSG_HEIGHT,
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
  replayPreviewVars,
} from "../token-tweak/preview-iframe-registry.js";
import { registerCssPreview, replayCssToPreview } from "../code-panel/css-injection.js";
import {
  EXTERNAL_RUNTIME_VERSION, MSG_RESET_FIXTURE, MSG_RUNTIME_ERROR,
  hasExternalRuntimeMarker, isExternalRuntimeMessageEvent, isNewExternalRuntimeSequence,
  isSerializableProps, matchesExternalRuntimeIdentity,
  type ExternalRuntimeIdentity, type ExternalRuntimeMode, type ExternalParentMessage,
} from "./external-runtime.js";

// Presets and pure URL helpers stay outside this client-only module so its
// runtime exports are island components only.

import {
  buildPreviewSrc,
  DEFAULT_FRAME_SANDBOX,
  INITIAL_FRAME_HEIGHT,
  viewportWidth,
  readCatalogTheme,
  type FrameThemeMode,
  type ViewportId,
} from "./variant-frame-config.js";
import {
  computed,
  signal,
  getScope,
  Show,
  For,
  type ReadonlySignal,
  type Description,
} from "@takazudo/zfb/zudo-react";

type Live<T> = T | ReadonlySignal<T>;
function read<T>(value: Live<T>): T {
  return typeof value === "object" && value !== null && "value" in value
    ? (value as ReadonlySignal<T>).value
    : (value as T);
}

export interface VariantFrameProps {
  slug: string;
  /** Story export name (e.g. "Variants"). */
  exportName: Live<string>;
  /** Human label shown above the preview. */
  name: Live<string>;
  /** Declarative control descriptors (metadata only). */
  controls?: Live<StoryControl[] | undefined>;
  /**
   * Toolbar-owned theme mode. "follow" tracks the catalog's `data-theme`;
   * "none" never posts `sg:setTheme` (host-controlled theme).
   */
  themeMode: Live<FrameThemeMode>;
  /** Toolbar-owned viewport preset. */
  viewportId: Live<ViewportId>;
  /**
   * Base-prefixed URL of the preview route (the host's `withBase` applied to
   * `routes.componentsPreview`). Defaults to the unprefixed PREVIEW_ROUTE_PATH.
   */
  previewUrl?: string;
  /** Explicit strict mode; never negotiate down to legacy identity-less traffic. */
  runtime?: ExternalRuntimeMode;
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

function VariantFrame(props: VariantFrameProps): Description {
  const {
    slug,
    exportName,
    name,
    controls,
    themeMode,
    viewportId,
    previewUrl = PREVIEW_ROUTE_PATH,
    runtime = "legacy",
    frameSandbox = DEFAULT_FRAME_SANDBOX,
    frameAllow,
    previewParams,
    fixedHeight,
  } = props;
  const scope = getScope();
  const iframeRef = { current: null as HTMLIFrameElement | null };
  let ready = false;
  let readyDocument: Document | null = null;
  const values = signal(seedState(read(controls) ?? []));
  const canResetFixture = signal(false);
  const previewError = signal<string | null>(null);
  let sessionId = "";
  let identity: ExternalRuntimeIdentity | null = null;
  let expectedGeneration = 0;
  let incoming = -1;
  let outgoing = -1;
  let lastProps = "";
  const height = signal(INITIAL_FRAME_HEIGHT);
  const src = computed(() =>
    buildPreviewSrc(previewUrl, slug, read(exportName), previewParams),
  );
  let committedSrc = src.value;
  scope.effect(() => {
    const next = src.value;
    if (next === committedSrc) return;
    committedSrc = next;
    values.value = seedState(read(controls) ?? []);
    resetDocument();
    requestReady();
  });

  // Same-origin frame: target our own origin, never "*", so a frame that
  // navigated elsewhere cannot receive props or theme (#880). An opaque
  // "null" origin is not a valid target; skip rather than throw.
  function post(message: ParentToPreviewMessage | ExternalParentMessage): void {
    const origin = window.location.origin;
    if (origin === "null") return;
    iframeRef.current?.contentWindow?.postMessage(message, origin);
  }

  function sendTheme(theme: PreviewTheme): void {
    if (runtime === "external-v1") {
      if (identity) post({ type: MSG_SET_THEME, v: PROTOCOL_VERSION, runtimeVersion: EXTERNAL_RUNTIME_VERSION, ...identity, sequence: ++outgoing, theme });
    } else post({ type: MSG_SET_THEME, v: PROTOCOL_VERSION, theme });
  }

  function resetDocument(): void {
    ready = false;
    readyDocument = null;
    identity = null;
    expectedGeneration = 0;
    sessionId = runtime === "external-v1" ? window.crypto.randomUUID() : "";
    incoming = -1;
    outgoing = -1;
    lastProps = "";
    height.value = INITIAL_FRAME_HEIGHT;
    canResetFixture.value = false;
    previewError.value = null;
  }

  function requestReady(): void {
    if (runtime === "external-v1") {
      post({ type: MSG_REQUEST_READY, v: PROTOCOL_VERSION, runtimeVersion: EXTERNAL_RUNTIME_VERSION, slug, variant: read(exportName), sessionId });
    } else post({ type: MSG_REQUEST_READY, v: PROTOCOL_VERSION });
  }

  function syncProps(force = false): void {
    if (!ready || (!(read(controls)?.length) && Object.keys(values.value).length === 0)) return;
    const serialized = JSON.stringify(values.value);
    if (!force && serialized === lastProps) return;
    if (runtime === "external-v1") {
      if (!identity || !isSerializableProps(values.value)) return;
      post({ type: MSG_UPDATE_PROPS, v: PROTOCOL_VERSION, runtimeVersion: EXTERNAL_RUNTIME_VERSION, ...identity, sequence: ++outgoing, props: values.value });
    } else post({ type: MSG_UPDATE_PROPS, v: PROTOCOL_VERSION, props: values.value });
    lastProps = serialized;
  }

  function replay(): void {
    syncProps();
    syncTheme();
    const iframe = iframeRef.current;
    if (iframe) { replayPreviewVars(iframe); replayCssToPreview(iframe); }
  }

  function resetFixture(): void {
    if (!identity || !canResetFixture.value) return;
    const message: ExternalParentMessage = { type: MSG_RESET_FIXTURE, v: PROTOCOL_VERSION, runtimeVersion: EXTERNAL_RUNTIME_VERSION, ...identity, sequence: ++outgoing, nextGeneration: identity.generation + 1 };
    identity = { ...identity, generation: message.nextGeneration };
    incoming = -1;
    outgoing = -1;
    ready = false;
    lastProps = "";
    previewError.value = null;
    height.value = INITIAL_FRAME_HEIGHT;
    post(message);
  }

  function reloadFixture(): void {
    resetDocument();
    const iframe = iframeRef.current;
    if (iframe) iframe.src = src.value;
  }

  function syncTheme(): void {
    if (!ready) return;
    const mode = read(themeMode);
    if (mode === "none") return;
    const theme = mode === "follow" ? readCatalogTheme() : mode;
    if (theme) sendTheme(theme);
  }

  // Receive readiness and height reports from this variant's iframe only.
  // Readiness gates every theme message so the iframe cannot miss its initial
  // resolved theme while its listener is still being installed.
  scope.onActivate(() => {
    function onMessage(e: MessageEvent): void {
      if (e.origin !== window.location.origin) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (runtime === "external-v1") {
        if (!isExternalRuntimeMessageEvent(e, { origin: window.location.origin, source: iframeRef.current?.contentWindow })) return;
        const data = e.data;
        if (data.type !== MSG_READY && data.type !== MSG_HEIGHT && data.type !== MSG_RUNTIME_ERROR) return;
        if (data.slug !== slug || data.variant !== read(exportName) || data.sessionId !== sessionId) return;
        if (!identity) {
          if ((data.type !== MSG_READY && data.type !== MSG_RUNTIME_ERROR) || data.generation !== expectedGeneration) return;
        } else if (!matchesExternalRuntimeIdentity(data, identity)) return;
        if (data.type === MSG_HEIGHT && !ready) return;
        if (!isNewExternalRuntimeSequence(data.sequence, incoming)) return;
        identity = { slug, variant: read(exportName), sessionId, documentId: data.documentId, generation: data.generation };
        readyDocument = iframeRef.current?.contentDocument ?? null;
        incoming = data.sequence;
        if (data.type === MSG_READY) {
          ready = true;
          canResetFixture.value = data.capabilities.fullReset;
          previewError.value = null;
          replay();
        } else if (data.type === MSG_RUNTIME_ERROR) {
          ready = false;
          previewError.value = data.error.message;
        } else if (fixedHeight === undefined) height.value = Math.max(80, Math.ceil(data.height));
        return;
      }
      if (hasExternalRuntimeMarker(e.data)) return;
      if (isReadyMessage(e.data)) {
        if (
          !matchesPreviewIdentity(e.data, { slug, variant: read(exportName) })
        )
          return;
        ready = true;
        readyDocument = iframeRef.current?.contentDocument ?? null;
        replay();
        return;
      }
      if (isHeightMessage(e.data)) {
        if (
          !matchesPreviewIdentity(e.data, { slug, variant: read(exportName) })
        )
          return;
        if (fixedHeight !== undefined || !Number.isFinite(e.data.height) || e.data.height < 0) return;
        height.value = Math.max(80, Math.ceil(e.data.height));
      }
    }
    window.addEventListener("message", onMessage);
    const iframe = iframeRef.current;
    const onLoad = () => {
      // Legacy readiness can arrive before the same document's load event.
      // Preserve it only when the actual same-origin Document still agrees;
      // a reload creates a new Document even though WindowProxy is retained.
      if (runtime === "legacy" && ready && readyDocument === iframe?.contentDocument) return;
      const generation = readyDocument === iframe?.contentDocument ? identity?.generation ?? 0 : 0;
      resetDocument();
      expectedGeneration = generation;
      requestReady();
    };
    iframe?.addEventListener("load", onLoad);
    // `PreviewApp` sends `sg:ready` once from a `when="load"` island. If
    // that signal raced this effect during parent/iframe startup, ask the
    // already-mounted frame to answer now that this listener is active.
    resetDocument();
    requestReady();
    return () => {
      window.removeEventListener("message", onMessage);
      iframe?.removeEventListener("load", onLoad);
    };
  });

  // Adopt the toolbar's theme on every change. On mount this is a no-op
  // (`ready` is still false) and the ready handler above sends the first
  // value instead — which is exactly what makes a late-mounting stage land on
  // the current mode rather than the default.
  let previousThemeMode = read(themeMode);
  scope.effect(() => {
    const next = read(themeMode);
    if (next === previousThemeMode) return;
    previousThemeMode = next;
    syncTheme();
  });

  // Follow is active synchronization, not native iframe inheritance. Observe
  // the concrete catalog data-theme and also re-push it after SPA swaps (the
  // package provider re-applies its theme on that lifecycle event).
  scope.onActivate(() => {
    const observer = new MutationObserver((records) => {
      if (
        records.some((record) => record.attributeName === "data-theme") &&
        read(themeMode) === "follow"
      ) {
        syncTheme();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const unsubscribeAfterNavigate = onAfterNavigate(() => {
      if (read(themeMode) === "follow") syncTheme();
    });
    return () => {
      observer.disconnect();
      unsubscribeAfterNavigate();
    };
  });

  // Register/unregister with the token-tweak registry.
  scope.onActivate(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    registerPreviewIframe(iframe, runtime === "external-v1" ? { identity: () => ready ? identity : null } : {});
    const removeCss = registerCssPreview(iframe);
    if (ready) { replayPreviewVars(iframe); replayCssToPreview(iframe); }
    return () => { unregisterPreviewIframe(iframe); removeCss(); };
  });

  // Push live control values to the iframe.
  function sendProps(props: Record<string, unknown>): void {
    values.value = props;
    syncProps(runtime === "legacy");
  }

  return (
    <section class="border border-sg-border rounded-md overflow-hidden bg-sg-surface">
      <div class="px-hsp-md py-vsp-2xs border-b border-sg-border bg-sg-surface-2">
        <span class="text-caption leading-normal font-medium text-sg-fg">
          {computed(() => read(name))}
        </span>
        <Show when={canResetFixture}>
          {() => <button type="button" on:click={resetFixture} aria-label={`Reset fixture ${slug}`} class="text-small">Reset fixture</button>}
        </Show>
      </div>
      <Show when={computed(() => previewError.value !== null)}>
        {() => <div role="alert" class="p-hsp-md text-small">
          <p>{computed(() => `Preview failed: ${previewError.value ?? ""}`)}</p>
          <button type="button" on:click={reloadFixture}>Reload preview</button>
        </div>}
      </Show>
      <div
        role="region"
        aria-label="Preview viewport canvas"
        tabindex={0}
        class="flex overflow-x-auto bg-sg-bg p-hsp-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sg-focus"
      >
        <div
          class="mx-auto shrink-0"
          style={computed(() => ({ width: viewportWidth(read(viewportId)) }))}
        >
          <iframe
            ref={iframeRef}
            src={src}
            title={computed(() => `${slug} — ${read(name)}`)}
            loading="lazy"
            sandbox={frameSandbox.join(" ")}
            allow={frameAllow ? frameAllow.join("; ") : undefined}
            style={computed(() => ({
              width: "100%",
              height: `${fixedHeight ?? height.value}px`,
              // An iframe's layout viewport is its content box. Keep the
              // border at zero so a 1280px preset reaches the 1280px
              // breakpoint; a visible border belongs on the wrapper.
              border: "0",
              display: "block",
            }))}
          />
        </div>
      </div>
      <Show when={computed(() => (read(controls) ?? []).length > 0)}>
        {() => (
          <div class="border-t border-sg-border px-hsp-md py-vsp-xs">
            {/* Keyed by `src`: a new variant document starts from its defaults,
              so the panel must too. */}
            <For each={computed(() => [src.value])} by={(value) => value}>
              {() => (
                <ControlsPanel
                  controls={read(controls) ?? []}
                  values={values}
                  onChange={sendProps}
                />
              )}
            </For>
          </div>
        )}
      </Show>
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
  if (!Number.isFinite(n)) return control.defaultValue;
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
  values,
  onChange,
}: {
  controls: StoryControl[];
  values: { value: Record<string, unknown> };
  onChange: (props: Record<string, unknown>) => void;
}): Description {
  const open = signal(true);
  const fields = Object.fromEntries(
    controls.map((control) => [
      control.prop,
      signal(String(control.defaultValue)),
    ]),
  );
  // zudo-react 4.3.1 models text/select/checkbox inputs; number, range and
  // color use native input events plus owned refs to reflect clamps and Reset.
  const fieldRefs = Object.fromEntries(
    controls.map((control) => [
      control.prop,
      { current: null as HTMLInputElement | null },
    ]),
  );
  const checks = Object.fromEntries(
    controls.map((control) => [
      control.prop,
      signal(Boolean(control.defaultValue)),
    ]),
  );

  function apply(next: Record<string, unknown>): void {
    values.value = next;
    for (const control of controls) {
      fields[control.prop]!.value = String(next[control.prop]);
      checks[control.prop]!.value = Boolean(next[control.prop]);
      const field = fieldRefs[control.prop]!.current;
      if (field) field.value = String(next[control.prop]);
    }
    onChange(next);
  }

  function set(prop: string, value: unknown): void {
    apply({ ...values.value, [prop]: value });
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
          on:click={() => {
            open.value = !open.value;
          }}
          aria-expanded={open}
          class="flex items-center gap-hsp-2xs text-caption leading-normal uppercase tracking-wide text-sg-muted hover:text-sg-fg cursor-pointer"
        >
          <span aria-hidden="true">
            {computed(() => (open.value ? "▼" : "▶"))}
          </span>
          Controls
        </button>
        <Show when={open}>
          {() => (
            <button
              type="button"
              on:click={reset}
              class="text-caption leading-normal rounded-sm border border-sg-border px-hsp-xs py-vsp-3xs text-sg-muted hover:text-sg-fg transition-colors cursor-pointer"
            >
              Reset
            </button>
          )}
        </Show>
      </div>

      <Show when={open}>
        {() => (
          <div class="flex flex-wrap gap-hsp-md">
            {controls.map((control) => (
              <label class="flex items-center gap-hsp-2xs text-small text-sg-fg">
                <span class="text-sg-muted">{control.label}</span>

                {control.type === "select" && (
                  <select
                    class="border border-sg-border rounded-sm bg-sg-surface px-hsp-2xs py-vsp-3xs text-small"
                    modelValue={fields[control.prop]!}
                    on:change={(e) => set(control.prop, e.currentTarget.value)}
                  >
                    {control.options.map((opt) => (
                      <option value={opt}>{opt}</option>
                    ))}
                  </select>
                )}

                {control.type === "boolean" && (
                  <input
                    type="checkbox"
                    modelChecked={checks[control.prop]!}
                    on:change={(e) =>
                      set(control.prop, e.currentTarget.checked)
                    }
                  />
                )}

                {control.type === "text" && (
                  <input
                    type="text"
                    modelValue={fields[control.prop]!}
                    class="border border-sg-border rounded-sm bg-sg-surface px-hsp-2xs py-vsp-3xs text-small"
                    on:input={(e) => set(control.prop, e.currentTarget.value)}
                  />
                )}

                {control.type === "number" &&
                  (control.ui === "input" ? (
                    <input
                      type="number"
                      ref={fieldRefs[control.prop]!}
                      value={String(values.value[control.prop])}
                      min={
                        control.min === undefined
                          ? undefined
                          : String(control.min)
                      }
                      max={
                        control.max === undefined
                          ? undefined
                          : String(control.max)
                      }
                      step={
                        control.step === undefined
                          ? undefined
                          : String(control.step)
                      }
                      class="w-[5rem] border border-sg-border rounded-sm bg-sg-surface px-hsp-2xs py-vsp-3xs text-small"
                      on:input={(e) =>
                        set(
                          control.prop,
                          coerceNumber(e.currentTarget.value, control),
                        )
                      }
                    />
                  ) : (
                    <span class="flex items-center gap-hsp-2xs">
                      <input
                        type="range"
                        ref={fieldRefs[control.prop]!}
                        value={String(values.value[control.prop])}
                        min={
                          control.min === undefined
                            ? undefined
                            : String(control.min)
                        }
                        max={
                          control.max === undefined
                            ? undefined
                            : String(control.max)
                        }
                        step={
                          control.step === undefined
                            ? undefined
                            : String(control.step)
                        }
                        on:input={(e) =>
                          set(
                            control.prop,
                            coerceNumber(e.currentTarget.value, control),
                          )
                        }
                      />
                      <span class="text-sg-muted tabular-nums w-[2.5rem] text-right">
                        {computed(() => String(values.value[control.prop]))}
                      </span>
                    </span>
                  ))}

                {control.type === "color" && (
                  <input
                    type="color"
                    ref={fieldRefs[control.prop]!}
                    value={String(values.value[control.prop])}
                    class="h-[1.5rem] w-[2.5rem] border border-sg-border rounded-sm bg-sg-surface"
                    on:input={(e) => set(control.prop, e.currentTarget.value)}
                  />
                )}
              </label>
            ))}
          </div>
        )}
      </Show>
    </div>
  );
}

export default VariantFrame;
