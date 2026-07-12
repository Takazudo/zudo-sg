// Feature-local CSS for the Composer preview DOCUMENT (`/composer/preview`).
//
// ── Why a string, inlined into the document's own <head> ─────────────────────
// zfb builds ONE authored global stylesheet (it resolves `src/styles/global.css`
// and emits a single hashed bundle every page links); a page that imports some
// OTHER `.css` file does NOT get a second bundle. The styleguide's equivalent
// scope solves that by living inside the one bundle
// (`src/styles/global.css` @imports `src/styles/preview.css`) — but
// `src/styles/global.css` is owned by the parallel #247 route-shell issue, and
// `src/features/composer/**` is not in its Tailwind `@source` list either.
//
// So this runtime carries its own CSS as a string and the route inlines it into
// the preview document's `<head>`. It is therefore:
//   - guaranteed present inside the iframe, with no global-stylesheet edit;
//   - scoped to `html[data-composer-preview-doc]`, which ONLY this document
//     carries, so the host chrome is provably unaffected;
//   - free of Tailwind utilities, so it needs no `@source` registration.
// (Wave-5 integration may fold it into the bundle later; nothing here depends
// on that.)
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
  --color-success: light-dark(var(--palette-state-success), var(--palette-state-success-dark));
  --color-danger:  light-dark(var(--palette-state-danger),  var(--palette-state-danger-dark));
  --color-warning: light-dark(var(--palette-state-warning), var(--palette-state-warning-dark));
  --color-info:    light-dark(var(--palette-state-info),    var(--palette-state-info-dark));
}

/* ── Canvas ───────────────────────────────────────────────────────────────── */
.zc-canvas {
  min-height: 100vh;
  padding: 1.5rem;
  background: var(--color-bg);
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
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-size: 0.6875rem;
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

/* ── Insert points: one at EVERY addable index of every declared slot ─────── */
.zc-insert {
  position: relative;
  z-index: var(--z-index-local-1);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px dashed transparent;
  border-radius: 3px;
  background: transparent;
  color: var(--color-accent);
  cursor: copy;
  transition: background-color 120ms ease-out, border-color 120ms ease-out;
}
.zc-insert:hover,
.zc-insert:focus-visible {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
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
}
.zc-insert-plus { font-size: 0.875rem; line-height: 1; }

/* ── Opaque node: preserved, selectable, never silently dropped ───────────── */
.zc-opaque {
  border: 1px dashed var(--color-warning);
  border-radius: 4px;
  padding: 0.75rem;
  background: color-mix(in srgb, var(--color-warning) 8%, transparent);
  font-size: 0.8125rem;
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
  font-size: 0.75rem;
}

/* ── Recoverable failures ─────────────────────────────────────────────────── */
.zc-node-error,
.zc-error {
  border: 1px solid var(--color-danger);
  border-radius: 4px;
  padding: 0.75rem;
  background: color-mix(in srgb, var(--color-danger) 8%, transparent);
  font-size: 0.8125rem;
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
  font-size: 0.875rem;
  text-align: center;
}
`;
