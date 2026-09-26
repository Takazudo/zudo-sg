/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Injected at `sgContext.routes.componentsPreview` — the isolated variant
// preview document loaded as the `src` of every VariantFrame iframe.
//
// Static hosting serves the SAME HTML for every `?slug=…&variant=…`, so the
// variant is resolved client-side by PreviewApp (through the no-props
// `ConfiguredPreviewApp` island, statically imported below so the island
// scanner registers it). Chrome-free: it owns its full `<html>` document.
//
// Styling: the standalone-compiled preview stylesheet
// (`@takazudo/zudo-sg/plugins/preview-css`) is linked here, and `<html>`
// carries `data-sg-preview-doc` — the compiler rescopes every token block to
// `:root[data-sg-preview-doc]`, so the preview world's tokens beat the host
// bundle zfb injects into every route. This entrypoint links assets only; it
// never calls plugin helpers.
//
// Descriptor mode never reaches this file: `resolveRoutesPluginOptions`
// (issue #884) requires an `externalPreview` in descriptor mode, which
// implies `componentsPreview` disabled — the route plugin never injects this
// entrypoint there, so it needs no descriptor-mode branch of its own.

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import ConfiguredPreviewApp from "./_preview-app.js";
import { ctx, withBase } from "./_context.js";

export const frontmatter = { title: "Preview" };

// DEV-ONLY: the zfb dev server injects /__zfb/livereload.js into every served
// document. Each preview iframe would then hold a permanent EventSource to
// /__zfb/reload; a detail page with 5+ variant iframes exhausts the browser's
// 6-per-host HTTP/1.1 connection cap. Stubbing it inside the iframe keeps the
// connection closed. No-op in a static build (no livereload script there).
const LIVERELOAD_STUB =
  "(function(){try{var R=window.EventSource;if(!R)return;window.EventSource=function(u,o){if(typeof u==='string'&&u.indexOf('__zfb/reload')!==-1){return{close:function(){},addEventListener:function(){},removeEventListener:function(){},onmessage:null,onerror:null,onopen:null,readyState:2};}return new R(u,o);};window.EventSource.prototype=R.prototype;}catch(e){}})();";

export default function ComponentsPreviewRoute(): JSX.Element {
  // SSR-skip island: the variant depends on `location.search`, so nothing
  // renders server-side and the runtime mounts ConfiguredPreviewApp on load.
  const app = Island({
    when: "load",
    ssrFallback: <div data-sg-preview-loading />,
    children: <ConfiguredPreviewApp />,
  }) as unknown as VNode;

  return (
    // Chrome-free document (no header, no client router), so the persisted-vs-
    // swapped distinction in ./_chrome.tsx doesn't apply here — the marker is
    // still emitted for route-family completeness (issue #815 AC).
    <html lang="en" data-sg-preview-doc data-sg-engine-route>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>Preview</title>
        <link rel="stylesheet" href={withBase(ctx.previewCssUrl)} data-sg-preview-css />
        <script dangerouslySetInnerHTML={{ __html: LIVERELOAD_STUB }} />
      </head>
      {/* The preview canvas follows host preview tokens, not engine chrome tokens. */}
      <body class="bg-bg">{app}</body>
    </html>
  );
}
