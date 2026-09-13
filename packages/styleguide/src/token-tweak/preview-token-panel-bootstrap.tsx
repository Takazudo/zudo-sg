"use client";

// Scanner-visible island for the preview token panel. Hosts render it through
// zfb's `<Island>` from a file their `pages/` graph statically imports (ADR
// decision 7), e.g. `pages/lib/_body-end-islands.tsx`.
//
// Host data (manifest-derived tabs) and the dev-only apply wiring arrive
// through `virtual:zudo-sg-preview-token-panel`, registered by
// `@takazudo/zudo-sg/plugins/zdtp-apply-proxy`; the island takes no props so
// no config is serialized into every page's HTML. Without a `tabsModule`
// option the virtual module exports `tabs = undefined` and this renders
// nothing.

import type { JSX } from "preact";
import type { PanelConfig } from "@takazudo/zdtp";
import { applyEndpoint, applyRouting, tabs } from "virtual:zudo-sg-preview-token-panel";
import { bootstrapPreviewTokenPanel } from "./bootstrap-preview-token-panel.js";
import { createPreviewTokenPanelConfig } from "./preview-token-panel-config.js";

let config: PanelConfig | undefined;

function getConfig(): PanelConfig {
  config ??= createPreviewTokenPanelConfig({ tabs: tabs ?? [] }, { applyEndpoint, applyRouting });
  return config;
}

// Combined `export default function Name() {}` form, not a separate
// `function Name() {}` + `export default Name;` — tsup/esbuild's ESM
// transform renames the latter's binding to `<name>_default` in the
// compiled dist output, which breaks zfb's island scanner (it matches the
// SSR marker against the exported identifier name). See the sibling
// islands (CodePanel, DetailWorkbench, PreviewTokensButton) for the same
// pattern, proven to survive the tsup build.
export default function PreviewTokenPanelBootstrap(): JSX.Element | null {
  if (tabs) bootstrapPreviewTokenPanel(getConfig);
  return null;
}
PreviewTokenPanelBootstrap.displayName = "PreviewTokenPanelBootstrap";
