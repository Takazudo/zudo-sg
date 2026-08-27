/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Full-width placeholder for the Sitemapper island (issue #400).
//
// This is deliberately self-contained and utility-styled because the
// feature-level stylesheet is an import-only aggregator in this wave. Later
// waves replace the island body with the workspace shell and keep this file as
// a harmless fallback seam if they need it.

import type { JSX } from "preact";

export interface PlaceholderPaneProps {
  /** Heading shown while the production editor is not assembled yet. */
  title?: string;
  /** Supporting copy shown below the heading. */
  message?: string;
}

export function PlaceholderPane({
  title = "Sitemapper",
  message = "The sitemap editor will appear here.",
}: PlaceholderPaneProps): JSX.Element {
  return (
    <main
      class="sg-sitemapper-placeholder-pane flex min-h-[calc(100vh-var(--sg-header-h))] w-full flex-col items-center justify-center gap-vsp-xs p-hsp-xl text-center text-muted"
      data-sg-sitemapper-placeholder
    >
      <h1 class="text-heading font-semibold text-fg">{title}</h1>
      <p>{message}</p>
    </main>
  );
}

export const SitemapperPlaceholderPane = PlaceholderPane;

export default PlaceholderPane;
