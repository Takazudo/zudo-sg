/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Isolated variant-preview route (`/components/preview`).
//
// Loaded as the `src` of every VariantFrame iframe on the detail pages. Each
// iframe passes `?slug=…&variant=…`; static hosting serves the SAME HTML for
// all of them, so PreviewApp (client-only) resolves the variant from
// `location.search`.
//
// This page is intentionally chrome-free (no layout header/sidebar) — it is
// only ever shown inside an iframe. It owns its OWN full `<html>` document
// (`data-sg-preview-doc`) rather than going through the docs DocLayout, so it
// must explicitly link the root CSS bundle: the relative `../../src/styles/
// global.css` import is what gets the rendered UI component its utility classes
// + design tokens. The design-token tweaker reaches it via the theme
// iframe-bridge receiver that PreviewApp installs.

import "../../src/styles/global.css";

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import PreviewApp from "@/features/styleguide/preview/preview-app";

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
        {/* DEV-ONLY: the zfb dev server injects /__zfb/livereload.js into every
            served document, including this iframe route. Each preview iframe
            would then open a permanent EventSource to /__zfb/reload; a detail
            page with 5+ variant iframes exhausts the browser's 6-per-host
            HTTP/1.1 connection cap, which stalls the next soft-nav fetch (the
            client-router navigation silently hangs). Stub the livereload SSE
            inside the iframe so it never holds a connection. No-op in
            production — livereload.js is not injected into the static build. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var R=window.EventSource;if(!R)return;window.EventSource=function(u,o){if(typeof u==='string'&&u.indexOf('__zfb/reload')!==-1){return{close:function(){},addEventListener:function(){},removeEventListener:function(){},onmessage:null,onerror:null,onopen:null,readyState:2};}return new R(u,o);};window.EventSource.prototype=R.prototype;}catch(e){}})();",
          }}
        />
      </head>
      <body class="bg-paper">{app}</body>
    </html>
  );
}
