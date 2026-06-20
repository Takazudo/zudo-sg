/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Inline blocking scripts for the styleguide panel chrome:
//
//   PanelStateHeadScript — runs in <head> BEFORE first paint. Restores the
//     persisted panel widths (CSS vars) and hidden states (data-attrs) onto
//     <html> so a reload doesn't flash the default layout. Mirrors zzmod's
//     panel-state-head-script.
//
//   PanelResizersInitScript — runs at body-end. Wires drag-to-resize handles
//     for the sidebar + code panel, updating the CSS var live and persisting
//     the final width. Mirrors zzmod's panel-resizers-init-script.
//
// Both inline the SAME literal key/var/attr strings as
// chrome/panel-contract.ts (an inline <script> can't import the module), so
// keep them aligned with that file.

import type { JSX } from "preact";

const RESTORE_SCRIPT = `(function(){try{
  var r=document.documentElement, ls=localStorage;
  var sw=ls.getItem('sg-sidebar-width'); if(sw) r.style.setProperty('--sg-sidebar-w', sw+'px');
  var cw=ls.getItem('sg-code-panel-width'); if(cw) r.style.setProperty('--sg-code-panel-w', cw+'px');
  if(ls.getItem('sg-sidebar-hidden')==='1') r.setAttribute('data-sg-sidebar-hidden','');
  if(ls.getItem('sg-code-panel-hidden')==='1') r.setAttribute('data-sg-code-panel-hidden','');
}catch(e){}})();`;

const RESIZER_SCRIPT = `(function(){
  if(window.__sgResizersInstalled) return;
  window.__sgResizersInstalled=true;
  var MIN_SB=200, MIN_CP=280;
  function clamp(v,min){ return Math.max(min, Math.min(v, Math.floor(window.innerWidth*0.6))); }
  function persist(key,val){ try{ localStorage.setItem(key, String(Math.round(val))); }catch(e){} }
  function attach(handle){
    var side=handle.getAttribute('data-sg-resizer'); // 'sidebar' | 'code'
    handle.addEventListener('pointerdown', function(e){
      e.preventDefault();
      handle.setAttribute('data-sg-dragging','');
      handle.setPointerCapture(e.pointerId);
      var r=document.documentElement;
      function onMove(ev){
        var w;
        if(side==='sidebar'){
          w=clamp(ev.clientX, MIN_SB);
          r.style.setProperty('--sg-sidebar-w', w+'px');
        } else {
          w=clamp(window.innerWidth-ev.clientX, MIN_CP);
          r.style.setProperty('--sg-code-panel-w', w+'px');
        }
      }
      function onUp(ev){
        handle.removeAttribute('data-sg-dragging');
        try{ handle.releasePointerCapture(ev.pointerId); }catch(_){}
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        var cs=getComputedStyle(document.documentElement);
        if(side==='sidebar') persist('sg-sidebar-width', parseFloat(cs.getPropertyValue('--sg-sidebar-w')));
        else persist('sg-code-panel-width', parseFloat(cs.getPropertyValue('--sg-code-panel-w')));
      }
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    });
  }
  function init(){
    document.querySelectorAll('[data-sg-resizer]').forEach(function(h){
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
