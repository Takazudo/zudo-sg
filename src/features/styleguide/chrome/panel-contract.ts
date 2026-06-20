// Styleguide chrome contract — the single source of truth for the code panel
// layout's localStorage keys, CSS custom-property names, and data-attributes.
//
// Pure constants + DOM helpers; safe to import from both SSR (constants only)
// and client islands. The inline head/body scripts (panel-state-head-script,
// resizer-init-script in panel-scripts.tsx) hard-code the SAME literal strings
// because an inline <script> cannot import this module — keep them in sync if
// you rename here.
//
// The styleguide renders THROUGH zudo-doc's DocLayout, which owns the desktop
// sidebar (`#desktop-sidebar`). Two consequences:
//   - The sidebar WIDTH is governed by DocLayout's own resizer: the CSS var
//     `--zd-sidebar-w` and the localStorage key `zudo-doc-sidebar-width`. We
//     reuse those exact names here so this contract and DocLayout share one
//     source of truth. Using a styleguide-private key would be a silent no-op.
//   - The code panel (DocLayout's TOC region) is styleguide-specific, so its
//     width + hidden state stay under styleguide-private `sg-*` names.
//
// SIDEBAR hidden state is NOT modelled here: the desktop sidebar toggle is
// owned entirely by root's desktop-sidebar-toggle island + the `data-sidebar-hidden`
// attribute (shared docs chrome). This module covers only the styleguide-private
// CODE PANEL (its width + hidden state); it does not duplicate any sidebar toggle
// logic or persistence.

// ── Data attributes on <html> (drive visibility via CSS) ───────────────────
export const ATTR_CODE_PANEL_HIDDEN = "data-sg-code-panel-hidden";

// ── localStorage keys ──────────────────────────────────────────────────────
export const LS_CODE_PANEL_HIDDEN = "sg-code-panel-hidden";
// Shared with zudo-doc's DocLayout sidebar resizer — see file header.
export const LS_SIDEBAR_WIDTH = "zudo-doc-sidebar-width";
export const LS_CODE_PANEL_WIDTH = "sg-code-panel-width";

// ── CSS custom properties (panel widths) ───────────────────────────────────
// `--zd-sidebar-w` is DocLayout's own sidebar-width var — see file header.
export const CSS_VAR_SIDEBAR_W = "--zd-sidebar-w";
export const CSS_VAR_CODE_PANEL_W = "--sg-code-panel-w";

// ── Min/max constraints (px) ───────────────────────────────────────────────
export const MIN_CODE_PANEL_W = 280;

// ── Element ids / markers ──────────────────────────────────────────────────
export const ID_CODE_PANEL = "sg-code-panel";
export const ATTR_CODE_PANEL_RESIZER = "data-sg-code-panel-resizer";

// ── Client-only DOM helpers ────────────────────────────────────────────────

function root(el?: HTMLElement): HTMLElement {
  return el ?? document.documentElement;
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

export function setCodePanelHidden(hidden: boolean, el?: HTMLElement): void {
  setHidden(ATTR_CODE_PANEL_HIDDEN, LS_CODE_PANEL_HIDDEN, hidden, el);
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
