/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Live demo page for the Dialog component's `previewRoute`
// (packages/ui/STORIES.md §6) — reachable directly at `/preview/dialog`,
// surfaced from the catalog detail page as a plain "Live demo" link. This is
// NOT the catalog's variant iframe system (`/components/preview`); it's a
// real page the story author owns, used precisely because a real async-submit
// flow against mocked network responses can't be demoed by a pure/sync
// `Story.render()`.
//
// Chrome-free (mirrors pages/components/preview.tsx): owns its own `<html>`
// document rather than going through the docs DocLayout, so it must
// explicitly import the root CSS bundle for the rendered Dialog's utility
// classes + design tokens.
//
// All MSW/fetch/state logic lives in the DialogDemo island — this module
// stays server-rendered scaffolding, per the previewRoute contract (mocking
// must never reach packages/ui/src or *.stories.tsx, and page modules here
// are SSR code so the browser-only bits must be client-island-only).

import "../../src/styles/global.css";

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import DialogDemo from "@/features/styleguide/preview-demos/dialog-demo";

export const frontmatter = { title: "Dialog Preview" };

export default function DialogPreviewRoute(): JSX.Element {
  const app = Island({
    when: "load",
    ssrFallback: <p data-sg-preview-demo-loading>Loading demo…</p>,
    children: <DialogDemo />,
  }) as unknown as VNode;

  return (
    <html lang="en" data-sg-preview-demo-doc>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>Dialog Preview</title>
      </head>
      <body class="bg-paper p-hsp-xl">
        <h1 class="mb-vsp-md text-heading font-bold">Dialog — live demo</h1>
        {app}
      </body>
    </html>
  );
}
