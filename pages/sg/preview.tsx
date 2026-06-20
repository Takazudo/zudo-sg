/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Isolated variant-preview route (`/sg/preview`).
//
// Loaded as the `src` of every VariantFrame iframe in the catalog. Each iframe
// passes `?slug=…&variant=…`; static hosting serves the SAME HTML for all of
// them, so PreviewApp (client-only) resolves the variant from `location.search`.
//
// This page is intentionally chrome-free (no DocLayout header/sidebar) — it is
// only ever shown inside an iframe. It links the main CSS bundle automatically
// (zfb injects `<link rel=stylesheet>` for `src/styles/global.css` into every
// page), so the rendered UI component gets its utility classes + tokens. The
// design-token tweaker reaches it via the theme iframe-bridge receiver that
// PreviewApp installs.

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import PreviewApp from "@/styleguide/preview/preview-app";

export const frontmatter = { title: "Preview" };

export default function PreviewRoute(): JSX.Element {
  // SSR-skip island: the variant only renders client-side (it depends on
  // `location.search`), so we render nothing server-side and let the runtime
  // mount PreviewApp on load.
  const app = Island({
    when: "load",
    ssrFallback: <div data-sg-preview-loading />,
    children: <PreviewApp />,
  }) as unknown as VNode;

  return (
    <html lang="en" data-sg-preview-doc>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>Preview</title>
      </head>
      <body class="bg-paper">{app}</body>
    </html>
  );
}
