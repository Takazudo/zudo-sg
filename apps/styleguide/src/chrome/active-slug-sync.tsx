/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Body-end inline script that re-syncs the sidebar's `aria-current="page"`
// highlight to the live URL after every SPA navigation.
//
// Why this is needed: zudo-doc's DocLayout can persist the desktop sidebar DOM
// node across same-section SPA swaps (zfb Strategy B). When the sidebar node
// survives a navigation, its SSR-baked `aria-current` no longer matches the new
// URL. zfb dispatches `AFTER_NAVIGATE_EVENT` (`zfb:after-swap`) on `document`
// once per swap (and once on first load); on each fire we recompute which
// sidebar link matches `location.pathname` and move the `aria-current` marker.
//
// The event name is inlined as a literal because an inline <script> can't
// import the module — it must stay equal to AFTER_NAVIGATE_EVENT from
// `@takazudo/zudo-doc/transitions` ("zfb:after-swap"). The import below pins a
// build-time assertion so a future rename in the package surfaces here.

import type { JSX } from "preact";
import { AFTER_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";

// Compile-time guard: fail the typecheck if the runtime literal below drifts
// from the package's event-name constant.
const _AFTER_NAVIGATE: "zfb:after-swap" = AFTER_NAVIGATE_EVENT;
void _AFTER_NAVIGATE;

const SYNC_SCRIPT = `(function(){
  function sync(){
    var here=location.pathname.replace(/\\/+$/,'')||'/';
    var nav=document.querySelector('.sg-sidebar-nav');
    if(!nav) return;
    nav.querySelectorAll('a[href]').forEach(function(a){
      var path=a.getAttribute('href')||'';
      try{ path=new URL(a.href).pathname; }catch(e){}
      path=path.replace(/\\/+$/,'')||'/';
      if(path===here) a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    });
  }
  sync();
  document.addEventListener('zfb:after-swap', sync);
})();`;

export function ActiveSlugSyncScript(): JSX.Element {
  return <script dangerouslySetInnerHTML={{ __html: SYNC_SCRIPT }} />;
}
