/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Inline blocking scripts for the styleguide panel chrome:
//
//   PanelStateHeadScript — runs in <head> BEFORE first paint. Restores the
//     persisted code-panel width (CSS var) and the hidden state (data-attr)
//     onto <html> so a reload doesn't flash the default layout.
//
//   PanelResizersInitScript — runs at body-end. Wires the drag-to-resize
//     handle for the code panel, updating the CSS var live and persisting the
//     final width.
//
// The desktop SIDEBAR width is NOT handled here: it is owned by zudo-doc's
// DocLayout resizer (SidebarResizerInit / SidebarResizerRestore from
// @takazudo/zudo-doc/sidebar-resizer), which reads/writes the same
// `--zd-sidebar-w` var + `zudo-doc-sidebar-width` localStorage key declared in
// panel-contract.ts. These scripts cover only the styleguide-specific pieces:
// the code panel's width and hidden (toggle) state.
//
// Both inline the SAME literal key/var/attr strings as
// src/features/styleguide/chrome/panel-contract.ts (an inline <script> can't
// import the module), so keep them aligned with that file.

import type { JSX } from "preact";

// Restores the persisted code-panel state onto <html>. Runs once before first
// paint AND re-runs on every client-router soft-navigation (`zfb:after-swap`):
// zfb's router preserves only DocLayout's whitelisted <html> attrs across a
// swap, so the styleguide-private `data-sg-*` hidden attrs are dropped each
// navigation and must be re-applied — otherwise a hidden code panel reappears
// until a full reload. The listener binds to the persistent `document`
// (survives swaps). The branches set AND clear so the result is idempotent
// regardless of prior attrs.
const RESTORE_SCRIPT = `(function(){
  function restore(){try{
    var r=document.documentElement, ls=localStorage;
    var cw=ls.getItem('sg-code-panel-width'); if(cw) r.style.setProperty('--sg-code-panel-w', cw+'px');
    if(ls.getItem('sg-code-panel-hidden')==='1') r.setAttribute('data-sg-code-panel-hidden',''); else r.removeAttribute('data-sg-code-panel-hidden');
  }catch(e){}}
  restore();
  document.addEventListener('zfb:after-swap', restore);
})();`;

const RESIZER_SCRIPT = `(function(){
  if(window.__sgResizersInstalled) return;
  window.__sgResizersInstalled=true;
  var MIN_CP=280;
  var STEP=16;
  var ACCENT_OUTLINE='2px solid var(--zd-accent,rgba(128,128,128,0.5))';
  function maxCP(){ return Math.floor(window.innerWidth*0.6); }
  function clamp(v){ return Math.max(MIN_CP, Math.min(v, maxCP())); }
  function persist(val){ try{ localStorage.setItem('sg-code-panel-width', String(Math.round(val))); }catch(e){} }
  function attach(handle){
    var r=document.documentElement;
    var dragging=false, focused=false;
    function readCurrentWidth(){
      // Measure the real panel element — always px, unit-agnostic. The CSS var
      // default is authored as a rem-based clamp (--sg-code-panel-w:
      // clamp(20rem,35vw,32rem)) and getComputedStyle returns custom-property
      // text UNRESOLVED, so parseFloat on the var would yield a bogus leading
      // number, not pixels, collapsing the panel on first keyboard use. Fall
      // back to a rem-aware parse only if the element is absent.
      var panel=document.getElementById('sg-code-panel');
      var w=panel ? panel.getBoundingClientRect().width : 0;
      if(w) return w;
      var raw=getComputedStyle(r).getPropertyValue('--sg-code-panel-w').trim();
      var n=parseFloat(raw);
      if(!n) return MIN_CP;
      return raw.indexOf('rem')>=0 ? n*parseFloat(getComputedStyle(r).fontSize) : n;
    }
    var cachedWidth=readCurrentWidth();
    handle.setAttribute('aria-valuemin', String(MIN_CP));
    handle.setAttribute('aria-valuemax', String(maxCP()));
    handle.setAttribute('aria-valuenow', String(Math.round(cachedWidth)));
    function applyWidth(w){
      cachedWidth=clamp(w);
      r.style.setProperty('--sg-code-panel-w', cachedWidth+'px');
      persist(cachedWidth);
      handle.setAttribute('aria-valuenow', String(Math.round(cachedWidth)));
    }
    function updateVisual(){
      handle.style.outline=(focused&&!dragging) ? ACCENT_OUTLINE : '';
      handle.style.outlineOffset=(focused&&!dragging) ? '-2px' : '';
    }
    handle.addEventListener('focus', function(){ focused=true; updateVisual(); });
    handle.addEventListener('blur', function(){ focused=false; updateVisual(); });
    handle.addEventListener('keydown', function(e){
      var w=cachedWidth;
      if(e.key==='ArrowLeft') w=Math.max(MIN_CP, w-STEP);
      else if(e.key==='ArrowRight') w=Math.min(maxCP(), w+STEP);
      else if(e.key==='Home') w=MIN_CP;
      else if(e.key==='End') w=maxCP();
      else return;
      e.preventDefault();
      applyWidth(w);
    });
    handle.addEventListener('pointerdown', function(e){
      e.preventDefault();
      handle.setAttribute('data-sg-dragging','');
      handle.setPointerCapture(e.pointerId);
      dragging=true; updateVisual();
      function onMove(ev){
        applyWidth(window.innerWidth-ev.clientX);
      }
      function onUp(){
        handle.removeAttribute('data-sg-dragging');
        dragging=false; updateVisual();
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onCancel);
        handle.removeEventListener('lostpointercapture', onLost);
      }
      function onCancel(){
        handle.removeAttribute('data-sg-dragging');
        dragging=false; updateVisual();
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onCancel);
        handle.removeEventListener('lostpointercapture', onLost);
      }
      function onLost(){ onUp(); }
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onCancel);
      handle.addEventListener('lostpointercapture', onLost);
    });
  }
  function init(){
    document.querySelectorAll('[data-sg-code-panel-resizer]').forEach(function(h){
      if(h.__sgWired) return; h.__sgWired=true; attach(h);
    });
  }
  init();
  document.addEventListener('zfb:after-swap', init);
})();`;

export function PanelStateHeadScript(): JSX.Element {
  return <script dangerouslySetInnerHTML={{ __html: RESTORE_SCRIPT }} />;
}

export function PanelResizersInitScript(): JSX.Element {
  return <script dangerouslySetInnerHTML={{ __html: RESIZER_SCRIPT }} />;
}
