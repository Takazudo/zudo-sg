/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Live demo page for the ContactForm component's `previewRoute`
// (packages/ui/STORIES.md §6) — reachable directly at `/preview/contact`,
// surfaced from the catalog detail page as a plain "Live demo" link. This is
// NOT the catalog's variant iframe system (`/components/preview`); it's a
// real page the story author owns, used precisely because a real async-submit
// flow against mocked network responses can't be demoed by a pure/sync
// `Story.render()`. Retargets the MSW preview infra from the retired
// /preview/dialog demo (#215/#212) onto the ported contact form (#228), now
// that Dialog dies in the Wave-6 atomic swap (#235).
//
// Chrome-free (mirrors pages/components/preview.tsx): owns its own `<html>`
// document rather than going through the docs DocLayout, so it must
// explicitly import the root CSS bundle for the rendered form's utility
// classes + design tokens. Marked `data-sg-preview-doc` — the same attribute
// pages/components/preview.tsx uses — rather than a page-specific one, so the
// `html[data-sg-preview-doc]` palette restoration in src/styles/preview.css
// (#223) applies here too: this document has no ColorSchemeProvider, so
// without that scoped rule the re-asserted --color-accent/-danger/etc. tokens
// (see global.css's collision-set comment) would resolve to the doc-chrome's
// undefined --zd-* variables.
//
// All MSW/fetch/state logic lives in the ContactFormDemo island — this module
// stays server-rendered scaffolding, per the previewRoute contract (mocking
// must never reach packages/ui/src or *.stories.tsx, and page modules here
// are SSR code so the browser-only bits must be client-island-only).

import "../../src/styles/global.css";

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import ContactFormDemo from "@/features/styleguide/preview-demos/contact-form-demo";

export const frontmatter = { title: "Contact Form Preview" };

export default function ContactPreviewRoute(): JSX.Element {
  const app = Island({
    when: "load",
    ssrFallback: <p data-sg-preview-demo-loading>Loading demo…</p>,
    children: <ContactFormDemo />,
  }) as unknown as VNode;

  return (
    <html lang="en" data-sg-preview-doc>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>Contact Form Preview</title>
      </head>
      <body class="bg-paper p-hsp-xl">
        <h1 class="mb-vsp-md text-heading font-bold">Contact form — live demo</h1>
        {app}
      </body>
    </html>
  );
}
