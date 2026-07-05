// Source text for the inline blocking scripts rendered by panel-scripts.tsx.
// Split into a plain .ts module (no JSX) so it can be unit-tested directly —
// vitest's transform pipeline for src/**/*.tsx here relies on zfb's per-file
// JSX pragma, which the generic esbuild/rolldown path used for tests does not
// honor the same way (see __tests__/panel-scripts.test.ts).
//
// The rendered <script> tags are plain inline JS — they can't `import`
// panel-contract.ts at runtime — but THIS module runs at SSR/build time, so
// it interpolates panel-contract.ts's constants into the template strings
// below instead of hand-typing the literals a second time (#105). The
// key/var/attr strings live in panel-contract.ts only; renaming one there
// flows through here automatically.

import {
  ATTR_CODE_PANEL_HIDDEN,
  ATTR_CODE_PANEL_RESIZER,
  CSS_VAR_CODE_PANEL_W,
  ID_CODE_PANEL,
  LS_CODE_PANEL_HIDDEN,
  LS_CODE_PANEL_WIDTH,
  MIN_CODE_PANEL_W,
} from "./panel-contract";

export const RESTORE_SCRIPT = `(function(){
  function restore(){try{
    var r=document.documentElement, ls=localStorage;
    var cw=ls.getItem('${LS_CODE_PANEL_WIDTH}'); if(cw) r.style.setProperty('${CSS_VAR_CODE_PANEL_W}', cw+'px');
    if(ls.getItem('${LS_CODE_PANEL_HIDDEN}')==='1') r.setAttribute('${ATTR_CODE_PANEL_HIDDEN}',''); else r.removeAttribute('${ATTR_CODE_PANEL_HIDDEN}');
  }catch(e){}}
  restore();
})();`;

export const RESIZER_SCRIPT = `(function(){
  if(window.__sgResizersInstalled) return;
  window.__sgResizersInstalled=true;
  var MIN_CP=${MIN_CODE_PANEL_W};
  var STEP=16;
  var ACCENT_OUTLINE='2px solid var(--zd-accent,rgba(128,128,128,0.5))';
  function maxCP(){ return Math.floor(window.innerWidth*0.6); }
  function clamp(v){ return Math.max(MIN_CP, Math.min(v, maxCP())); }
  function persist(val){ try{ localStorage.setItem('${LS_CODE_PANEL_WIDTH}', String(Math.round(val))); }catch(e){} }
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
      var panel=document.getElementById('${ID_CODE_PANEL}');
      var w=panel ? panel.getBoundingClientRect().width : 0;
      if(w) return w;
      var raw=getComputedStyle(r).getPropertyValue('${CSS_VAR_CODE_PANEL_W}').trim();
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
      r.style.setProperty('${CSS_VAR_CODE_PANEL_W}', cachedWidth+'px');
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
    document.querySelectorAll('[${ATTR_CODE_PANEL_RESIZER}]').forEach(function(h){
      if(h.__sgWired) return; h.__sgWired=true; attach(h);
    });
  }
  init();
})();`;
