// Styleguide chrome contract — the single source of truth for the panel
// layout's localStorage keys, CSS custom-property names, and data-attributes.
//
// Adapted from zzmod's `panel-toggle-contract.ts`. Pure constants + DOM
// helpers; safe to import from both SSR (constants only) and client islands.
// The inline head scripts (panel-state-head-script, resizer-init-script)
// hard-code the SAME literal strings, so keep them in sync if you rename here.

// ── Data attributes on <html> (drive visibility via CSS) ───────────────────
export const ATTR_SIDEBAR_HIDDEN = "data-sg-sidebar-hidden";
export const ATTR_CODE_PANEL_HIDDEN = "data-sg-code-panel-hidden";

// ── localStorage keys ──────────────────────────────────────────────────────
export const LS_SIDEBAR_HIDDEN = "sg-sidebar-hidden";
export const LS_CODE_PANEL_HIDDEN = "sg-code-panel-hidden";
export const LS_SIDEBAR_WIDTH = "sg-sidebar-width";
export const LS_CODE_PANEL_WIDTH = "sg-code-panel-width";

// ── CSS custom properties (panel widths) ───────────────────────────────────
export const CSS_VAR_SIDEBAR_W = "--sg-sidebar-w";
export const CSS_VAR_CODE_PANEL_W = "--sg-code-panel-w";

// ── Min/max constraints (px) ───────────────────────────────────────────────
export const MIN_SIDEBAR_W = 200;
export const MIN_CODE_PANEL_W = 280;

// ── Element ids / markers ──────────────────────────────────────────────────
export const ID_SIDEBAR = "sg-sidebar";
export const ID_CODE_PANEL = "sg-code-panel";
export const ATTR_SIDEBAR_RESIZER = "data-sg-sidebar-resizer";
export const ATTR_CODE_PANEL_RESIZER = "data-sg-code-panel-resizer";

// ── Client-only DOM helpers ────────────────────────────────────────────────

function root(el?: HTMLElement): HTMLElement {
  return el ?? document.documentElement;
}

export function isSidebarHidden(el?: HTMLElement): boolean {
  return root(el).hasAttribute(ATTR_SIDEBAR_HIDDEN);
}

export function isCodePanelHidden(el?: HTMLElement): boolean {
  return root(el).hasAttribute(ATTR_CODE_PANEL_HIDDEN);
}

function setHidden(
  attr: string,
  lsKey: string,
  hidden: boolean,
  el?: HTMLElement,
): void {
  const r = root(el);
  if (hidden) r.setAttribute(attr, "");
  else r.removeAttribute(attr);
  try {
    localStorage.setItem(lsKey, hidden ? "1" : "0");
  } catch {
    /* private mode / disabled storage */
  }
}

export function setSidebarHidden(hidden: boolean, el?: HTMLElement): void {
  setHidden(ATTR_SIDEBAR_HIDDEN, LS_SIDEBAR_HIDDEN, hidden, el);
}

export function setCodePanelHidden(hidden: boolean, el?: HTMLElement): void {
  setHidden(ATTR_CODE_PANEL_HIDDEN, LS_CODE_PANEL_HIDDEN, hidden, el);
}

export function toggleSidebar(el?: HTMLElement): void {
  setSidebarHidden(!isSidebarHidden(el), el);
}

export function toggleCodePanel(el?: HTMLElement): void {
  setCodePanelHidden(!isCodePanelHidden(el), el);
}

export function setPanelWidth(
  cssVar: string,
  lsKey: string,
  px: number,
  el?: HTMLElement,
): void {
  root(el).style.setProperty(cssVar, `${px}px`);
  try {
    localStorage.setItem(lsKey, String(Math.round(px)));
  } catch {
    /* ignore */
  }
}

export function getPersistedWidth(lsKey: string): number | undefined {
  try {
    const raw = localStorage.getItem(lsKey);
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}
