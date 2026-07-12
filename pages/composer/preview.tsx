/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The isolated Composer preview route (`/composer/preview`).
//
// The `src` of the preview iframe the Composer canvas mounts. Chrome-free by
// design: it owns its OWN full `<html>` document rather than going through the
// docs DocLayout, because the point of the iframe is that the authored
// composition renders with the component library's own styles and NOTHING of the
// editor's chrome around it.
//
// It follows the same architecture as `pages/components/preview.tsx` (the
// styleguide's variant preview) — complete document, explicit global-CSS import,
// `noindex`, an SSR-skipped client island, and the dev EventSource stub — but it
// speaks a DIFFERENT, versioned, zod-validated protocol
// (`src/features/composer/preview/protocol.ts`), not the styleguide's `sg:*`
// messages.
//
// Static-host reality: zfb emits ONE `/composer/preview/index.html`. Everything
// that varies (the document, the mode, the theme, the selection) arrives over
// postMessage after `ready` — never from the query string, never from SSR props.

import "../../src/styles/global.css";

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import ComposerPreviewApp from "@/features/composer/preview/preview-app";
import {
  COMPOSER_PREVIEW_CSS,
  COMPOSER_PREVIEW_DOC_ATTR,
} from "@/features/composer/preview/preview-styles";

export const frontmatter = { title: "Composer preview" };

export default function ComposerPreviewRoute(): JSX.Element {
  // SSR-skip island: the preview has nothing to render until the parent sends a
  // snapshot, so the server renders a placeholder and the runtime mounts the app
  // on load. Mounting the app is also what ANNOUNCES `ready` — so the parent
  // learns it can send.
  const app = Island({
    when: "load",
    ssrFallback: <div data-composer-preview-loading />,
    children: <ComposerPreviewApp />,
  }) as unknown as VNode;

  // `COMPOSER_PREVIEW_DOC_ATTR` is spread rather than typed inline because it is
  // the scope hook the CSS below keys off — one constant, two uses, no drift.
  const docAttrs = { [COMPOSER_PREVIEW_DOC_ATTR]: true } as Record<string, boolean>;

  return (
    <html lang="en" {...docAttrs}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>Composer preview</title>
        {/* DEV-ONLY: the zfb dev server injects /__zfb/livereload.js into every
            served document, including this iframe route. Each preview iframe
            would then hold a permanent EventSource to /__zfb/reload, and the
            Composer can have two previews open at once (canvas + chooser) on top
            of the parent's own — burning through the browser's 6-per-host
            HTTP/1.1 connection cap. Stub the livereload SSE inside the iframe so
            it never holds a connection. No-op in production (livereload.js is
            not injected into the static build). Same stub as
            pages/components/preview.tsx. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var R=window.EventSource;if(!R)return;window.EventSource=function(u,o){if(typeof u==='string'&&u.indexOf('__zfb/reload')!==-1){return{close:function(){},addEventListener:function(){},removeEventListener:function(){},onmessage:null,onerror:null,onopen:null,readyState:2};}return new R(u,o);};window.EventSource.prototype=R.prototype;}catch(e){}})();",
          }}
        />
        {/* The preview's palette scope + editor chrome. Inlined rather than
            imported: zfb emits ONE global stylesheet bundle, so a feature-local
            .css file would never reach this document without editing
            src/styles/global.css (owned by #247). See preview-styles.ts. */}
        <style dangerouslySetInnerHTML={{ __html: COMPOSER_PREVIEW_CSS }} />
      </head>
      <body>{app}</body>
    </html>
  );
}
