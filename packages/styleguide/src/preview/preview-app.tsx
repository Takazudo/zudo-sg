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

import type { JSX } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import type { Registry } from "../registry/index.js";
import type { StoryControl } from "../stories/index.js";
import {
  MSG_HEIGHT,
  MSG_READY,
  isRequestReadyMessage,
  isSetThemeMessage,
  isUpdatePropsMessage,
} from "./messages.js";

function readParams(): { slug: string; variant: string } {
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
function reportHeight(): void {
  const rect = document.body.getBoundingClientRect();
  const height = Math.ceil(rect.bottom + window.scrollY);
  window.parent?.postMessage({ type: MSG_HEIGHT, height }, "*");
}

export interface PreviewAppProps {
  /** The host's story registry (`createRegistry(...)` result). In-bundle only — never island props. */
  registry: Pick<Registry, "getStoryBySlug">;
}

function PreviewApp({ registry }: PreviewAppProps): JSX.Element {
  const [{ slug, variant }] = useState(readParams);
  // Live prop overrides pushed from the parent's controls panel. Read on every
  // render and merged into the story's render args (see `merged` below).
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});

  const entry = useMemo(() => registry.getStoryBySlug(slug), [registry, slug]);
  const variantEntry = useMemo(
    () => entry?.variants.find((v) => v.exportName === variant),
    [entry, variant],
  );

  // Accept live prop and resolved-theme updates from the parent.
  //
  // Trust model: this preview iframe is same-origin with its parent
  // (`sandbox="allow-same-origin allow-scripts allow-forms"`), so
  // `window.parent` is a same-origin window we can compare against. Accept ONLY
  // messages whose source is the parent and whose payload is a well-formed
  // props or theme envelope; ignore everything else. Announce readiness only
  // after installing this listener, so the parent can safely respond without
  // losing a message.
  useEffect(() => {
    function onMessage(e: MessageEvent): void {
      if (e.source !== window.parent) return;
      if (isRequestReadyMessage(e.data)) {
        // The parent installs its message listener from a client-side effect,
        // while this island also mounts on load. Re-answer a readiness probe
        // so a one-shot `sg:ready` sent just before the parent listener was
        // attached cannot leave this frame permanently unsynchronized. A
        // late-attaching listener (e.g. `Island when="visible"` on a
        // below-the-fold frame) also misses the mount/100ms/500ms height
        // reports below, with no other recovery path, so re-post the current
        // height alongside readiness (#537).
        window.parent?.postMessage({ type: MSG_READY }, "*");
        reportHeight();
        return;
      }
      if (isUpdatePropsMessage(e.data)) {
        setOverrides((prev) => ({ ...prev, ...e.data.props }));
        return;
      }
      if (isSetThemeMessage(e.data)) {
        document.documentElement.dataset.theme = e.data.theme;
      }
    }
    window.addEventListener("message", onMessage);
    // Hydration marker read by the dev/e2e acceptance checks (ADR proof table).
    document.documentElement.dataset.sgPreviewHydrated = "1";
    window.parent?.postMessage({ type: MSG_READY }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Report content height to the parent so it can size the iframe.
  useEffect(() => {
    reportHeight();
    const t1 = window.setTimeout(reportHeight, 100);
    const t2 = window.setTimeout(reportHeight, 500);
    const ro = new ResizeObserver(reportHeight);
    ro.observe(document.body);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      ro.disconnect();
    };
  }, []);

  if (!entry || !variantEntry) {
    return (
      <div class="p-hsp-md text-muted text-small">
        Unknown preview: slug=<code>{slug}</code> variant=<code>{variant}</code>
      </div>
    );
  }

  // Explicit precedence: control defaults < the variant's own static args <
  // live overrides from the controls panel. (Starter variants declare no
  // static args, so `variantArgs` is empty for now — kept in the merge so a
  // variant CAN pin args that the panel overlays.)
  const variantArgs: Record<string, unknown> = {};
  const merged = {
    ...defaultsFromControls(variantEntry.story.controls),
    ...variantArgs,
    ...overrides,
  };

  return (
    <div class="p-hsp-md" data-sg-variant-root>
      {variantEntry.story.render(merged)}
    </div>
  );
}

PreviewApp.displayName = "PreviewApp";
export default PreviewApp;
