/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Isolated variant-preview route (`/components/preview`).
//
// Loaded as the `src` of every VariantFrame iframe on the detail pages. Each
// iframe passes `?slug=…&variant=…`; static hosting serves the SAME HTML for
// all of them, so PreviewApp (client-only) resolves the variant from
// `location.search`. It is mounted through the no-props ConfiguredPreviewApp
// wrapper (pages/lib/_configured-preview-app.tsx): island props are JSON, so
// the registry's render closures must travel in-bundle, never as props.
//
// This page is intentionally chrome-free (no layout header/sidebar) — it is
// only ever shown inside an iframe. It owns its OWN full `<html>` document
// (`data-sg-preview-doc`) rather than going through the docs DocLayout. zfb
// still injects the single global bundle (the `global.css` import below) into
// it, and that bundle re-asserts the semantic color names to doc-chrome
// `--zd-*` values this document has no source for. The palette therefore comes
// from the standalone preview stylesheet linked in <head>
// (@takazudo/zudo-sg/plugins/preview-css, served/emitted at
// /_zudo-sg/preview.css): its token roots are rescoped to
// `:root[data-sg-preview-doc]`, which outranks the bundle's `:root`. The
// design-token tweaker reaches it via the theme iframe-bridge receiver that
// ConfiguredPreviewApp installs.

import "../../src/styles/global.css";

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import ConfiguredPreviewApp from "../lib/_configured-preview-app";
import { withBase } from "@/utils/base";
import { DEFAULT_PREVIEW_CSS_URL } from "@takazudo/zudo-sg/sg-context";

export const frontmatter = { title: "Preview" };

export default function PreviewRoute(): JSX.Element {
  // SSR-skip island: the variant only renders client-side (it depends on
  // `location.search`), so we render nothing server-side and let the runtime
  // mount ConfiguredPreviewApp on load.
  const app = Island({
    when: "load",
    ssrFallback: <div data-sg-preview-loading />,
    children: <ConfiguredPreviewApp />,
  }) as unknown as VNode;

  return (
    <html lang="en" data-sg-preview-doc>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>Preview</title>
        <link rel="stylesheet" href={withBase(DEFAULT_PREVIEW_CSS_URL)} />
        {/* DEV-ONLY: the zfb dev server injects /__zfb/livereload.js into every
            served document, including this iframe route. Each preview iframe
            would then open a permanent EventSource to /__zfb/reload; a detail
            page with 5+ variant iframes exhausts the browser's 6-per-host
            HTTP/1.1 connection cap. Stub the livereload SSE inside the iframe
            so it never holds a connection. No-op in production — livereload.js
            is not injected into the static build. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var R=window.EventSource;if(!R)return;window.EventSource=function(u,o){if(typeof u==='string'&&u.indexOf('__zfb/reload')!==-1){return{close:function(){},addEventListener:function(){},removeEventListener:function(){},onmessage:null,onerror:null,onopen:null,readyState:2};}return new R(u,o);};window.EventSource.prototype=R.prototype;}catch(e){}})();",
          }}
        />
      </head>
      <body class="bg-bg">{app}</body>
    </html>
  );
}
