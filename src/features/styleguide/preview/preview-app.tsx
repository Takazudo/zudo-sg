"use client";

// Client-only app that runs INSIDE each isolated preview iframe (route
// `/components/preview`).
//
// Static-host reality: zfb emits ONE `/components/preview/index.html`; the
// query string is ignored by static hosting, so every variant iframe loads the
// SAME HTML. The variant to show is therefore resolved CLIENT-SIDE from
// `location.search` (`?slug=button&variant=Variants`), not from SSR props.
//
// This island imports the story registry directly (eager static imports), so
// the variant `render()` closures are bundled into the island chunk and run in
// the browser — no per-story lazy loader / codegen needed.
//
// Token tweaks: `installIframeReceiver` listens for zudo-doc's theme
// `apply-css-vars` bridge messages and writes them onto this document's
// :root, so the design-token tweaker live-updates this preview.

import type { JSX } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import type { StoryControl } from "@zudo-sg/ui";
import { installIframeReceiver } from "@takazudo/zudo-doc/theme";
import { getStoryBySlug } from "@/styleguide/data/registry";
import { MSG_HEIGHT, isUpdatePropsMessage } from "./messages";

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

function PreviewApp(): JSX.Element {
  const [{ slug, variant }] = useState(readParams);
  // Live prop overrides pushed from the parent's controls panel. Read on every
  // render and merged into the story's render args (see `merged` below).
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});

  const entry = useMemo(() => getStoryBySlug(slug), [slug]);
  const variantEntry = useMemo(
    () => entry?.variants.find((v) => v.exportName === variant),
    [entry, variant],
  );

  // Install the design-token bridge receiver once.
  useEffect(() => installIframeReceiver(window), []);

  // Accept live prop updates from the parent (controls panel).
  //
  // Trust model: this preview iframe is same-origin with its parent
  // (`sandbox="allow-same-origin allow-scripts"`), so `window.parent` is a
  // same-origin window we can compare against. Accept ONLY messages whose
  // source is the parent and whose payload is a well-formed `sg:updateProps`
  // envelope; ignore everything else.
  useEffect(() => {
    function onMessage(e: MessageEvent): void {
      if (e.source !== window.parent) return;
      if (!isUpdatePropsMessage(e.data)) return;
      setOverrides((prev) => ({ ...prev, ...e.data.props }));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Report content height to the parent so it can size the iframe.
  useEffect(() => {
    function report(): void {
      const height = document.body.scrollHeight;
      window.parent?.postMessage({ type: MSG_HEIGHT, height }, "*");
    }
    report();
    const t1 = window.setTimeout(report, 100);
    const t2 = window.setTimeout(report, 500);
    const ro = new ResizeObserver(report);
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
