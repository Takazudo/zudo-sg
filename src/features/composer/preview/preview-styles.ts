// Feature-local CSS for the Composer preview DOCUMENT (`/composer/preview`).
//
// ── Why a string, inlined into the document's own <head> ─────────────────────
// zfb builds ONE authored global stylesheet (it resolves `src/styles/global.css`
// and emits a single hashed bundle every page links); a page that imports some
// OTHER `.css` file does NOT get a second bundle. So a feature-local
// `composer-preview.css` would need an `@import` added to `src/styles/global.css`
// — a file the parallel #247 route-shell issue owns exclusively — and the
// chrome classes below would also need `src/features/composer/**` added to that
// file's Tailwind `@source` list.
//
// Rather than take a cross-ownership edit, this runtime carries its own CSS as a
// string and the route inlines it into the preview document's `<head>`. It is
// therefore:
//   - guaranteed present inside the iframe, with no shared-stylesheet edit;
//   - scoped to `html[data-composer-preview-doc]`, which ONLY this document
//     carries, so the host chrome is provably unaffected;
//   - free of Tailwind utilities, so it needs no `@source` registration.
//
// The palette half below IS a deliberate near-duplicate of the styleguide's
// `html[data-sg-preview-doc]` block in `src/styles/preview.css` (same tokens,
// same values, different selector) — that file is already in the bundle, so the
// long-term dedup for the integration wave is to add this selector to it and
// delete the block here. Until then the duplication is held honest by
// `__tests__/preview-styles.test.ts`, which DERIVES the expected token/value set
// from `preview.css` and fails the moment the two drift.
//
// ── Part 1: palette restoration ─────────────────────────────────────────────
// The single global bundle's host `@theme` block RE-ASSERTS the overlapping
// @zudo-sg/ui semantic color names to the doc-chrome's `var(--zd-*)` values. The
// preview document never goes through the docs layout / ColorSchemeProvider, so
// it has no `--zd-*` — those re-asserted `--color-*` tokens would resolve to
// nothing and the previewed components would lose their colors. The block below
// RESTORES exactly the re-asserted names to the canonical @zudo-sg/ui values
// (the same `--palette-*` rungs, which ARE in the bundle). Same fix, same
// collision set, and the same source of truth as `src/styles/preview.css`
// (`packages/ui/styles/colors.css`) — a sibling scope, not a duplicate: that
// file's selector is `html[data-sg-preview-doc]` and never matches here.
//
// Specificity is (0,1,1), which beats the `:root` (0,1,0) the host `@theme`
// emits, so it wins regardless of source order.
//
// ── Part 2: the editor chrome ───────────────────────────────────────────────
// Selection/hover chrome is OUT OF FLOW (absolute, floated above the node's box)
// and hover is styled with pure CSS — no Preact hover state exists, so a hover
// can never trigger a diff, and selection is a bare attribute swap styled with
// `outline` (which does not reflow). See the DOM-identity note in `renderer.ts`.
//
// z-index uses the `--z-index-local-*` tier family: these affordances only need
// to sit above their own isolated parent node, never above app chrome (raw
// integers are rejected by `pnpm check:z-index`).

/** Attribute the preview document's `<html>` carries. The scope hook. */
export const COMPOSER_PREVIEW_DOC_ATTR = "data-composer-preview-doc";

