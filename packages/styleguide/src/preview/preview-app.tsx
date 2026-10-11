"use client";

// Client-only app that runs INSIDE each isolated preview iframe (route
// `/components/preview`).
//
// Static-host reality: zfb emits ONE `/components/preview/index.html`; the
// query string is ignored by static hosting, so every variant iframe loads the
// SAME HTML. The variant to show is therefore resolved CLIENT-SIDE from
// `location.search` (`?slug=button&variant=Variants`), not from SSR props.
//
// The story registry arrives as the `registry` prop. zfb serializes island
// props to JSON (`data-props`), which would drop every variant `render()`
// closure, so this component is NEVER mounted as an island directly: a
// no-props `"use client"` wrapper (`ConfiguredPreviewApp`, ADR
// docs/adr/styleguide-engine.md decision 10) imports the host registry
// in-bundle and renders `<PreviewApp registry={registry} />`. The closures are
// therefore bundled into the island chunk and run in the browser.
//
// Token tweaks: the same wrapper installs the `apply-css-vars` bridge receiver
// (`installIframeReceiver`, token-tweak/iframe-css-vars-bridge.ts) so the
// design-token tweaker live-updates this preview.

import {
  signal,
  computed,
  getScope,
  For,
  type Child,
  type Description,
} from "@takazudo/zfb/zudo-react";
import type { Registry } from "../registry/index.js";
import type { StoryControl } from "../stories/index.js";
import {
  MSG_HEIGHT,
  MSG_READY,
  PROTOCOL_VERSION,
  isRequestReadyMessage,
  isSetThemeMessage,
  isUpdatePropsMessage,
  type PreviewToParentMessage,
} from "./messages.js";

interface FrameIdentity {
  slug: string;
  variant: string;
}

function readParams(): FrameIdentity {
  if (typeof location === "undefined") return { slug: "", variant: "" };
  const p = new URLSearchParams(location.search);
  return { slug: p.get("slug") ?? "", variant: p.get("variant") ?? "" };
}

/** Seed an args object from each control's declared default. */
function defaultsFromControls(
  controls: StoryControl[] | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of controls ?? []) out[c.prop] = c.defaultValue;
  return out;
}

/**
 * Measure content height and post it to the parent.
 *
 * Keep the story's layout untouched: don't give body a BFC (`flow-root`) or
 * padding to contain margins, and don't switch to
 * documentElement.scrollHeight. The preview must render what a consuming
 * page renders; changing that box trades fidelity for convenience where
 * fidelity is the product.
 *
 * Module-scoped (not a closure inside an effect) so both the mount-time
 * reporter and the `sg:requestReady` handler below can call the same
 * measurement — see #537.
 */
function reportHeight(identity: FrameIdentity): void {
  const rect = document.body.getBoundingClientRect();
  const height = Math.ceil(rect.bottom + window.scrollY);
  postToParent({ type: MSG_HEIGHT, v: PROTOCOL_VERSION, height, ...identity });
}

// The frame is same-origin with its parent (the default sandbox keeps
// `allow-same-origin`), so our own origin is the parent's: target it rather
// than "*" so a cross-origin embedder never receives the reports (#880). An
// opaque origin ("null": a sandbox without `allow-same-origin`) is not a valid
// target, and the parent would reject us anyway, so stay silent instead of
// throwing.
function postToParent(message: PreviewToParentMessage): void {
  const origin = window.location.origin;
  if (origin === "null") return;
  window.parent?.postMessage(message, origin);
}

function announceReady(identity: FrameIdentity): void {
  postToParent({ type: MSG_READY, v: PROTOCOL_VERSION, ...identity });
}

export interface PreviewAppProps {
  /** The host's story registry (`createRegistry(...)` result). In-bundle only — never island props. */
  registry: Pick<Registry, "getStoryBySlug">;
}

/** Invoke a story only inside its own disposable setup scope. */
function PreviewStory({
  render,
  args,
}: {
  render: (args: Record<string, unknown>) => Child;
  args: Record<string, unknown>;
}): Child {
  return render(args);
}

function PreviewApp({ registry }: PreviewAppProps): Description {
  const scope = getScope();
  const initial = readParams();
  const slug = signal(initial.slug);
  const variant = signal(initial.variant);
  const overrides = signal<Record<string, unknown>>({});
  const version = signal(0);
  const identity = (): FrameIdentity => ({
    slug: slug.value,
    variant: variant.value,
  });
  const entry = computed(() => registry.getStoryBySlug(slug.value));
  const variantEntry = computed(() =>
    entry.value?.variants.find((v) => v.exportName === variant.value),
  );
  const merged = computed(() => ({
    ...defaultsFromControls(variantEntry.value?.story.controls),
    ...overrides.value,
  }));

  scope.onActivate(() => {
    const report = (): void => reportHeight(identity());
    function onMessage(e: MessageEvent): void {
      if (e.origin !== window.location.origin || e.source !== window.parent)
        return;
      if (isRequestReadyMessage(e.data)) {
        announceReady(identity());
        report();
      } else if (isUpdatePropsMessage(e.data)) {
        overrides.value = { ...overrides.value, ...e.data.props };
        version.value++;
      } else if (isSetThemeMessage(e.data)) {
        document.documentElement.dataset.theme = e.data.theme;
      }
    }
    // SPA query navigation changes identity without installing another receiver.
    function onLocationChange(): void {
      const next = readParams();
      if (next.slug === slug.value && next.variant === variant.value) return;
      slug.value = next.slug;
      variant.value = next.variant;
      overrides.value = {};
      version.value++;
      announceReady(identity());
      report();
    }
    window.addEventListener("message", onMessage);
    window.addEventListener("popstate", onLocationChange);
    document.documentElement.dataset.sgPreviewHydrated = "1";
    announceReady(identity());
    report();
    const t1 = window.setTimeout(report, 100);
    const t2 = window.setTimeout(report, 500);
    const observer = new ResizeObserver(report);
    observer.observe(document.body);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("popstate", onLocationChange);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      observer.disconnect();
      delete document.documentElement.dataset.sgPreviewHydrated;
    };
  });

  return (
    <For each={computed(() => [version.value])} by={(key) => key}>
      {() => {
        const current = variantEntry.value;
        if (!current)
          return (
            <div class="p-hsp-md text-sg-muted text-small">
              Unknown preview: slug=<code>{slug.value}</code> variant=
              <code>{variant.value}</code>
            </div>
          );
        return (
          <div class="p-hsp-md" data-sg-variant-root>
            <PreviewStory
              render={
                current.story.render as (args: Record<string, unknown>) => Child
              }
              args={merged.value}
            />
          </div>
        );
      }}
    </For>
  );
}

export default PreviewApp;
