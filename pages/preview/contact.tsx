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
// Chrome-free (mirrors the engine /components/preview route): owns its own `<html>`
// document rather than going through the docs DocLayout, so it must
// explicitly import the root CSS bundle for the page's own utility classes.
// Marked `data-sg-preview-doc` — the same attribute
// the engine preview route uses — and links the same standalone preview
// stylesheet (/_zudo-sg/preview.css), whose `:root[data-sg-preview-doc]` token
// roots restore the @zudo-sg/ui palette over the bundle's doc-chrome
// re-assertion (this document has no ColorSchemeProvider, so the re-asserted
// --color-accent/-danger/etc. would otherwise resolve to undefined --zd-*).
//
// All MSW/fetch/state logic lives in the ContactFormDemo island — this module
// stays server-rendered scaffolding, per the previewRoute contract (mocking
// must never reach packages/ui/src or *.stories.tsx, and page modules here
// are SSR code so the browser-only bits must be client-island-only).

import "../../src/styles/global.css";

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import ContactFormDemo from "@/features/styleguide/preview-demos/contact-form-demo";
import { withBase } from "@/utils/base";
import { DEFAULT_PREVIEW_CSS_URL } from "@takazudo/zudo-sg/sg-context";

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
        <link rel="stylesheet" href={withBase(DEFAULT_PREVIEW_CSS_URL)} />
      </head>
      <body class="bg-bg p-hsp-xl">
        <h1 class="mb-vsp-md text-heading font-bold">Contact form — live demo</h1>
        {app}
      </body>
    </html>
  );
}
