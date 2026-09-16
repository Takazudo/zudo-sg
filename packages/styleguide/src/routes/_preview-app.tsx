"use client";
/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// No-props island wrapper for the engine's preview app (ADR
// docs/adr/styleguide-engine.md decision 10 "Preview island").
//
// zfb serializes island props to JSON (`data-props`), so the story registry —
// whose variants carry `render()` closures — cannot ride as props. This
// wrapper takes NO props and imports the registry in-bundle (through
// `_registry.ts` → `virtual:zudo-sg-registry`), which puts every story closure
// into the islands chunk. `components-preview.tsx` imports it statically so
// `zfb build` registers it; `@takazudo/zudo-sg/islands` imports it too (the
// kept-for-API seed; zfb ≥ 2.18.0 registers it from the route entrypoint in
// dev as well — ADR finding 4 amendment).
//
// The design-token bridge receiver is installed here, not inside PreviewApp,
// so the engine's preview component stays free of the token-tweak feature.
//
// Keep the combined `export default function Name() {}` form: zfb's island
// scanner matches the SSR marker against the exported function name.

import type { JSX } from "preact";
import { useEffect } from "preact/hooks";
import { PreviewApp } from "../preview/index.js";
import { installIframeReceiver } from "../token-tweak/index.js";
import { registry } from "./_registry.js";

export default function ConfiguredPreviewApp(): JSX.Element {
  useEffect(() => installIframeReceiver(window), []);
  return <PreviewApp registry={registry} />;
}

ConfiguredPreviewApp.displayName = "ConfiguredPreviewApp";