export const COMPOSER_PREVIEW_CSS = `
/* ── Palette restoration (see header) ─────────────────────────────────────── */
html[${COMPOSER_PREVIEW_DOC_ATTR}] {
  --color-bg:           light-dark(var(--palette-base-0), var(--palette-base-10));
  --color-surface:      light-dark(var(--palette-base-1), var(--palette-base-9));
  --color-fg:           light-dark(var(--palette-base-8), var(--palette-base-2));
  --color-muted:        light-dark(var(--palette-base-5), var(--palette-base-4));
  --color-accent:       light-dark(var(--palette-accent-2), var(--palette-accent-1));
  --color-accent-hover: light-dark(var(--palette-accent-3), var(--palette-accent-0));
  /* Composer Polish S1 (#263). --color-border: the host now re-asserts it to a
     doc-ramp literal, so restore the ui value the previewed components expect
     (they bind border-border). --sg-composer-guide: the composer's quiet-chrome
     tone — the insert markers below rebind onto it in a later wave. Both are kept
     IDENTICAL to src/styles/preview.css (the drift-guard test derives from it). */
  --color-border:      light-dark(var(--palette-base-3), var(--palette-base-7));
  --sg-composer-guide: light-dark(oklch(.680 .008 65), oklch(.560 .008 65));
  --color-success: light-dark(var(--palette-state-success), var(--palette-state-success-dark));
  --color-danger:  light-dark(var(--palette-state-danger),  var(--palette-state-danger-dark));
  --color-warning: light-dark(var(--palette-state-warning), var(--palette-state-warning-dark));
  --color-info:    light-dark(var(--palette-state-info),    var(--palette-state-info-dark));
}

/* ── Canvas ───────────────────────────────────────────────────────────────── */
.zc-canvas {
  min-height: 100vh;
  padding: 1.5rem;
  /* The page sheet (#266): the composition floats on this tonally-distinct panel
     surface; the quiet gray backdrop it sits over is painted host-side on
     .sg-composer-canvas-host (src/features/composer/styles.css). panel-bg is
     ~ΔL 0.045 lighter than the backdrop in both modes — the prototype grammar
     (S1 #263). Light: near-white sheet on gray; dark: subtly lighter sheet. */
  background: var(--sg-composer-panel-bg);
  color: var(--color-fg);
}
.zc-canvas[data-mode="edit"] { padding-top: 2.25rem; }

/* Edit mode swallows activation in the capture phase (renderer.ts); the cursor
   must not promise a navigation that will not happen. */
.zc-canvas[data-mode="edit"] a,
.zc-canvas[data-mode="edit"] button:not([data-zc-affordance]) {
  cursor: default;
}

/* ── Node wrapper ─────────────────────────────────────────────────────────── */
.zc-node {
  position: relative;
  /* Contains the out-of-flow chrome without joining the parent's stacking
     contest — the affordances only ever rise above their OWN node. */
  isolation: isolate;
}
.zc-canvas[data-mode="edit"] .zc-node:hover {
  outline: 1px dashed var(--color-border);
  outline-offset: 2px;
}
.zc-canvas[data-mode="edit"] .zc-node[data-zc-selected] {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* ── Inline text editing (issue #257) ─────────────────────────────────────── */
/* The active contentEditable region: a clear editing affordance and a text
   caret. The outline is out-of-flow, so making a text node editable neither
   reflows nor remounts the component (see the caret-survival note in
   renderer.ts). */
[${COMPOSER_PREVIEW_DOC_ATTR}] [data-zc-inline-editing] {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
  border-radius: 2px;
  cursor: text;
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
}
[${COMPOSER_PREVIEW_DOC_ATTR}] [data-zc-inline-editing]:focus {
  outline-color: var(--color-focus);
}

/* ── Chrome: floats ABOVE the node's box, never over it ───────────────────── */
.zc-chrome {
  position: absolute;
  inset-inline-start: 0;
  /* bottom:100% puts it entirely above the node's top edge, so a shrink-wrapped
     component (a button, a heading) is never covered by its own label. */
  bottom: 100%;
  margin-block-end: 2px;
  z-index: var(--z-index-local-2);
  display: block;
  max-width: 100%;
  overflow: hidden;
  padding: 0 0.375rem;
  border-radius: 3px;
  /* Accent budget (#266): the HOVER label is a QUIET neutral chip. Accent is
     reserved for the SELECTED node — the loud, whitelisted role (below). The old
     hardcoded 0.6875rem (11px) label is replaced by --text-micro (12px floor). */
  border: 1px solid var(--color-border);
  background: var(--color-surface-2);
  color: var(--color-fg);
  font-size: var(--text-micro);
  line-height: 1.4rem;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 120ms ease-out;
}
.zc-node:hover > .zc-chrome,
.zc-node[data-zc-selected] > .zc-chrome {
  opacity: 1;
}
/* Selection is THE loud element (whitelisted): the selected node's label carries
   the accent so it reads as active; a plain hover stays neutral (above). Only a
   selected node ever shows the grip/menu buttons, so their inherited color and
   on-accent hover wash always resolve against this accent fill. */
.zc-node[data-zc-selected] > .zc-chrome {
  border-color: transparent;
  background: var(--color-accent);
  color: var(--color-on-accent);
}

/* The SELECTED node's "⋯" menu trigger (issue #256) — chrome itself keeps
   pointer-events:none (it is a label), so the button re-enables them on
   itself. It must stay reachable even before hover, since it is the ONLY
   way to reach the node menu when the node has no pointer nearby. */
.zc-chrome-menu {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-inline-start: 0.25rem;
  padding: 0 0.25rem;
  border: none;
  border-radius: 2px;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: inherit;
  cursor: pointer;
}
.zc-chrome-menu:hover,
.zc-chrome-menu:focus-visible {
  background: color-mix(in srgb, var(--color-on-accent) 25%, transparent);
}
.zc-chrome-menu:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 1px; }

/* ── Drag grip (issue #258) ───────────────────────────────────────────────── */
/* Shown only on the SELECTED, non-opaque node's chrome. The chrome itself is a
   pointer-events:none label, so the grip re-enables them on itself (it must be
   grabbable). Opaque nodes get no grip — the tree's up/down buttons stay their
   only movement. */
.zc-chrome-grip {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-inline-end: 0.25rem;
  padding: 0 0.25rem;
  border: none;
  border-radius: 2px;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: inherit;
  cursor: grab;
}
.zc-chrome-grip:active { cursor: grabbing; }
.zc-chrome-grip:hover,
.zc-chrome-grip:focus-visible {
  background: color-mix(in srgb, var(--color-on-accent) 25%, transparent);
}
.zc-chrome-grip:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 1px; }

/* ── Insert points: one at EVERY addable index of every declared slot ─────── */
/* The wrapper pairs the direct "+" add button with its "⋯" insert-menu
   companion (issue #256) — two SIBLING buttons, never nested. It owns the
   positioning/isolation .zc-insert used to own by itself. */
.zc-insert-group {
  position: relative;
  z-index: var(--z-index-local-1);
  display: flex;
  gap: 2px;
}
.zc-insert-group--vertical { width: 100%; flex-direction: row; align-items: stretch; }
.zc-insert-group--horizontal { align-self: stretch; flex-direction: column; align-items: stretch; min-width: 0.75rem; }

.zc-insert {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  /* Accent budget (#266): insert markers RECEDE until reached for — a muted,
     guide-toned dashed bar at reduced opacity, NOT accent, at rest. This is the
     single biggest at-rest orange source (6+ markers in the sample doc). Accent
     appears only on hover/focus (below) and on the active drop target. */
  border: 1px dashed var(--sg-composer-guide);
  border-radius: 3px;
  background: transparent;
  color: var(--sg-composer-guide);
  opacity: 0.5;
  cursor: copy;
  transition: background-color 120ms ease-out, border-color 120ms ease-out,
    color 120ms ease-out, opacity 120ms ease-out;
}
.zc-insert:hover,
.zc-insert:focus-visible {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
  color: var(--color-accent);
  opacity: 1;
}
.zc-insert:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 1px; }

/* Between stacked children: a full-width rule. */
.zc-insert--vertical { width: 100%; min-height: 0.75rem; }
/* Between side-by-side children: a full-height bar. */
.zc-insert--horizontal { align-self: stretch; min-width: 0.75rem; min-height: 2rem; }

/* An empty slot's only insert point doubles as its placeholder, so a container
   with no children is still a visible, addressable drop target. */
.zc-insert--empty {
  min-height: 3rem;
  border-color: var(--color-border);
  color: var(--color-muted);
  /* The SOLE affordance for an empty container — stays fully visible (neutral),
     never muted like the between-child bars. */
  opacity: 1;
}

/* ── End-of-slot add affordance (issue #283) ───────────────────────────────
   The slot's LAST insert point (index === children.length) renders as this
   enlarged, LABELED button instead of the slim between-children bar above —
   ported from the prototype's .insert-end/.add-btn geometry
   (_temp-resource/275-composer-ui-parity/composition1/styles.css). Toning
   is INHERITED from the shared .zc-insert rules above (neutral guide-dashed
   at rest, accent only on hover/focus-visible) — every rule below is
   geometry, never a color; the prototype's accent-at-rest styling is
   deliberately NOT ported (#283's locked toning contract). */
.zc-insert-end--vertical { width: 100%; }
.zc-insert-end--horizontal { width: auto; }

.zc-insert-end-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-hsp-xs);
  width: 100%;
  font-size: var(--text-caption);
  white-space: nowrap;
}
.zc-insert-end-btn:not(.zc-insert--empty) {
  min-height: 2rem;
  padding-block: var(--spacing-vsp-2xs);
  padding-inline: var(--spacing-hsp-md);
}
.zc-insert-end--horizontal .zc-insert-end-btn { width: auto; flex: 0 0 auto; }
/* Compact (row-flow) variant reserves trailing clearance for the dots
   companion, which overlaps this button's edge (.zc-insert-menu--end
   below) rather than sitting inline beside it — inset (--spacing-hsp-sm) +
   the dots' own width (1.375rem) + a breathing gap (--spacing-hsp-xs). */
.zc-insert-end--horizontal .zc-insert-end-btn:not(.zc-insert--empty) {
  padding-inline-end: calc(var(--spacing-hsp-sm) + 1.375rem + var(--spacing-hsp-xs));
}
/* Empty-slot variant: KEEPS the existing min-height:3rem / neutral-muted
   toning from .zc-insert--empty above (unchanged) — this only adds the
   symmetric breathing padding the prototype's .add-btn.add-empty uses. */
.zc-insert-end-btn.zc-insert--empty { padding: var(--spacing-vsp-xs); }

.zc-insert-plus { flex-shrink: 0; }

/* The insert point's "⋯" companion — opens the insert MENU (Add
   component…/Paste here) alongside the direct "+" add shortcut. */
.zc-insert-menu {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 1.125rem;
  padding: 0 0.125rem;
  /* Muted at rest, accent on interaction — same budget as the "+" bar above. */
  border: 1px dashed transparent;
  border-radius: 3px;
  background: transparent;
  color: var(--sg-composer-guide);
  opacity: 0.5;
  cursor: pointer;
  font-size: var(--text-micro);
  line-height: 1;
  transition: background-color 120ms ease-out, border-color 120ms ease-out,
    color 120ms ease-out, opacity 120ms ease-out;
}
.zc-insert-menu:hover,
.zc-insert-menu:focus-visible {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
  color: var(--color-accent);
  opacity: 1;
}
.zc-insert-menu:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 1px; }

/* The end-affordance's dots OVERLAP the add button's trailing edge (prototype
   .insert-end .ip-dots) instead of sitting inline beside it like the
   between-bar's companion above — anchored to the group, which (as a
   .zc-insert-group) is already position: relative. Locked size/inset
   (#283): 1.375rem x 1.25rem, inset-inline-end --spacing-hsp-sm. */
.zc-insert-menu--end {
  position: absolute;
  inset-inline-end: var(--spacing-hsp-sm);
  top: 50%;
  transform: translateY(-50%);
  width: 1.375rem;
  height: 1.25rem;
}

/* ── Drag & drop: insert points as drop zones (issue #258) ────────────────── */
/* While a drag is active, the insert GROUP is the drop target, so its CHILDREN
   go inert — a child-crossing dragleave has a null relatedTarget in Chromium
   DnD and would otherwise wipe the hovered-target highlight (verified). */
.zc-canvas[data-zc-dragging] .zc-insert-group > * { pointer-events: none; }

/* Every VALID insert point highlights during a drag; the hovered one gets a
   stronger state. Invalid targets (inside the dragged subtree) get neither.
   Accent budget (#266): a valid CANDIDATE is a NEUTRAL guide dash — the accent
   is spent only on the ONE active drop target below. */
.zc-canvas[data-zc-dragging] .zc-insert-group[data-zc-drop-valid] {
  outline: 1px dashed var(--sg-composer-guide);
  outline-offset: 2px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--sg-composer-guide) 12%, transparent);
}
.zc-canvas[data-zc-dragging] .zc-insert-group[data-zc-drop-valid].zc-insert-group--vertical {
  min-height: 1.25rem;
}
.zc-canvas[data-zc-dragging] .zc-insert-group[data-zc-drop-active] {
  outline: 2px solid var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 20%, transparent);
}

/* ── Opaque node: preserved, selectable, never silently dropped ───────────── */
.zc-opaque {
  border: 1px dashed var(--color-warning);
  border-radius: 4px;
  padding: 0.75rem;
  background: color-mix(in srgb, var(--color-warning) 8%, transparent);
  font-size: var(--text-caption);
}
.zc-opaque-title { margin: 0; font-weight: 600; }
.zc-opaque-reasons { margin: 0.375rem 0 0; padding-inline-start: 1.25rem; color: var(--color-muted); }
.zc-opaque-payload { margin-block-start: 0.5rem; }
.zc-opaque-payload summary { cursor: pointer; color: var(--color-muted); }
.zc-opaque-payload pre {
  margin: 0.375rem 0 0;
  max-height: 14rem;
  overflow: auto;
  padding: 0.5rem;
  border-radius: 3px;
  background: var(--color-surface-2);
  font-size: var(--text-micro);
}

/* ── Recoverable failures ─────────────────────────────────────────────────── */
.zc-node-error,
.zc-error {
  border: 1px solid var(--color-danger);
  border-radius: 4px;
  padding: 0.75rem;
  background: color-mix(in srgb, var(--color-danger) 8%, transparent);
  font-size: var(--text-caption);
}
.zc-node-error-title, .zc-error-title { margin: 0; font-weight: 600; }
.zc-node-error-detail, .zc-error-detail { margin: 0.375rem 0 0; color: var(--color-muted); }
.zc-node-error-retry, .zc-error-dismiss {
  margin-block-start: 0.5rem;
  padding: 0.125rem 0.625rem;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: var(--color-surface);
  color: var(--color-fg);
  cursor: pointer;
}
.zc-error { margin: 0 0 1rem; }

/* ── Boot / empty states ──────────────────────────────────────────────────── */
.zc-empty {
  padding: 2rem;
  color: var(--color-muted);
  font-size: var(--text-caption);
  text-align: center;
}
`;
