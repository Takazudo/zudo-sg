"use client";
/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// No-props island wrapper for the engine's preview app (ADR
// docs/adr/styleguide-engine.md decision 10 "Preview island").
//
// zfb serializes island props to JSON (`data-props`), so the story registry —
// whose variants carry `render()` closures — cannot ride as props. This
// wrapper takes NO props and imports the host registry in-bundle, which puts
// every story closure into the islands chunk. `pages/components/preview.tsx`
// imports it statically, so the island scanner registers it in both
// `zfb build` and `zfb dev` (ADR findings 3 and 4). #662 moves this wrapper
// into the package as `routes-src/_preview-app.tsx`.
//
// The design-token bridge receiver is installed here, not inside PreviewApp,
// so the engine's preview component stays free of the token-tweak feature.

import type { JSX } from "preact";
import { useEffect } from "preact/hooks";
import { PreviewApp } from "@takazudo/zudo-sg/preview";
import { registry } from "@/styleguide/registry";
import { installIframeReceiver } from "@takazudo/zudo-sg/token-tweak";

export default function ConfiguredPreviewApp(): JSX.Element {
  useEffect(() => installIframeReceiver(window), []);
  return <PreviewApp registry={registry} />;
}

ConfiguredPreviewApp.displayName = "ConfiguredPreviewApp";
