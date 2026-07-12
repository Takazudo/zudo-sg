import type { JSX } from "preact";
import {
  TRANSITION_BEFORE_PREPARATION,
  TRANSITION_AFTER_SWAP,
  TRANSITION_NAVIGATION_ABORTED,
} from "@takazudo/zfb-runtime";

/**
 * SPA-navigation loading overlay + indicator.
 *
 * Zero-hydration: SSR markup (overlay + spinner + progress bar) plus a
 * self-wiring inline `<script>` — not an island. Mounted body-end in
 * layouts/default.tsx.
 *
 * Tone: the scrim is `--color-loading-scrim` (a light frost derived from
 * `--color-bg`, not a black backdrop) with a centered spinner + top progress
 * bar in `--color-accent`. CSS lives in styles/transitions.css (a `<style>`
 * in `<body>` would be an html-validate violation).
 *
 * Event names are read from `@takazudo/zfb-runtime` at SSR time and inlined
 * via `JSON.stringify` — no magic string literals in the injected script.
 */

const PAGE_LOADING_OVERLAY_ID = "zd-page-loading-overlay";

/** Marks the clicked nav link as pending (accent-colored while navigating). */
const PENDING_ATTR = "data-zd-nav-pending";

/** Delay (ms) before showing — avoids a flash for navigations that finish faster than this. */
const SHOW_DELAY_MS = 150;

/** Guard flag name so the inline script only wires up once. */
const BIND_FLAG = "__zdPageLoadingOverlayBound";

function buildBootstrap(overlayId: string): string {
  const id = JSON.stringify(overlayId);
  const pendingAttr = JSON.stringify(PENDING_ATTR);
  const before = JSON.stringify(TRANSITION_BEFORE_PREPARATION);
  const afterSwap = JSON.stringify(TRANSITION_AFTER_SWAP);
  const aborted = JSON.stringify(TRANSITION_NAVIGATION_ABORTED);
  const delay = JSON.stringify(SHOW_DELAY_MS);
  const flag = JSON.stringify(BIND_FLAG);

  return `(function(){
var g=globalThis;
if(g[${flag}])return;
g[${flag}]=true;
var id=${id};
var pendingAttr=${pendingAttr};
var timer=null;
function show(){var el=document.getElementById(id);if(!el)return;el.setAttribute("data-visible","");el.setAttribute("aria-hidden","false");}
function hide(){var el=document.getElementById(id);if(!el)return;el.removeAttribute("data-visible");el.setAttribute("aria-hidden","true");}
function clearTimer(){if(timer!==null){clearTimeout(timer);timer=null;}}
function clearPending(){var nodes=document.querySelectorAll("["+pendingAttr+"]");for(var i=0;i<nodes.length;i++){nodes[i].removeAttribute(pendingAttr);}}
function onBefore(ev){
clearTimer();
clearPending();
var src=ev&&ev.sourceElement;
if(src&&src instanceof Element)src.setAttribute(pendingAttr,"");
timer=setTimeout(function(){timer=null;show();},${delay});
}
function onEnd(){clearTimer();hide();clearPending();}
document.addEventListener(${before},onBefore);
document.addEventListener(${afterSwap},onEnd);
document.addEventListener(${aborted},onEnd);
})();`;
}

/** Overlay markup + self-wiring script. No island needed (pure SSR). */
export default function PageLoadingOverlay(): JSX.Element {
  return (
    <>
      <div id={PAGE_LOADING_OVERLAY_ID} class="page-loading-overlay" aria-hidden="true">
        <span class="page-loading-bar" />
        <span class="page-loading-spinner" />
      </div>
      <script
        // eslint-disable-next-line react/no-danger -- zero-hydration self-wiring script
        dangerouslySetInnerHTML={{ __html: buildBootstrap(PAGE_LOADING_OVERLAY_ID) }}
      />
    </>
  );
}

PageLoadingOverlay.displayName = "PageLoadingOverlay";

export { PAGE_LOADING_OVERLAY_ID, PENDING_ATTR };
